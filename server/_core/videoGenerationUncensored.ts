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
import { isRunPodAvailable, runpodWanSubmit, runpodJobStatus, getVideoEndpointId } from "./runpod";
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
  /** "fast" = 5B TI2V (~90s), "hd" = 14B A14B top quality (~2-4min on 80GB). */
  tier?: "fast" | "hd";
}

export type UncensoredVideoJobResult =
  | { status: "processing" }
  | { status: "completed"; url: string; key: string }
  | { status: "failed"; error?: string };

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
 * Phase 1 — moderate, then SUBMIT the Wan job and return its id immediately.
 * Video generation (cold start + inference) routinely outlasts a serverless
 * function's ceiling, so we never await it inline; the caller polls with
 * collectUncensoredVideoJob(). Throws PromptBlockedError if the prompt is
 * refused, or a plain Error if the GPU path is unavailable / submit fails.
 */
export async function submitUncensoredVideoJob(
  params: UncensoredVideoParams,
): Promise<{ jobId: string }> {
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

  const jobId = await runpodWanSubmit({
    prompt: enhancedPrompt,
    imageB64,
    width: params.width,
    height: params.height,
    numFrames: params.numFrames,
    fps: params.fps,
    seed: params.seed,
    loraId: params.loraId,
    tier: params.tier,
  });
  return { jobId };
}

/**
 * Phase 2 — poll a submitted Wan job. On completion, download the mp4 and store
 * it in R2 (fast, comfortably inside a request), returning the URL. Safe to call
 * repeatedly; the caller owns the atomic generation-row transition + refund.
 */
export async function collectUncensoredVideoJob(jobId: string): Promise<UncensoredVideoJobResult> {
  const st = await runpodJobStatus(jobId, getVideoEndpointId());
  if (st.status === "COMPLETED") {
    if (!st.videoB64) return { status: "failed", error: "GPU returned no video" };
    const key = generateStorageKey("generations", "mp4");
    const { url } = await storagePut(key, Buffer.from(st.videoB64, "base64"), "video/mp4");
    return { status: "completed", url, key };
  }
  if (st.status === "FAILED" || st.status === "CANCELLED") {
    return { status: "failed", error: st.error };
  }
  return { status: "processing" };
}
