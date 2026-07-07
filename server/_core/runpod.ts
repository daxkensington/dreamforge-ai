/**
 * RunPod Serverless provider — self-hosted AI models at 50-90% lower cost.
 *
 * Single endpoint bundles:
 *   - Flux.1 Dev/Schnell (image generation)
 *   - Real-ESRGAN (image upscaling)
 *   - RMBG-2.0 (background removal)
 *
 * The handler routes to the correct model via the `task` field in the input.
 * Falls back to API providers (Replicate, etc.) if RunPod is unavailable.
 */

import { ENV } from "./env";

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RunPodTask =
  | "flux-dev"
  | "flux-schnell"
  | "flux-img2img"
  | "esrgan"
  | "rmbg"
  | "tryon"
  | "bark-tts"
  | "cogvideo"
  | "wan-t2v"
  | "wan-i2v"
  | "musicgen"
  | "audiogen";

export interface RunPodInput {
  task: RunPodTask;
  prompt?: string;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  /** Base64-encoded input image for upscale/bg-removal */
  image_b64?: string;
  /** Upscale factor for Real-ESRGAN (2 or 4) */
  scale?: number;
  /** Person image URL for virtual try-on */
  person_image_url?: string;
  /** Garment image URL for virtual try-on */
  garment_image_url?: string;
  /** Cloth type for virtual try-on */
  cloth_type?: string;
  /** Reproducible seed for Flux generation */
  seed?: number;
  /** HuggingFace LoRA repo ID for Flux */
  lora_id?: string;
  /** LoRA blending scale (0.0-1.0, default 0.8) */
  lora_scale?: number;
  /** Audio duration in seconds for musicgen/audiogen */
  duration?: number;
  /** Img2img strength (0.0-1.0, higher = more change) */
  strength?: number;
  /** Bark TTS voice preset */
  voice_preset?: string;
  /** Negative prompt (Wan video) */
  negative_prompt?: string;
  /** Frame count for Wan video (4k+1, clamped 49-121 in the worker) */
  num_frames?: number;
  /** Output frames-per-second for Wan video export */
  fps?: number;
  /** Wan quality tier: "fast" = 5B TI2V, "hd" = 14B A14B */
  tier?: "fast" | "hd";
}

interface RunPodRunResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: RunPodOutput;
  error?: string;
}

interface RunPodOutput {
  /** Base64-encoded output image */
  image_b64?: string;
  /** Output image URL (if handler returns URL) */
  image_url?: string;
  /** Base64-encoded audio output */
  audio_b64?: string;
  /** Base64-encoded video output */
  video_b64?: string;
  /** Inference time in seconds */
  inference_time?: number;
  /** Seed used for generation */
  seed?: number;
  /** Audio duration generated */
  duration?: number;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

function getEndpointUrl(path: string, endpointId?: string): string {
  const id = endpointId || ENV.runpodFluxEndpointId;
  if (!id) throw new Error("RUNPOD endpoint not configured");
  return `${RUNPOD_API_BASE}/${id}/${path}`;
}

/** Endpoint id to use for Wan video (dedicated if set, else the flux endpoint). */
function videoEndpointId(): string {
  return ENV.runpodVideoEndpointId || ENV.runpodFluxEndpointId;
}

export interface RunPodRunOpts {
  /** Override the endpoint (e.g. a bigger GPU pool for video). */
  endpointId?: string;
  /** Poll attempts (×2s). Video needs a longer ceiling than image. */
  maxAttempts?: number;
}

function getHeaders(): Record<string, string> {
  const apiKey = ENV.runpodApiKey;
  if (!apiKey) throw new Error("RUNPOD_API_KEY not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Check if RunPod self-hosted models are configured and available.
 */
export function isRunPodAvailable(): boolean {
  return !!(ENV.runpodApiKey && ENV.runpodFluxEndpointId);
}

/**
 * Submit a job to RunPod serverless and wait for the result.
 *
 * Always uses /run + status polling. /runsync was abandoned: a Flex-worker
 * cold start takes 2+ minutes (135s measured 2026-06-11), the 90s client
 * abort fired as an AbortError that didn't match the old fallback condition,
 * and every cold-start generation died with "This operation was aborted".
 * Polling adds ≤2s on a warm worker and survives cold starts up to 5 min.
 */
export async function runpodRun(input: RunPodInput, opts: RunPodRunOpts = {}): Promise<Buffer> {
  return runpodRunAsync(input, opts);
}

/**
 * Async run with polling — for longer jobs like Flux Dev (20 steps, ~15-20s)
 * and Wan video (minutes, incl. cold start — pass a larger maxAttempts).
 */
async function runpodRunAsync(input: RunPodInput, opts: RunPodRunOpts = {}): Promise<Buffer> {
  const endpointId = opts.endpointId;
  // Submit job
  const submitController = new AbortController();
  const submitTimeout = setTimeout(() => submitController.abort(), 30_000);

  const submitResponse = await fetch(getEndpointUrl("run", endpointId), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ input }),
    signal: submitController.signal,
  });
  clearTimeout(submitTimeout);

  if (!submitResponse.ok) {
    const detail = await submitResponse.text().catch(() => "");
    throw new Error(`RunPod run failed (${submitResponse.status}): ${detail}`);
  }

  const job = (await submitResponse.json()) as RunPodRunResponse;

  if (job.status === "FAILED") {
    throw new Error(`RunPod job failed: ${job.error ?? "Unknown error"}`);
  }

  // Poll for result (default 5 min; callers override for video). Poll every 2s.
  const maxAttempts = opts.maxAttempts ?? 150;
  const pollInterval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 15_000);

    const statusResponse = await fetch(getEndpointUrl(`status/${job.id}`, endpointId), {
      headers: getHeaders(),
      signal: pollController.signal,
    });
    clearTimeout(pollTimeout);

    if (!statusResponse.ok) continue;

    const status = (await statusResponse.json()) as RunPodRunResponse;

    if (status.status === "COMPLETED") {
      return extractOutput(status);
    }

    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`RunPod job ${status.status}: ${status.error ?? "Unknown error"}`);
    }
  }

  throw new Error(`RunPod job timed out after ${Math.round((maxAttempts * pollInterval) / 60000)} minutes`);
}

/**
 * Extract image buffer from a completed RunPod response.
 */
function extractOutput(result: RunPodRunResponse): Buffer {
  if (result.status === "FAILED") {
    throw new Error(`RunPod job failed: ${result.error ?? "Unknown error"}`);
  }

  if (result.status !== "COMPLETED" || !result.output) {
    throw new Error(`RunPod job not completed (status: ${result.status})`);
  }

  // Prefer base64 output (image or audio)
  if (result.output.image_b64) {
    return Buffer.from(result.output.image_b64, "base64");
  }

  if (result.output.audio_b64) {
    return Buffer.from(result.output.audio_b64, "base64");
  }

  if (result.output.video_b64) {
    return Buffer.from(result.output.video_b64, "base64");
  }

  // URL output requires a follow-up download
  if (result.output.image_url) {
    // Return a marker — caller should download
    throw new Error(`DOWNLOAD:${result.output.image_url}`);
  }

  throw new Error("RunPod returned no image data");
}

// ─── High-Level Functions ───────────────────────────────────────────────────

/**
 * Generate image with Flux Dev (20 steps, higher quality).
 */
export async function runpodFluxDev(
  prompt: string,
  width: number = 1024,
  height: number = 1024,
  steps: number = 20,
  guidanceScale: number = 7.5,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "flux-dev",
      prompt,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidanceScale,
    }),
  );
}

/**
 * Generate image with Flux Schnell (4 steps, fast).
 */
export async function runpodFluxSchnell(
  prompt: string,
  width: number = 1024,
  height: number = 1024,
  loraId?: string,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "flux-schnell",
      prompt,
      width,
      height,
      num_inference_steps: 4,
      ...(loraId ? { lora_id: loraId } : {}),
    }),
  );
}

/**
 * Upscale image with Real-ESRGAN (2x or 4x).
 */
export async function runpodUpscale(
  imageB64: string,
  scale: number = 4,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "esrgan",
      image_b64: imageB64,
      scale,
    }),
  );
}

/**
 * Remove background with RMBG-2.0.
 */
export async function runpodRemoveBackground(
  imageB64: string,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "rmbg",
      image_b64: imageB64,
    }),
  );
}

/**
 * Text-to-speech with Bark (natural AI voiceovers).
 */
export async function runpodBarkTTS(
  text: string,
  voicePreset: string = "v2/en_speaker_6",
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "bark-tts",
      prompt: text,
      voice_preset: voicePreset,
    }),
  );
}

/**
 * Img2img with Flux — real diffusion-based image transformation.
 * Replaces the LLM describe-then-generate hack for dramatically better quality.
 */
export async function runpodFluxImg2Img(
  imageB64: string,
  prompt: string,
  strength: number = 0.7,
  steps: number = 20,
  guidanceScale: number = 7.5,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "flux-img2img",
      image_b64: imageB64,
      prompt,
      strength,
      num_inference_steps: steps,
      guidance_scale: guidanceScale,
    }),
  );
}

/**
 * Generate video with CogVideoX-5B (text-to-video).
 * ~$0.07-0.18/video vs $0.50-1.00 on API providers.
 */
/**
 * Generate video with CogVideoX-5B (text-to-video).
 * ~$0.07-0.18/video vs $0.50-1.00 on API providers.
 */
export async function runpodCogVideo(
  prompt: string,
  numFrames: number = 49,
  steps: number = 50,
  guidanceScale: number = 6.0,
): Promise<Buffer> {
  // CogVideoX uses a custom input shape — pass num_frames directly
  const input: RunPodInput = {
    task: "cogvideo",
    prompt,
    num_inference_steps: steps,
    guidance_scale: guidanceScale,
  };
  // Add num_frames to the input (handler reads it from job_input)
  (input as any).num_frames = numFrames;
  return handleRunpodResult(runpodRun(input));
}

/** Endpoint id used for Wan video jobs (exported for async status polling). */
export function getVideoEndpointId(): string {
  return videoEndpointId();
}

/**
 * Submit a job to RunPod and return its id immediately WITHOUT polling. For
 * long jobs (video) that can outlast a serverless function: submit here, then
 * poll runpodJobStatus() from a separate short request.
 */
export async function runpodSubmit(input: RunPodInput, opts: RunPodRunOpts = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const res = await fetch(getEndpointUrl("run", opts.endpointId), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ input }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`RunPod submit failed (${res.status}): ${detail}`);
  }
  const job = (await res.json()) as RunPodRunResponse;
  if (job.status === "FAILED") throw new Error(`RunPod job failed: ${job.error ?? "Unknown error"}`);
  return job.id;
}

export interface RunPodJobState {
  status: RunPodRunResponse["status"];
  videoB64?: string;
  error?: string;
}

/** Poll a submitted job's status. Transient HTTP errors read as still-running. */
export async function runpodJobStatus(jobId: string, endpointId?: string): Promise<RunPodJobState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(getEndpointUrl(`status/${jobId}`, endpointId), { headers: getHeaders(), signal: controller.signal });
  } catch {
    return { status: "IN_PROGRESS" };
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) return { status: "IN_PROGRESS" };
  const s = (await res.json()) as RunPodRunResponse;
  return { status: s.status, videoB64: s.output?.video_b64, error: s.error };
}

/** Submit a Wan video job (T2V or I2V) and return the job id (no wait). */
export async function runpodWanSubmit(params: {
  prompt: string;
  imageB64?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numFrames?: number;
  steps?: number;
  guidanceScale?: number;
  fps?: number;
  seed?: number;
  loraId?: string;
  loraScale?: number;
  tier?: "fast" | "hd";
}): Promise<string> {
  const input: RunPodInput = {
    task: params.imageB64 ? "wan-i2v" : "wan-t2v",
    tier: params.tier ?? "fast",
    prompt: params.prompt,
    negative_prompt: params.negativePrompt,
    width: params.width,
    height: params.height,
    num_frames: params.numFrames,
    num_inference_steps: params.steps,
    guidance_scale: params.guidanceScale,
    fps: params.fps,
    seed: params.seed,
    lora_id: params.loraId,
    lora_scale: params.loraScale,
    ...(params.imageB64 ? { image_b64: params.imageB64 } : {}),
  };
  return runpodSubmit(input, { endpointId: videoEndpointId() });
}

/**
 * Generate an uncensored video with Wan 2.2 TI2V-5B (self-hosted).
 *
 * Text-to-video when `imageB64` is omitted, image-to-video (animate a source
 * frame) when provided. Runs on the dedicated video endpoint if configured,
 * else the flux endpoint. Returns raw mp4 bytes. No API fallback exists — every
 * external video provider rejects NSFW, so this is self-hosted-only by design.
 */
export async function runpodWanVideo(params: {
  prompt: string;
  imageB64?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numFrames?: number;
  steps?: number;
  guidanceScale?: number;
  fps?: number;
  seed?: number;
  loraId?: string;
  loraScale?: number;
}): Promise<Buffer> {
  const input: RunPodInput = {
    task: params.imageB64 ? "wan-i2v" : "wan-t2v",
    prompt: params.prompt,
    negative_prompt: params.negativePrompt,
    width: params.width,
    height: params.height,
    num_frames: params.numFrames,
    num_inference_steps: params.steps,
    guidance_scale: params.guidanceScale,
    fps: params.fps,
    seed: params.seed,
    lora_id: params.loraId,
    lora_scale: params.loraScale,
    ...(params.imageB64 ? { image_b64: params.imageB64 } : {}),
  };
  // Video is minutes-long incl. cold start — 450×2s = 15 min ceiling.
  return handleRunpodResult(runpodRun(input, { endpointId: videoEndpointId(), maxAttempts: 450 }));
}

/**
 * Generate music with MusicGen (stereo-large).
 */
export async function runpodMusicGen(
  prompt: string,
  duration: number = 30,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "musicgen",
      prompt,
      duration,
    }),
  );
}

/**
 * Generate sound effects with AudioGen.
 */
export async function runpodAudioGen(
  prompt: string,
  duration: number = 5,
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "audiogen",
      prompt,
      duration,
    }),
  );
}

/**
 * Virtual try-on with CatVTON — overlay garment onto person.
 */
export async function runpodTryOn(
  personImageUrl: string,
  garmentImageUrl: string,
  clothType: string = "upper",
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "tryon",
      person_image_url: personImageUrl,
      garment_image_url: garmentImageUrl,
      cloth_type: clothType,
    }),
  );
}

/**
 * Handle RunPod result — if the output is a URL, download it.
 */
async function handleRunpodResult(promise: Promise<Buffer>): Promise<Buffer> {
  try {
    return await promise;
  } catch (err: any) {
    if (err.message?.startsWith("DOWNLOAD:")) {
      const url = err.message.replace("DOWNLOAD:", "");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Failed to download RunPod output: ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    }
    throw err;
  }
}
