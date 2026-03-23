/**
 * Grok (xAI) provider adapter — image generation via xAI API.
 * Tries grok-2-image first, falls back to grok-imagine-image.
 */

import { storagePut, generateStorageKey } from "../../storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const GROK_API_BASE = "https://api.x.ai/v1";
const GROK_IMAGE_MODELS = ["grok-2-image", "grok-imagine-image"];

export class GrokProvider implements ProviderAdapter {
  readonly provider = "grok";

  get isAvailable(): boolean {
    return !!ENV.grokApiKey;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.grokApiKey) {
      throw new Error(
        "Grok API key is not configured. Set GROK_API_KEY in your environment.",
      );
    }

    const size = this.resolveSize(request.width, request.height);
    let lastError: Error | null = null;

    for (const model of GROK_IMAGE_MODELS) {
      try {
        const response = await fetch(`${GROK_API_BASE}/images/generations`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${ENV.grokApiKey}`,
          },
          body: JSON.stringify({
            model,
            prompt: request.prompt,
            n: 1,
            size,
            response_format: "b64_json",
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          lastError = new Error(
            `Grok ${model} error (${response.status})${detail ? `: ${detail}` : ""}`,
          );
          continue;
        }

        const result = (await response.json()) as any;

        // Handle base64 response
        const b64 = result.data?.[0]?.b64_json;
        if (b64) {
          const buffer = Buffer.from(b64, "base64");
          const key = generateStorageKey("generations", "png");
          const { url } = await storagePut(key, buffer, "image/png");

          return {
            id: `grok-${Date.now()}`,
            url,
            model: request.model,
            provider: this.provider,
            metadata: {
              width: request.width,
              height: request.height,
              prompt: request.prompt,
              grokModel: model,
            },
          };
        }

        // Handle URL response as fallback
        const imageUrl = result.data?.[0]?.url;
        if (imageUrl) {
          const imageResp = await fetch(imageUrl);
          if (!imageResp.ok) {
            lastError = new Error(`Failed to download Grok image: ${imageResp.status}`);
            continue;
          }
          const buffer = Buffer.from(await imageResp.arrayBuffer());
          const key = generateStorageKey("generations", "png");
          const { url } = await storagePut(key, buffer, "image/png");

          return {
            id: `grok-${Date.now()}`,
            url,
            model: request.model,
            provider: this.provider,
            metadata: {
              width: request.width,
              height: request.height,
              prompt: request.prompt,
              grokModel: model,
            },
          };
        }

        lastError = new Error(`Grok ${model} returned no image data`);
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError ?? new Error("Grok image generation failed");
  }

  /** Grok accepts standard size strings; pass through or default. */
  private resolveSize(width?: number, height?: number): string {
    if (!width || !height) return "1024x1024";
    return `${width}x${height}`;
  }
}
