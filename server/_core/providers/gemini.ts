/**
 * Gemini (Google) provider adapter — image generation via Gemini REST API.
 * Uses gemini-2.0-flash-preview-image-generation with responseModalities: ["TEXT", "IMAGE"].
 */

import { storagePut, generateStorageKey } from "../../storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation";

export class GeminiProvider implements ProviderAdapter {
  readonly provider = "gemini";

  get isAvailable(): boolean {
    return !!ENV.geminiApiKey;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!ENV.geminiApiKey) {
      throw new Error(
        "Gemini API key is not configured. Set GEMINI_API_KEY in your environment.",
      );
    }

    const url = `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${ENV.geminiApiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Gemini image gen error (${response.status})${detail ? `: ${detail}` : ""}`,
      );
    }

    const result = (await response.json()) as any;

    // Extract the image from the response candidates
    const candidates = result.candidates ?? [];
    let textResponse = "";

    for (const candidate of candidates) {
      const parts = candidate.content?.parts ?? [];
      for (const part of parts) {
        // Collect any text response
        if (part.text) {
          textResponse = part.text;
        }

        // Find inline image data (handles both camelCase and snake_case)
        const inlineData = part.inlineData ?? part.inline_data;
        if (inlineData?.data) {
          const mimeType = inlineData.mimeType ?? inlineData.mime_type ?? "image/png";
          const extension = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

          const buffer = Buffer.from(inlineData.data, "base64");
          const key = generateStorageKey("generations", extension);
          const { url: storageUrl } = await storagePut(key, buffer, mimeType);

          return {
            id: `gemini-${Date.now()}`,
            url: storageUrl,
            model: request.model,
            provider: this.provider,
            metadata: {
              width: request.width,
              height: request.height,
              prompt: request.prompt,
              geminiModel: GEMINI_IMAGE_MODEL,
              textResponse,
            },
          };
        }
      }
    }

    throw new Error("Gemini returned no image data in response");
  }
}
