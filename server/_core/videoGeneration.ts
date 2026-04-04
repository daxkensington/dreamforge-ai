/**
 * Video generation via Google Veo 3.
 * Shared by textToVideo, imageToVideo, and generateMusicVideo router endpoints.
 */

import { ENV } from "./env";

const VEO_MODEL = "veo-3.0-generate-preview";
const VEO_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface Veo3Options {
  prompt: string;
  aspectRatio?: string;
  durationSeconds?: number;
  /** Base64-encoded source image for image-to-video. */
  imageBase64?: string;
  imageMimeType?: string;
}

/**
 * Generate a video via Google Veo 3 with async polling.
 * Returns the video URL (or data URI for base64 results).
 */
export async function generateVeo3Video(options: Veo3Options): Promise<string> {
  const geminiKey = ENV.geminiApiKey;
  if (!geminiKey) throw new Error("Gemini API key not configured for video generation");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const startResponse = await fetch(
    `${VEO_BASE}/models/${VEO_MODEL}:predictLongRunning?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{
          prompt: options.prompt,
          ...(options.imageBase64 ? { image: { bytesBase64Encoded: options.imageBase64, mimeType: options.imageMimeType || "image/jpeg" } } : {}),
        }],
        parameters: {
          ...(options.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
          durationSeconds: options.durationSeconds || 8,
          sampleCount: 1,
        },
      }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeout);

  if (!startResponse.ok) {
    const err = await startResponse.text();
    throw new Error(`Veo 3 failed to start: ${err}`);
  }

  const operation = await startResponse.json();
  const operationName = operation.name;
  if (!operationName) throw new Error("No operation name returned from Veo 3");

  // Poll for completion (up to 5 minutes)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));

    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 30000);
    const pollResponse = await fetch(`${VEO_BASE}/${operationName}?key=${geminiKey}`, { signal: pollController.signal });
    clearTimeout(pollTimeout);
    const pollResult = await pollResponse.json();

    if (pollResult.done) {
      const videos = pollResult.response?.generatedSamples || pollResult.response?.predictions;
      if (videos && videos.length > 0) {
        const video = videos[0];
        if (video.video?.uri) return video.video.uri;
        if (video.bytesBase64Encoded) return `data:video/mp4;base64,${video.bytesBase64Encoded}`;
      }
      throw new Error("Veo 3 completed but returned no video data");
    }

    if (pollResult.error) {
      throw new Error(`Veo 3 error: ${pollResult.error.message || JSON.stringify(pollResult.error)}`);
    }
  }

  throw new Error("Video generation timed out after 5 minutes");
}
