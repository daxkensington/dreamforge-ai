/**
 * Uncensored video generation — self-hosted Wan 2.2 (RunPod) ONLY.
 *
 * Why self-hosted-only: every external video provider (Veo, Runway, Kling,
 * fal, Replicate) rejects adult content, so there is no fallback chain — if the
 * GPU is down, this fails loud. This mirrors generateUnfiltered() for images.
 *
 * Two modes:
 *   - text-to-video: prompt only.
 *   - image-to-video: animate a source frame. The source MUST be one of the
 *     caller's own prior synthetic generations (passed as a URL by the router);
 *     we never animate an arbitrary upload, which sidesteps the real-person /
 *     minor liability of I2V on unknown images for v1.
 *
 * The prompt moderation gate (CSAM + real-person deepfake refusal) runs here as
 * a defense-in-depth backstop even though the router gates first — a refusal at
 * this layer means a surface gate was bypassed and is logged to moderation_log.
 */
import { checkPrompt, logModerationBlock, PromptBlockedError } from "./promptModeration";
import { isRunPodAvailable, runpodWanVideo } from "./runpod";
import { storagePut, generateStorageKey } from "../storage";

export interface UncensoredVideoParams {
  prompt: string;
  userId: number;
  /** Source-frame URL for image-to-video (a prior generation owned by the user). */
  sourceImageUrl?: string | null;
  width?: number;
  height?: number;
  numFrames?: number;
  fps?: number;
  seed?: number;
  /** Optional Wan NSFW LoRA (HF repo id or .safetensors URL). */
  loraId?: string;
}

export interface UncensoredVideoResult {
  url: string;
  key: string;
  contentType: "video/mp4";
}

async function fetchAsBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`source image fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer()).toString("base64");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Produce an uncensored video and store it in R2. Throws PromptBlockedError if
 * the prompt is refused, or a plain Error if the GPU path is unavailable/fails.
 */
export async function generateUncensoredVideo(
  params: UncensoredVideoParams,
): Promise<UncensoredVideoResult> {
  // Backstop moderation — strict (any minor reference blocks on the NSFW path).
  const verdict = checkPrompt(params.prompt, { strictMinors: true });
  if (!verdict.allowed) {
    await logModerationBlock({
      category: verdict.category,
      promptLen: params.prompt.length,
      userId: params.userId,
      surface: "backstop:generateUncensoredVideo",
      prompt: params.prompt,
    });
    throw new PromptBlockedError(verdict);
  }

  if (!isRunPodAvailable()) {
    throw new Error("Uncensored video is temporarily unavailable (no GPU worker configured).");
  }

  const enhancedPrompt = `${params.prompt}. High quality, detailed, smooth natural motion. 100% fictional synthetic content, no real people depicted.`;

  const imageB64 = params.sourceImageUrl
    ? await fetchAsBase64(params.sourceImageUrl)
    : undefined;

  const mp4 = await runpodWanVideo({
    prompt: enhancedPrompt,
    imageB64,
    width: params.width,
    height: params.height,
    numFrames: params.numFrames,
    fps: params.fps,
    seed: params.seed,
    loraId: params.loraId,
  });

  const key = generateStorageKey("generations", "mp4");
  const { url } = await storagePut(key, mp4, "video/mp4");
  return { url, key, contentType: "video/mp4" };
}
