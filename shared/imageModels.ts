/** Existing standard image executors; adding a registry entry does not enable a provider. */
export type ImageExecutionKey =
  | "grok"
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
}
