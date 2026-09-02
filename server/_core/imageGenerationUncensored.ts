/**
 * Uncensored IMAGE generation as an async job — submit, then collect.
 *
 * Why this exists: the free preview and the paid studio used to hold one HTTP
 * request open for the whole GPU round-trip. Measured on prod 2026-09-02, one
 * click on "Generate (free)" took 237s, and the connection was silently
 * re-sent partway through, so the SAME prompt ran TWICE — burning two of the
 * three lifetime free previews and showing the user only the second result.
 * Four of the six users who had "used all 3 previews" had these duplicates.
 *
 * Splitting submit from collect (the same shape as videoGenerationUncensored)
 * means the browser holds a request open for ~1s, polls a cheap status query,
 * survives a tab-away, and a transport retry can be de-duplicated by the
 * client's requestId instead of re-running the GPU job.
 *
 * Self-hosted RunPod only, same as generateUnfiltered's primary. When RunPod is
 * not configured the router falls back to the synchronous chain (fal Schnell,
 * safety checker off), which is fast enough to stay inline.
 */
import { checkPrompt, logModerationBlock, PromptBlockedError } from "./promptModeration";
import { isRunPodAvailable, runpodSubmit, runpodJobStatus, getImageEndpointId } from "./runpod";
import { storagePut, generateStorageKey } from "../storage";

export interface UnfilteredImageJobParams {
  prompt: string;
  width: number;
  height: number;
  /** Optional Flux LoRA (HF repo id, `repo::file`, or .safetensors URL). */
  loraId?: string;
  seed?: number;
  /** "quality" = Flux Dev 20 steps; default "fast" = Flux Schnell 4 steps. */
  quality?: "fast" | "quality";
  /**
   * Source frame for img2img (character lock / refine). MUST already be one of
   * the caller's own generations — the router resolves it, this layer never
   * accepts uploads (see refineUnfiltered for why).
   */
  imageB64?: string;
  /** img2img strength; clamped 0.2–0.9 like refineUnfiltered. */
  strength?: number;
}

export type UnfilteredImageJobResult =
  | { status: "processing" }
  | { status: "completed"; url: string; key: string }
  | { status: "failed"; error?: string };

/** True when the async self-hosted path can be used at all. */
export function canSubmitUnfilteredImageJob(): boolean {
  return isRunPodAvailable();
}

/**
 * Submit a Flux job and return its RunPod id without waiting.
 *
 * Runs the illegal-content backstop first, exactly like generateUnfiltered:
 * a refusal here means a surface gate was bypassed and is logged.
 */
export async function submitUnfilteredImageJob(params: UnfilteredImageJobParams): Promise<{ jobId: string }> {
  const verdict = checkPrompt(params.prompt, { strictMinors: true });
  if (!verdict.allowed) {
    await logModerationBlock({
      category: verdict.category,
      promptLen: params.prompt.length,
      surface: "backstop:submitUnfilteredImageJob",
      prompt: params.prompt,
    });
    throw new PromptBlockedError(verdict);
  }
  const lora = params.loraId ? { lora_id: params.loraId } : {};
  const seed = typeof params.seed === "number" ? { seed: params.seed } : {};
  if (params.imageB64) {
    // Same clamp as refineUnfiltered: below ~0.2 nothing visibly changes, at
    // 1.0 the source is discarded and it's just text-to-image.
    const strength = Math.min(Math.max(params.strength ?? 0.6, 0.2), 0.9);
    const jobId = await runpodSubmit(
      {
        task: "flux-img2img",
        image_b64: params.imageB64,
        prompt: params.prompt,
        strength,
        num_inference_steps: 20,
        guidance_scale: 7.5,
        ...lora,
        ...seed,
      },
      { endpointId: getImageEndpointId() },
    );
    return { jobId };
  }
  const dev = params.quality === "quality";
  const jobId = await runpodSubmit(
    {
      task: dev ? "flux-dev" : "flux-schnell",
      prompt: params.prompt,
      width: params.width,
      height: params.height,
      num_inference_steps: dev ? 20 : 4,
      ...(dev ? { guidance_scale: 7.5 } : {}),
      ...lora,
      ...seed,
    },
    { endpointId: getImageEndpointId() },
  );
  return { jobId };
}

/**
 * Poll a submitted image job. On COMPLETED the PNG is (optionally)
 * watermarked and stored to R2; the caller owns the generating→completed
 * claim so concurrent polls can't double-write the row.
 */
export async function collectUnfilteredImageJob(
  jobId: string,
  opts: { watermark: boolean },
): Promise<UnfilteredImageJobResult> {
  const st = await runpodJobStatus(jobId, getImageEndpointId());
  if (st.status === "COMPLETED") {
    let buffer: Buffer | null = null;
    if (st.imageB64) {
      buffer = Buffer.from(st.imageB64, "base64");
    } else if (st.imageUrl) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(st.imageUrl, { signal: controller.signal });
        if (res.ok) buffer = Buffer.from(await res.arrayBuffer());
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!buffer) return { status: "failed", error: st.error ?? "GPU returned no image" };
    if (opts.watermark) {
      const { addImageWatermark } = await import("./watermark");
      buffer = await addImageWatermark(buffer);
    }
    const key = generateStorageKey("generations", "png");
    const { url } = await storagePut(key, buffer, "image/png");
    return { status: "completed", url, key };
  }
  if (st.status === "FAILED" || st.status === "CANCELLED") {
    return { status: "failed", error: st.error };
  }
  return { status: "processing" };
}
