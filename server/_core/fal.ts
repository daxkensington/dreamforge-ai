/**
 * fal.ai queue client — shared submit + poll helper.
 *
 * Added 2026-06-12 when the Replicate token died and several features
 * (song gen, minimax video, audio-video sync) were ported to fal.ai, which
 * hosts the same underlying models. Polls the status_url/response_url the
 * submit response provides — never URLs built from the model path, which
 * 404 for subpath models like "fal-ai/flux/schnell" (the bug that fake-
 * timed-out every fal image call until 2026-06-11).
 */
import { ENV } from "./env";

export function isFalAvailable(): boolean {
  return !!ENV.falApiKey;
}

export interface FalRunOptions {
  /** Poll interval in ms (default 3000) */
  pollInterval?: number;
  /** Max polls before giving up (default 100 → 5 min at 3s) */
  maxPolls?: number;
}

/**
 * Submit a job to a fal.ai queue endpoint and wait for the result JSON.
 * Throws with the model id in the message on submit failure, job failure,
 * or timeout.
 */
export async function falRun<T = Record<string, unknown>>(
  model: string,
  input: Record<string, unknown>,
  options: FalRunOptions = {},
): Promise<T> {
  const apiKey = ENV.falApiKey;
  if (!apiKey) throw new Error("fal.ai API key not configured");

  const pollInterval = options.pollInterval ?? 3000;
  const maxPolls = options.maxPolls ?? 100;
  const headers = { Authorization: `Key ${apiKey}` };

  const submitResponse = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!submitResponse.ok) {
    const detail = await submitResponse.text().catch(() => "");
    throw new Error(`fal.ai ${model} submit failed (${submitResponse.status}): ${detail}`);
  }

  const submitted = (await submitResponse.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };
  if (!submitted.request_id || !submitted.status_url || !submitted.response_url) {
    throw new Error(`fal.ai ${model} returned no request_id/status_url`);
  }

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const statusResp = await fetch(submitted.status_url, { headers });
    if (!statusResp.ok) continue;

    const status = (await statusResp.json()) as { status: string; error?: string };

    if (status.status === "COMPLETED") {
      const resultResp = await fetch(submitted.response_url, { headers });
      if (!resultResp.ok) {
        throw new Error(`fal.ai ${model}: failed to fetch result (${resultResp.status})`);
      }
      return (await resultResp.json()) as T;
    }

    if (status.status === "FAILED") {
      throw new Error(`fal.ai ${model} failed: ${status.error || "Unknown error"}`);
    }
  }

  throw new Error(`fal.ai ${model} timed out after ${Math.round((maxPolls * pollInterval) / 60000)} min`);
}

/** A fal File object as returned in output payloads. */
export interface FalFile {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
}
