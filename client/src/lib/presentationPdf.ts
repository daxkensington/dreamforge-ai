import { jsPDF } from "jspdf";
import type { PresentationSlide } from "@shared/presentation";

export const PRESENTATION_PAGE = { width: 1600, height: 900 } as const;
const FONT = 'Arial, "Noto Sans", sans-serif';
export interface PresentationPdfLine {
  text: string;
  x: number;
  y: number;
  size: number;
  title: boolean;
}
export interface PresentationPdfPage {
  slideIndex: number;
  notes: boolean;
  continuation: boolean;
  lines: PresentationPdfLine[];
  imageUrl?: string;
}
type Measure = (text: string, size: number) => number;

/** Wrap words, CJK and long tokens without splitting surrogate pairs. */
export function wrapPresentationText(
  text: string,
  width: number,
  size: number,
  measure: Measure
): string[] {
  const lines: string[] = [];
  for (const paragraph of text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .split("\n")) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      for (const { segment: character } of new Intl.Segmenter(undefined, {
        granularity: "grapheme",
      }).segment(word)) {
        if (line && measure(line + character, size) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Every line flows to another page instead of being clipped or silently lost. */
export function layoutPresentationPdf(
  slides: readonly PresentationSlide[],
  includeNotes: boolean,
  measure: Measure
): PresentationPdfPage[] {
  if (!slides.length) throw new Error("Add a slide before exporting.");
  const pages: PresentationPdfPage[] = [];
  slides.forEach((slide, slideIndex) => {
    const section = (notes: boolean) => {
      const imageUrl = notes ? undefined : slide.imageUrl;
      const width = imageUrl ? 720 : 1420;
      const title = wrapPresentationText(
        slide.title || `Slide ${slideIndex + 1}`,
        width,
        52,
        measure
      );
      const body = wrapPresentationText(
        notes ? slide.notes : slide.content,
        width,
        32,
        measure
      );
      let page: PresentationPdfPage = {
        slideIndex,
        notes,
        continuation: false,
        lines: [],
        imageUrl,
      };
      let y = 145;
      pages.push(page);
      const addLine = (text: string, size: number, isTitle: boolean) => {
        const lineHeight = isTitle ? 66 : 46;
        if (y + lineHeight > 800) {
          page = { slideIndex, notes, continuation: true, lines: [], imageUrl };
          pages.push(page);
          y = 145;
        }
        page.lines.push({ text, x: 90, y, size, title: isTitle });
        y += lineHeight;
      };
      title.forEach(text => addLine(text, 52, true));
      addLine("", 32, false);
      body.forEach(text => addLine(text, 32, false));
    };
    section(false);
    if (includeNotes && slide.notes.trim()) section(true);
  });
  if (pages.length > 200)
    throw new Error(
      "This presentation exceeds 200 PDF pages. Split it into smaller decks before exporting."
    );
  return pages;
}

function canvas() {
  const value = document.createElement("canvas");
  value.width = PRESENTATION_PAGE.width;
  value.height = PRESENTATION_PAGE.height;
  const context = value.getContext("2d");
  if (!context) throw new Error("Your browser could not create a PDF canvas.");
  return { value, context };
}
function paintText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number
) {
  // Native canvas uses the browser's shaping and fallback fonts, including
  // multilingual text and emoji, instead of PDF's limited standard font set.
  const rtl = /^[\s\d\W]*[\u0590-\u08ff]/u.test(text);
  context.direction = rtl ? "rtl" : "ltr";
  context.textAlign = rtl ? "right" : "left";
  context.fillText(text, rtl ? x + width : x, y);
}

async function loadExportImage(url: string): Promise<HTMLImageElement> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let objectUrl: string | undefined;
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !/^image\/(png|jpeg|webp|gif)/i.test(
        response.headers.get("content-type") ?? ""
      )
    )
      throw new Error("Image download was not successful.");
    if (Number(response.headers.get("content-length")) > 16 * 1024 * 1024)
      throw new Error("Image is larger than 16 MB.");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Image could not be read.");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.length;
      if (bytes > 16 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Image is larger than 16 MB.");
      }
      chunks.push(new Uint8Array(part.value));
    }
    objectUrl = URL.createObjectURL(new Blob(chunks));
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("Image format could not be decoded."));
      image.src = objectUrl!;
    });
    if (image.naturalWidth * image.naturalHeight > 40_000_000)
      throw new Error("Image resolution is too large to export safely.");
    return image;
  } finally {
    clearTimeout(timeout);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export async function createPresentationPdf(input: {
  title: string;
  slides: readonly PresentationSlide[];
  includeNotes: boolean;
  onProgress?: (completed: number, total: number) => void;
}): Promise<jsPDF> {
  await document.fonts?.ready;
  const { value, context } = canvas();
  const measure: Measure = (text, size) => {
    context.font = `${size === 52 ? "bold " : ""}${size}px ${FONT}`;
    return context.measureText(text).width;
  };
  const pages = layoutPresentationPdf(
    input.slides,
    input.includeNotes,
    measure
  );
  const images = new Map<string, HTMLImageElement>();
  for (const url of new Set(
    pages.map(page => page.imageUrl).filter((url): url is string => !!url)
  )) {
    try {
      images.set(url, await loadExportImage(url));
    } catch (error) {
      throw new Error(
        `A slide image could not be included. Retry or remove that image before exporting. ${error instanceof Error ? error.message : ""}`
      );
    }
  }
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [1600, 900],
    compress: true,
    hotfixes: ["px_scaling"],
  });
  pdf.setProperties({
    title: input.title,
    subject: "Presentation slides and speaker notes",
    creator: "DreamForgeX Presentation Builder",
  });
  for (let index = 0; index < pages.length; index++) {
    if (index) pdf.addPage([1600, 900], "landscape");
    const page = pages[index];
    context.fillStyle = "#111827";
    context.fillRect(0, 0, 1600, 900);
    context.fillStyle = "#22d3ee";
    context.fillRect(90, 72, 72, 6);
    context.font = `24px ${FONT}`;
    context.fillStyle = "#a5b4fc";
    paintText(
      context,
      `${page.notes ? "SPEAKER NOTES" : "SLIDE"} ${page.slideIndex + 1}${page.continuation ? " / CONTINUED" : ""}`,
      190,
      82,
      1320
    );
    for (const line of page.lines) {
      context.font = `${line.title ? "bold " : ""}${line.size}px ${FONT}`;
      context.fillStyle = line.title ? "#ffffff" : "#d1d5db";
      paintText(context, line.text, line.x, line.y, page.imageUrl ? 720 : 1420);
    }
    if (page.imageUrl) {
      const image = images.get(page.imageUrl)!;
      const scale = Math.min(
        610 / image.naturalWidth,
        580 / image.naturalHeight
      );
      const width = image.naturalWidth * scale,
        height = image.naturalHeight * scale;
      context.drawImage(
        image,
        900 + (610 - width) / 2,
        170 + (580 - height) / 2,
        width,
        height
      );
    }
    context.fillStyle = "#94a3b8";
    context.font = `21px ${FONT}`;
    paintText(
      context,
      `${page.notes ? "Speaker notes" : "Presentation"} / ${index + 1} of ${pages.length}`,
      90,
      850,
      1420
    );
    pdf.addImage(
      value.toDataURL("image/png"),
      "PNG",
      0,
      0,
      1600,
      900,
      undefined,
      "FAST"
    );
    input.onProgress?.(index + 1, pages.length);
    // Yield so long decks keep the progress message and browser responsive.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  value.width = value.height = 1;
  return pdf;
}
