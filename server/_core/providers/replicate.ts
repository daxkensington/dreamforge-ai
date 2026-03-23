// @ts-nocheck — Dead code: old provider, replaced by Grok/OpenAI/Gemini
/**
 * Replicate provider adapter — Flux Pro, Minimax Video, Bark TTS, etc.
 */

import { storagePut } from "server/storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

/** Replicate model version identifiers for each supported model. */
const MODEL_VERSIONS: Record<string, string> = {
  "flux-pro": "black-forest-labs/flux-pro",
  "minimax-video": "minimax/video-01",
  "bark-tts": "suno-ai/bark",
};

export class ReplicateProvider implements ProviderAdapter {
  readonly provider = "replicate";

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.replicateApiToken) {
      throw new Error(
        "Replicate API token is not configured. Set REPLICATE_API_TOKEN in your environment."
      );
    }

    const modelVersion = MODEL_VERSIONS[request.model];
    if (!modelVersion) {
      throw new Error(`Unsupported Replicate model: ${request.model}`);
    }

    try {
      // Create a prediction
      const input = this.buildInput(request);

      const createResponse = await fetch(`${REPLICATE_API_BASE}/predictions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.replicateApiToken}`,
          prefer: "wait",
        },
        body: JSON.stringify({
          model: modelVersion,
          input,
        }),
      });

      if (!createResponse.ok) {
        const detail = await createResponse.text().catch(() => "");
        throw new Error(
          `Replicate API error (${createResponse.status} ${createResponse.statusText})${detail ? `: ${detail}` : ""}`
        );
      }

      const prediction = (await createResponse.json()) as {
        id: string;
        status: string;
        output: string | string[] | null;
        error?: string;
      };

      if (prediction.error) {
        throw new Error(`Replicate prediction error: ${prediction.error}`);
      }

      // If the prediction isn't done yet (no "prefer: wait" support), poll for it
      let output = prediction.output;
      if (!output && prediction.status !== "failed") {
        output = await this.pollForResult(prediction.id);
      }

      if (!output) {
        throw new Error("Replicate prediction returned no output");
      }

      // Output can be a single URL string or an array of URLs
      const outputUrl = Array.isArray(output) ? output[0] : output;

      // Download and store the result
      const downloadResponse = await fetch(outputUrl);
      if (!downloadResponse.ok) {
        throw new Error("Failed to download Replicate output");
      }

      const contentType =
        downloadResponse.headers.get("content-type") || "image/png";
      const ext = contentType.includes("video")
        ? "mp4"
        : contentType.includes("audio")
          ? "wav"
          : "png";

      const buffer = Buffer.from(await downloadResponse.arrayBuffer());
      const { url } = await storagePut(
        `generated/replicate-${Date.now()}.${ext}`,
        buffer,
        contentType
      );

      return {
        id: `replicate-${prediction.id}`,
        url,
        model: request.model,
        provider: this.provider,
        metadata: {
          width: request.width,
          height: request.height,
          prompt: request.prompt,
          replicateId: prediction.id,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Replicate generation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  private buildInput(request: GenerationRequest): Record<string, unknown> {
    const base: Record<string, unknown> = { prompt: request.prompt };

    if (request.model === "flux-pro") {
      if (request.width) base.width = request.width;
      if (request.height) base.height = request.height;
      if (request.steps) base.num_inference_steps = request.steps;
      if (request.negativePrompt) {
        base.negative_prompt = request.negativePrompt;
      }
    } else if (request.model === "minimax-video") {
      base.prompt_optimizer = true;
    } else if (request.model === "bark-tts") {
      base.text_prompt = request.prompt;
      delete base.prompt;
    }

    // Merge any extra options
    if (request.options) {
      Object.assign(base, request.options);
    }

    return base;
  }

  private async pollForResult(
    predictionId: string,
    maxAttempts = 60,
    intervalMs = 2000
  ): Promise<string | string[] | null> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const response = await fetch(
        `${REPLICATE_API_BASE}/predictions/${predictionId}`,
        {
          headers: {
            authorization: `Bearer ${ENV.replicateApiToken}`,
          },
        }
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        status: string;
        output: string | string[] | null;
        error?: string;
      };

      if (data.status === "succeeded" && data.output) {
        return data.output;
      }
      if (data.status === "failed") {
        throw new Error(
          `Replicate prediction failed: ${data.error || "Unknown error"}`
        );
      }
    }

    throw new Error("Replicate prediction timed out");
  }
}
