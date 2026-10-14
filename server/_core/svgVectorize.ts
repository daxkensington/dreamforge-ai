/**
 * Pure-Node raster-to-SVG vectorizer using sharp + k-means palette quantization
 * + 3x3 majority despeckling + scanline-merged SVG path generation.
 *
 * Used as the automatic fallback in `tools.vectorize` whenever the self-hosted
 * RunPod `vtracer` worker is paused (`max_workers=0`) or unreachable, ensuring
 * `/tools/vectorize` always produces a real, downloadable `.svg` file.
 */
import sharp from "sharp";

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function colorDistSq(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Quantize raw RGB pixels into `k` distinct palette colors using deterministic
 * luminance-quantile seeding + k-means iterations.
 */
function quantizePalette(pixels: Uint8Array, pixelCount: number, k: number): {
  palette: RgbColor[];
  labels: Uint8Array;
} {
  const clusterCount = Math.max(2, Math.min(32, Math.round(k)));

  // Sample up to 4096 pixels deterministically for fast centroid initialization & updates
  const stride = Math.max(1, Math.floor(pixelCount / 4096));
  const samples: Array<RgbColor & { luma: number }> = [];
  for (let i = 0; i < pixelCount; i += stride) {
    const offset = i * 3;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    samples.push({ r, g, b, luma: 0.299 * r + 0.587 * g + 0.114 * b });
  }
  samples.sort((a, b) => a.luma - b.luma);

  const palette: RgbColor[] = [];
  for (let c = 0; c < clusterCount; c++) {
    const idx = Math.min(
      samples.length - 1,
      Math.floor(((c + 0.5) / clusterCount) * samples.length),
    );
    const s = samples[idx] ?? { r: 0, g: 0, b: 0 };
    palette.push({ r: s.r, g: s.g, b: s.b });
  }

  // 6 k-means iterations over samples
  for (let iter = 0; iter < 6; iter++) {
    const sums = Array.from({ length: clusterCount }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (const s of samples) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < clusterCount; c++) {
        const d = colorDistSq(s, palette[c]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      sums[bestIdx].r += s.r;
      sums[bestIdx].g += s.g;
      sums[bestIdx].b += s.b;
      sums[bestIdx].count += 1;
    }
    for (let c = 0; c < clusterCount; c++) {
      if (sums[c].count > 0) {
        palette[c] = {
          r: Math.round(sums[c].r / sums[c].count),
          g: Math.round(sums[c].g / sums[c].count),
          b: Math.round(sums[c].b / sums[c].count),
        };
      }
    }
  }

  // Assign every pixel to nearest centroid
  const labels = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 3;
    const px = { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] };
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let c = 0; c < clusterCount; c++) {
      const d = colorDistSq(px, palette[c]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = c;
      }
    }
    labels[i] = bestIdx;
  }

  return { palette, labels };
}

/**
 * 3x3 majority-vote despeckle pass to remove isolated 1px quantization noise.
 */
function despeckleLabels(labels: Uint8Array, width: number, height: number, k: number): Uint8Array {
  const out = new Uint8Array(labels);
  const counts = new Uint8Array(k);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const center = labels[idx];
      counts.fill(0);
      let bestLabel = center;
      let bestCount = 0;

      for (let dy = -1; dy <= 1; dy++) {
        const rowOffset = (y + dy) * width;
        for (let dx = -1; dx <= 1; dx++) {
          const lbl = labels[rowOffset + x + dx];
          const nextCount = ++counts[lbl];
          if (nextCount > bestCount) {
            bestCount = nextCount;
            bestLabel = lbl;
          }
        }
      }

      // Only flip center pixel if its own label appears <= 2 times in the 3x3 window
      if (counts[center] <= 2 && bestCount >= 5) {
        out[idx] = bestLabel;
      }
    }
  }

  return out;
}

/**
 * Convert a raster image buffer into a clean multi-color SVG string.
 */
export async function vectorizeBufferToSvg(
  rasterBuffer: Buffer,
  colorCount: number = 8,
): Promise<string> {
  const meta = await sharp(rasterBuffer).metadata().catch(() => ({ width: 1024, height: 1024 }));
  const origWidth = meta.width || 1024;
  const origHeight = meta.height || 1024;

  const { data, info } = await sharp(rasterBuffer)
    .resize({ width: 160, height: 160, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;
  const k = Math.max(2, Math.min(32, Math.round(colorCount)));

  const { palette, labels: rawLabels } = quantizePalette(data, pixelCount, k);
  const labels = despeckleLabels(rawLabels, width, height, palette.length);

  // Count frequency of each color so the most dominant color becomes the background <rect>
  const freq = new Uint32Array(palette.length);
  for (let i = 0; i < pixelCount; i++) {
    freq[labels[i]]++;
  }
  let bgIndex = 0;
  for (let c = 1; c < palette.length; c++) {
    if (freq[c] > freq[bgIndex]) bgIndex = c;
  }

  const paths: string[] = [
    `  <rect width="${width}" height="${height}" fill="${rgbToHex(palette[bgIndex])}"/>`,
  ];

  // For each non-background color, merge horizontal runs and vertically adjacent identical runs
  for (let c = 0; c < palette.length; c++) {
    if (c === bgIndex || freq[c] === 0) continue;

    // Collect horizontal runs per row: Map<"x0:w", { x: number, y: number, w: number, h: number }>
    let activeRects = new Map<string, { x: number; y: number; w: number; h: number }>();
    const finishedRects: Array<{ x: number; y: number; w: number; h: number }> = [];

    for (let y = 0; y < height; y++) {
      const nextRects = new Map<string, { x: number; y: number; w: number; h: number }>();
      const rowOffset = y * width;
      let x = 0;
      while (x < width) {
        if (labels[rowOffset + x] !== c) {
          x++;
          continue;
        }
        const x0 = x;
        while (x < width && labels[rowOffset + x] === c) {
          x++;
        }
        const w = x - x0;
        const key = `${x0}:${w}`;
        const prev = activeRects.get(key);
        if (prev) {
          prev.h += 1;
          nextRects.set(key, prev);
          activeRects.delete(key);
        } else {
          nextRects.set(key, { x: x0, y, w, h: 1 });
        }
      }
      for (const rect of activeRects.values()) {
        finishedRects.push(rect);
      }
      activeRects = nextRects;
    }
    for (const rect of activeRects.values()) {
      finishedRects.push(rect);
    }

    if (finishedRects.length === 0) continue;

    const d = finishedRects
      .map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}Z`)
      .join("");
    paths.push(`  <path fill="${rgbToHex(palette[c])}" d="${d}"/>`);
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${origWidth}" height="${origHeight}" shape-rendering="crispEdges">`,
    ...paths,
    `</svg>`,
  ].join("\n");
}

function classifyStrokeColor({ r, g, b }: RgbColor): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max > 220 && min > 200) return "bright white";
  if (max < 45) return "deep black";
  if (max - min < 25) return "neutral gray";
  if (r >= g && r >= b) {
    if (g > 180 && b < 80) return "golden yellow";
    if (g > 100 && b < 80) return "warm orange";
    if (b > 150) return "vibrant magenta";
    return "bold red";
  }
  if (g >= r && g >= b) {
    if (b > 160) return "bright cyan";
    return "vibrant green";
  }
  if (r > 110) return "electric violet";
  return "cobalt blue";
}

/**
 * Fast (<5ms) spatial sketch composition analyzer for Krea-style live canvas
 * rendering. Extracts painted regions from a 3x3 grid over the canvas without
 * requiring a slow LLM vision round-trip.
 */
export async function describeSketchBufferFast(sketchBuffer: Buffer): Promise<string> {
  try {
    const { data, info } = await sharp(sketchBuffer)
      .resize({ width: 48, height: 48, fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const regionNames = [
      ["top-left", "top-center", "top-right"],
      ["mid-left", "center", "mid-right"],
      ["bottom-left", "bottom-center", "bottom-right"],
    ];
    const cellW = Math.floor(info.width / 3);
    const cellH = Math.floor(info.height / 3);
    const bg = { r: 26, g: 26, b: 46 }; // Default #1a1a2e canvas background
    const activeRegions: string[] = [];

    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let painted = 0;
        for (let y = gy * cellH; y < (gy + 1) * cellH; y++) {
          for (let x = gx * cellW; x < (gx + 1) * cellW; x++) {
            const idx = (y * info.width + x) * 3;
            const px = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
            if (colorDistSq(px, bg) > 900) {
              sumR += px.r;
              sumG += px.g;
              sumB += px.b;
              painted++;
            }
          }
        }
        if (painted >= 6) {
          const avg = {
            r: Math.round(sumR / painted),
            g: Math.round(sumG / painted),
            b: Math.round(sumB / painted),
          };
          activeRegions.push(`${classifyStrokeColor(avg)} elements in ${regionNames[gy][gx]}`);
        }
      }
    }

    if (activeRegions.length === 0) return "";
    return `Composition layout from user sketch: ${activeRegions.slice(0, 5).join(", ")}.`;
  } catch {
    return "";
  }
}

