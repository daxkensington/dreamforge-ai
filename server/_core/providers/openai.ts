/**
 * OpenAI provider adapter — DALL-E 3 image generation.
 */

import { storagePut } from "server/storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export class OpenAIProvider implements ProviderAdapter {
  readonly provider = "openai";

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.openaiApiKey) {
      throw new Error(
        "OpenAI API key is not configured. Set OPENAI_API_KEY in your environment."
      );
    }

    try {
      // DALL-E 3 supports specific size presets
      const size = this.resolveSize(request.width, request.height);

      const response = await fetch(`${OPENAI_API_BASE}/images/generations`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: request.prompt,
          n: 1,
          size,
          quality: request.options?.quality === "hd" ? "hd" : "standard",
          response_format: "b64_json",
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `OpenAI API error (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
        );
      }

      const result = (await response.json()) as {
        data: Array<{ b64_json: string; revised_prompt?: string }>;
      };

      const imageData = result.data[0];
      if (!imageData?.b64_json) {
        throw new Error("OpenAI API returned no image data");
      }

      const buffer = Buffer.from(imageData.b64_json, "base64");
      const { url } = await storagePut(
        `generated/openai-${Date.now()}.png`,
        buffer,
        "image/png"
      );

      return {
        id: `openai-${Date.now()}`,
        url,
        model: request.model,
        provider: this.provider,
        metadata: {
          width: request.width,
          height: request.height,
          prompt: request.prompt,
          revisedPrompt: imageData.revised_prompt,
        },
      };
    } catch (error: any) {
      throw new Error(
        `OpenAI generation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  /** Map arbitrary dimensions to the closest DALL-E 3 preset. */
  private resolveSize(
    width?: number,
    height?: number
  ): "1024x1024" | "1792x1024" | "1024x1792" {
    if (!width || !height) return "1024x1024";
    const ratio = width / height;
    if (ratio > 1.3) return "1792x1024";
    if (ratio < 0.77) return "1024x1792";
    return "1024x1024";
  }
}
