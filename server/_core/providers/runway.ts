/**
 * Runway provider adapter — Gen4.5, Gen4 Turbo video generation.
 * Auto-activates when RUNWAY_API_KEY is set.
 */

import { storagePut } from "../../storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const RUNWAY_API_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_API_VERSION = "2024-11-06";

/** Runway model identifiers. */
const MODEL_IDS: Record<string, string> = {
  "runway-gen4.5": "gen4.5",
  "runway-gen4-turbo": "gen4_turbo",
};

/** Supported resolutions per model. */
const RESOLUTIONS: Record<string, string> = {
  "1920:1080": "1280:720", // Runway max is 1280:720, we upscale after
  "1280:720": "1280:720",
  "720:1280": "720:1280",
  "960:960": "960:960",
};

export class RunwayProvider implements ProviderAdapter {
  readonly provider = "runway";

  get isAvailable(): boolean {
    return !!ENV.runwayApiKey;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.runwayApiKey) {
      throw new Error(
        "Runway API key is not configured. Set RUNWAY_API_KEY in your environment."
      );
    }

    const modelId = MODEL_IDS[request.model];
    if (!modelId) {
      throw new Error(`Unsupported Runway model: ${request.model}`);
    }

    try {
      const isImageToVideo = !!request.options?.imageUrl;
      const endpoint = isImageToVideo ? "image_to_video" : "text_to_video";

      const body: Record<string, unknown> = {
        model: modelId,
        promptText: request.prompt,
        ratio: "1280:720",
        duration: (request.options?.duration as number) || 10,
        watermark: false,
      };

      if (isImageToVideo) {
        body.promptImage = request.options!.imageUrl;
      }

      // Create task
      const createResponse = await fetch(`${RUNWAY_API_BASE}/${endpoint}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.runwayApiKey}`,
          "x-runway-version": RUNWAY_API_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!createResponse.ok) {
        const detail = await createResponse.text().catch(() => "");
        throw new Error(
          `Runway API error (${createResponse.status} ${createResponse.statusText})${detail ? `: ${detail}` : ""}`
        );
      }

      const { id: taskId } = (await createResponse.json()) as { id: string };

      // Poll for completion
      const output = await this.pollForResult(taskId);

      // Download and store the video
      const downloadResponse = await fetch(output);
      if (!downloadResponse.ok) {
        throw new Error("Failed to download Runway output");
      }

      const buffer = Buffer.from(await downloadResponse.arrayBuffer());
      const { url } = await storagePut(
        `generated/runway-${Date.now()}.mp4`,
        buffer,
        "video/mp4"
      );

      return {
        id: `runway-${taskId}`,
        url,
        model: request.model,
        provider: this.provider,
        metadata: {
          prompt: request.prompt,
          duration: body.duration,
          runwayTaskId: taskId,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Runway generation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  private async pollForResult(
    taskId: string,
    maxAttempts = 120,
    intervalMs = 5000
  ): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      // Add jitter to avoid thundering herd
      const jitter = Math.random() * 2000;
      await new Promise((resolve) => setTimeout(resolve, intervalMs + jitter));

      const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        headers: {
          authorization: `Bearer ${ENV.runwayApiKey}`,
          "x-runway-version": RUNWAY_API_VERSION,
        },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as {
        status: string;
        output: string[] | null;
        failureCode?: string;
      };

      if (data.status === "SUCCEEDED" && data.output?.[0]) {
        return data.output[0];
      }
      if (data.status === "FAILED") {
        throw new Error(
          `Runway task failed: ${data.failureCode || "Unknown error"}`
        );
      }
      if (data.status === "CANCELED") {
        throw new Error("Runway task was canceled");
      }
    }

    throw new Error("Runway generation timed out");
  }
}
