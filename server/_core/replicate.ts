/**
 * Shared Replicate API client — create predictions and poll for results.
 * Used by imageGeneration.ts, songGeneration.ts, audioGeneration.ts, and providers/replicate.ts.
 */

import { ENV } from "./env";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

export interface ReplicatePredictionOptions {
  /** Model identifier — either "owner/model" format or a full version hash. */
  model?: string;
  /** Full version hash (for version-pinned models). */
  version?: string;
  /** Input parameters for the model. */
  input: Record<string, unknown>;
  /** Max polling attempts (default 120 = 10 min at 5s intervals). */
  maxAttempts?: number;
  /** Polling interval in ms (default 5000). */
  pollInterval?: number;
}

export interface ReplicatePrediction {
  id: string;
  status: string;
  output: string | string[] | null;
  error: string | null;
  urls: { get: string };
}

/**
 * Create a Replicate prediction and wait for the result.
 * Uses "Prefer: wait" header for instant results, falls back to polling.
 * Returns the output URL string.
 */
export async function replicatePredict(options: ReplicatePredictionOptions): Promise<string> {
  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }

  const body: Record<string, unknown> = { input: options.input };
  if (options.model) body.model = options.model;
  if (options.version) body.version = options.version;

  const createController = new AbortController();
  const createTimeout = setTimeout(() => createController.abort(), 30000);
  const createResponse = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.replicateApiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify(body),
    signal: createController.signal,
  });
  clearTimeout(createTimeout);

  if (!createResponse.ok) {
    const detail = await createResponse.text().catch(() => "");
    throw new Error(
      `Replicate prediction failed (${createResponse.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const prediction = (await createResponse.json()) as ReplicatePrediction;

  if (prediction.error) {
    throw new Error(`Replicate error: ${prediction.error}`);
  }

  // If "Prefer: wait" resolved it, return output directly
  if (prediction.status === "succeeded" && prediction.output) {
    return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  }

  // Otherwise poll for completion
  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error ?? "Unknown"}`);
  }

  return pollForResult(
    prediction.urls?.get || `${REPLICATE_API_URL}/${prediction.id}`,
    options.maxAttempts ?? 120,
    options.pollInterval ?? 5000,
  );
}

/**
 * Poll a Replicate prediction URL until it completes or fails.
 */
async function pollForResult(
  getUrl: string,
  maxAttempts: number,
  intervalMs: number,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const pollController = new AbortController();
    const pollTimeout = setTimeout(() => pollController.abort(), 30000);
    const response = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${ENV.replicateApiToken}` },
      signal: pollController.signal,
    });
    clearTimeout(pollTimeout);

    if (!response.ok) continue;

    const data = (await response.json()) as ReplicatePrediction;

    if (data.status === "succeeded" && data.output) {
      return Array.isArray(data.output) ? data.output[0] : data.output;
    }

    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`Replicate prediction ${data.status}: ${data.error ?? "Unknown error"}`);
    }
  }

  throw new Error(`Replicate prediction timed out after ${Math.round((maxAttempts * intervalMs) / 60000)} minutes`);
}

/**
 * Download a remote URL and return as Buffer.
 */
export async function downloadBuffer(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`Failed to download from ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
