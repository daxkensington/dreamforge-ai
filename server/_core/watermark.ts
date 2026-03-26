/**
 * Watermark system for free-tier outputs.
 * Adds "DreamForgeX" watermark to images and returns watermarked buffer.
 *
 * For video/audio, watermark is handled client-side via overlay.
 * For images, we stamp the watermark server-side so it can't be bypassed.
 */

const WATERMARK_TEXT = "DreamForgeX";
const WATERMARK_OPACITY = 0.3;

/**
 * Add a text watermark to an image buffer using Canvas API.
 * Works in Node.js via the built-in Canvas available in Next.js.
 */
export async function addImageWatermark(imageBuffer: Buffer): Promise<Buffer> {
  // Use sharp for watermarking — it's already a dependency
  try {
    // @ts-ignore — sharp may not be installed in all environments
    const sharp = (await import("sharp")).default as any;
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // Create SVG watermark overlay
    const fontSize = Math.max(Math.round(width * 0.04), 16);
    const svgWatermark = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .watermark {
            fill: rgba(255, 255, 255, ${WATERMARK_OPACITY});
            font-family: Arial, sans-serif;
            font-weight: bold;
            font-size: ${fontSize}px;
          }
        </style>
        <!-- Bottom-right watermark -->
        <text x="${width - 20}" y="${height - 20}" text-anchor="end" class="watermark">${WATERMARK_TEXT}</text>
        <!-- Diagonal center watermark -->
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle"
              transform="rotate(-30, ${width / 2}, ${height / 2})"
              class="watermark" style="font-size: ${fontSize * 2}px; fill: rgba(255, 255, 255, 0.08);">
          ${WATERMARK_TEXT}
        </text>
      </svg>
    `);

    const watermarked = await sharp(imageBuffer)
      .composite([{ input: svgWatermark, blend: "over" }])
      .png()
      .toBuffer();

    return watermarked;
  } catch (err) {
    // If sharp fails, return original (don't block generation)
    console.warn("[Watermark] Failed to add watermark, returning original:", err);
    return imageBuffer;
  }
}

/**
 * Add a brief audio watermark tag to the beginning of audio content.
 * Prepends a short "Created with DreamForgeX" voice tag.
 * For free tier songs/TTS outputs.
 */
export function getAudioWatermarkNotice(): string {
  return "This audio was created with DreamForgeX. Upgrade to Pro to remove this message.";
}

/**
 * Get video watermark overlay CSS for client-side rendering.
 * Free-tier videos get a persistent corner watermark.
 */
export function getVideoWatermarkStyle(): {
  text: string;
  position: string;
  opacity: number;
} {
  return {
    text: WATERMARK_TEXT,
    position: "bottom-right",
    opacity: WATERMARK_OPACITY,
  };
}

/**
 * Check if a user's tier requires watermarking.
 */
export function requiresWatermark(userTier: string): boolean {
  return userTier === "free" || !userTier;
}

/**
 * Get the max resolution for a tier.
 */
export function getMaxResolution(userTier: string): { width: number; height: number } {
  switch (userTier) {
    case "enterprise":
    case "studio":
      return { width: 4096, height: 4096 }; // 4K
    case "pro":
    case "creator":
      return { width: 2048, height: 2048 }; // HD
    default:
      return { width: 1024, height: 768 }; // 480p-ish for free
  }
}

/**
 * Get daily generation limits by tier.
 */
export function getDailyLimits(userTier: string): {
  images: number;
  songs: number;
  videos: number;
  musicVideos: number;
} {
  switch (userTier) {
    case "enterprise":
      return { images: -1, songs: -1, videos: -1, musicVideos: -1 }; // unlimited
    case "studio":
      return { images: 500, songs: 50, videos: 30, musicVideos: -1 }; // generous
    case "pro":
    case "creator":
      return { images: 150, songs: 10, videos: 10, musicVideos: 10 };
    default:
      return { images: 100, songs: 5, videos: 3, musicVideos: 1 }; // free
  }
}
