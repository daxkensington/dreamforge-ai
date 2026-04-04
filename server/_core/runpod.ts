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
  | "esrgan"
  | "rmbg";

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
  /** Inference time in seconds */
  inference_time?: number;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

function getEndpointUrl(path: string): string {
  const endpointId = ENV.runpodFluxEndpointId;
  if (!endpointId) throw new Error("RUNPOD_FLUX_ENDPOINT_ID not configured");
  return `${RUNPOD_API_BASE}/${endpointId}/${path}`;
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
 * Uses /runsync for fast jobs (<30s), falls back to /run + polling for longer jobs.
 */
export async function runpodRun(input: RunPodInput): Promise<Buffer> {
  // Try synchronous first (works for most image gen, upscale, bg removal)
  try {
    return await runpodRunSync(input);
  } catch (err: any) {
    // If it timed out on runsync, fall back to async polling
    if (err.message?.includes("timed out") || err.message?.includes("408")) {
      console.warn("[RunPod] Sync timed out, falling back to async polling");
      return runpodRunAsync(input);
    }
    throw err;
  }
}

/**
 * Synchronous run — blocks until the job completes (up to 90s).
 * Best for Flux Schnell (4 steps, ~5s) and utility models.
 */
async function runpodRunSync(input: RunPodInput): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  const response = await fetch(getEndpointUrl("runsync"), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ input }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`RunPod runsync failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as RunPodRunResponse;
  return extractOutput(result);
}

/**
 * Async run with polling — for longer jobs like Flux Dev (20 steps, ~15-20s).
 */
async function runpodRunAsync(input: RunPodInput): Promise<Buffer> {
  // Submit job
  const submitController = new AbortController();
  const submitTimeout = setTimeout(() => submitController.abort(), 30_000);

  const submitResponse = await fetch(getEndpointUrl("run"), {
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

  // Poll for result (max 5 min, poll every 2s)
  const maxAttempts = 150;
  const pollInterval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 15_000);

    const statusResponse = await fetch(getEndpointUrl(`status/${job.id}`), {
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

  // Prefer base64 output
  if (result.output.image_b64) {
    return Buffer.from(result.output.image_b64, "base64");
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
): Promise<Buffer> {
  return handleRunpodResult(
    runpodRun({
      task: "flux-schnell",
      prompt,
      width,
      height,
      num_inference_steps: 4,
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
