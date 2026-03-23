// @ts-nocheck — Dead code: old provider, replaced by Grok/OpenAI/Gemini
/**
 * Stability AI provider adapter — Stable Diffusion XL / Stable Video via REST API.
 */

import { storagePut } from "server/storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const STABILITY_API_BASE = "https://api.stability.ai/v2beta";

export class StabilityProvider implements ProviderAdapter {
  readonly provider = "stability";

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.stabilityApiKey) {
      throw new Error(
        "Stability AI API key is not configured. Set STABILITY_API_KEY in your environment."
      );
    }

    try {
      const endpoint =
        request.model === "stable-video"
          ? `${STABILITY_API_BASE}/image-to-video`
          : `${STABILITY_API_BASE}/stable-image/generate/sd3`;

      const body: Record<string, unknown> = {
        prompt: request.prompt,
        output_format: "png",
      };

      if (request.negativePrompt) {
        body.negative_prompt = request.negativePrompt;
      }
      if (request.width) body.width = request.width;
      if (request.height) body.height = request.height;
      if (request.steps) body.steps = request.steps;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${ENV.stabilityApiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Stability API error (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
        );
      }

      const result = (await response.json()) as {
        image?: string;
        artifacts?: Array<{ base64: string }>;
        video?: string;
      };

      let url: string;

      if (result.video) {
        // Video result — base64 encoded mp4
        const buffer = Buffer.from(result.video, "base64");
        const stored = await storagePut(
          `generated/stability-${Date.now()}.mp4`,
          buffer,
          "video/mp4"
        );
        url = stored.url;
      } else {
        // Image result
        const b64 =
          result.image || result.artifacts?.[0]?.base64;
        if (!b64) {
          throw new Error("Stability API returned no image data");
        }
        const buffer = Buffer.from(b64, "base64");
        const stored = await storagePut(
          `generated/stability-${Date.now()}.png`,
          buffer,
          "image/png"
        );
        url = stored.url;
      }

      return {
        id: `stability-${Date.now()}`,
        url,
        model: request.model,
        provider: this.provider,
        metadata: {
          width: request.width,
          height: request.height,
          prompt: request.prompt,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Stability generation failed: ${error.message || "Unknown error"}`
      );
    }
  }
}
