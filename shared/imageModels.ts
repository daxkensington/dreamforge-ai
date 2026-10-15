/** Existing standard image executors; adding a registry entry does not enable a provider. */
export type ImageExecutionKey =
  | "grok"
  | "grok-imagine-image-2.0"
  | "gpt-image-2.5-flare"
  | "gpt-image-2.5-sunburst"
  | "dall-e-3"
  | "gemini"
  | "flux-pro"
  | "flux-schnell"
  | "sd3"
  | "together"
  | "cloudflare"
  | "ultra"
  | "runpod-flux-dev"
  | "runpod-flux-schnell"
  | "fal-flux-dev"
  | "fal-flux-schnell"
  | "fal-flux-pro-ultra"
  | "fal-seedream";

/** Successful upstream route. Model names may be provider aliases, not pinned revisions. */
export interface ImageGenerationProvenance {
  provider: string;
  model: string;
  requestedModel: string;
  /** An earlier eligible execution attempt failed before this output succeeded. */
  fallbackUsed: boolean;
  /** Explicit request controls, provider echoes, and decoded output are distinct. */
  direct?: {
    provider: "openai" | "xai";
    requestedModelId: string;
    providerModel: string;
    providerRequestId?: string;
    requestedSize: { width: number; height: number };
    request: { model: string; quality: "medium"; n: 1; size?: string; resolution?: "1k"; aspect_ratio?: string };
    response?: { model?: string; quality?: string; resolution?: string; size?: string };
    decodedSize: { width: number; height: number };
    sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  };
  usage?: Record<string, unknown>;
}
