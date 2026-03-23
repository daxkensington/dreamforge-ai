// @ts-nocheck — Dead code: old provider, replaced by Grok/OpenAI/Gemini
/**
 * Forge provider adapter — wraps the existing imageGeneration.ts logic.
 */

import { generateImage } from "../imageGeneration";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

export class ForgeProvider implements ProviderAdapter {
  readonly provider = "forge";

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    try {
      const { url } = await generateImage({
        prompt: request.prompt,
        originalImages: request.options?.originalImages as
          | Array<{ url?: string; b64Json?: string; mimeType?: string }>
          | undefined,
      });

      if (!url) {
        throw new Error("Forge generation returned no URL");
      }

      return {
        id: `forge-${Date.now()}`,
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
        `Forge generation failed: ${error.message || "Unknown error"}`
      );
    }
  }
}
