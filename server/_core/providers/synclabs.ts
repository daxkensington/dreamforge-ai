/**
 * Sync Labs provider adapter — lip sync via sync-3 model.
 * Auto-activates when SYNC_LABS_API_KEY is set.
 *
 * Takes a video URL + audio URL, returns a lip-synced video.
 */

import { storagePut } from "../../storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const SYNC_API_BASE = "https://api.sync.so/v2";

export class SyncLabsProvider implements ProviderAdapter {
  readonly provider = "synclabs";

  get isAvailable(): boolean {
    return !!ENV.syncLabsApiKey;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.syncLabsApiKey) {
      throw new Error(
        "Sync Labs API key is not configured. Set SYNC_LABS_API_KEY in your environment."
      );
    }

    const videoUrl = request.options?.videoUrl as string | undefined;
    const audioUrl = request.options?.audioUrl as string | undefined;

    if (!videoUrl || !audioUrl) {
      throw new Error("Sync Labs lip sync requires both videoUrl and audioUrl in options.");
    }

    try {
      // Submit the lip sync job
      const createResponse = await fetch(`${SYNC_API_BASE}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ENV.syncLabsApiKey,
        },
        body: JSON.stringify({
          model: request.model === "synclabs-lipsync-2" ? "lipsync-2-pro" : "sync-3",
          input: [
            { type: "video", url: videoUrl },
            { type: "audio", url: audioUrl },
          ],
          options: {
            output_format: "mp4",
          },
        }),
      });

      if (!createResponse.ok) {
        const detail = await createResponse.text().catch(() => "");
        throw new Error(
          `Sync Labs API error (${createResponse.status} ${createResponse.statusText})${detail ? `: ${detail}` : ""}`
        );
      }

      const { id: jobId } = (await createResponse.json()) as { id: string };

      // Poll for completion
      const outputUrl = await this.pollForResult(jobId);

      // Download the result (Sync Labs requires x-api-key for downloads)
      const downloadResponse = await fetch(outputUrl, {
        headers: { "x-api-key": ENV.syncLabsApiKey },
      });
      if (!downloadResponse.ok) {
        throw new Error("Failed to download Sync Labs output");
      }

      const buffer = Buffer.from(await downloadResponse.arrayBuffer());
      const { url } = await storagePut(
        `generated/synclabs-${Date.now()}.mp4`,
        buffer,
        "video/mp4"
      );

      return {
        id: `synclabs-${jobId}`,
        url,
        model: request.model,
        provider: this.provider,
        metadata: {
          videoUrl,
          audioUrl,
          syncLabsJobId: jobId,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Sync Labs lip sync failed: ${error.message || "Unknown error"}`
      );
    }
  }

  private async pollForResult(
    jobId: string,
    maxAttempts = 120,
    intervalMs = 5000
  ): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const jitter = Math.random() * 2000;
      await new Promise((resolve) => setTimeout(resolve, intervalMs + jitter));

      const response = await fetch(`${SYNC_API_BASE}/generate/${jobId}`, {
        headers: { "x-api-key": ENV.syncLabsApiKey },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as {
        status: string;
        outputUrl?: string;
        error?: string;
      };

      if (data.status === "COMPLETED" && data.outputUrl) {
        return data.outputUrl;
      }
      if (data.status === "FAILED") {
        throw new Error(
          `Sync Labs job failed: ${data.error || "Unknown error"}`
        );
      }
      // PENDING or PROCESSING — keep polling
    }

    throw new Error("Sync Labs lip sync timed out");
  }
}
