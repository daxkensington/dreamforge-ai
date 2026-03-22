/**
 * Model Registry — unified registry for all AI generation models across providers.
 */

export interface AIModel {
  id: string;
  name: string;
  provider: "forge" | "stability" | "openai" | "replicate" | "local";
  type: "image" | "video" | "audio";
  capabilities: string[];
  maxResolution: { width: number; height: number };
  creditCost: { base: number; hd?: number; ultra?: number };
  isAvailable: boolean;
  tier: "free" | "creator" | "pro" | "studio";
}

// ─── Image Models ──────────────────────────────────────────────────────────

const dreamForgeBasic: AIModel = {
  id: "forge-basic",
  name: "DreamForge Basic",
  provider: "forge",
  type: "image",
  capabilities: ["text-to-image", "image-editing"],
  maxResolution: { width: 1024, height: 1024 },
  creditCost: { base: 1 },
  isAvailable: true,
  tier: "free",
};

const dreamForgeHD: AIModel = {
  id: "forge-hd",
  name: "DreamForge HD",
  provider: "forge",
  type: "image",
  capabilities: ["text-to-image", "image-editing", "upscale"],
  maxResolution: { width: 1536, height: 1536 },
  creditCost: { base: 2, hd: 3 },
  isAvailable: true,
  tier: "creator",
};

const stableDiffusionXL: AIModel = {
  id: "sdxl-1.0",
  name: "Stable Diffusion XL",
  provider: "stability",
  type: "image",
  capabilities: ["text-to-image", "image-to-image"],
  maxResolution: { width: 1536, height: 1536 },
  creditCost: { base: 2, hd: 4 },
  isAvailable: true,
  tier: "creator",
};

const dalle3: AIModel = {
  id: "dall-e-3",
  name: "DALL-E 3",
  provider: "openai",
  type: "image",
  capabilities: ["text-to-image"],
  maxResolution: { width: 1792, height: 1024 },
  creditCost: { base: 3, hd: 5 },
  isAvailable: true,
  tier: "pro",
};

const fluxPro: AIModel = {
  id: "flux-pro",
  name: "Flux Pro",
  provider: "replicate",
  type: "image",
  capabilities: ["text-to-image", "image-to-image"],
  maxResolution: { width: 1536, height: 1536 },
  creditCost: { base: 3, hd: 5, ultra: 8 },
  isAvailable: true,
  tier: "pro",
};

// ─── Video Models ──────────────────────────────────────────────────────────

const dreamForgeMotion: AIModel = {
  id: "forge-motion",
  name: "DreamForge Motion",
  provider: "forge",
  type: "video",
  capabilities: ["text-to-video", "image-to-video"],
  maxResolution: { width: 1024, height: 1024 },
  creditCost: { base: 5, hd: 8 },
  isAvailable: true,
  tier: "creator",
};

const stableVideo: AIModel = {
  id: "stable-video",
  name: "Stable Video",
  provider: "stability",
  type: "video",
  capabilities: ["image-to-video"],
  maxResolution: { width: 1024, height: 576 },
  creditCost: { base: 6, hd: 10 },
  isAvailable: true,
  tier: "pro",
};

const minimaxVideo: AIModel = {
  id: "minimax-video",
  name: "Minimax Video",
  provider: "replicate",
  type: "video",
  capabilities: ["text-to-video"],
  maxResolution: { width: 1280, height: 720 },
  creditCost: { base: 8, hd: 12 },
  isAvailable: true,
  tier: "studio",
};

// ─── Audio Models ──────────────────────────────────────────────────────────

const dreamForgeAudio: AIModel = {
  id: "forge-audio",
  name: "DreamForge Audio",
  provider: "forge",
  type: "audio",
  capabilities: ["text-to-audio", "sound-effects"],
  maxResolution: { width: 0, height: 0 },
  creditCost: { base: 2 },
  isAvailable: true,
  tier: "creator",
};

const barkTTS: AIModel = {
  id: "bark-tts",
  name: "Bark TTS",
  provider: "replicate",
  type: "audio",
  capabilities: ["text-to-speech"],
  maxResolution: { width: 0, height: 0 },
  creditCost: { base: 1 },
  isAvailable: true,
  tier: "creator",
};

// ─── Registry ──────────────────────────────────────────────────────────────

const ALL_MODELS: AIModel[] = [
  // Image
  dreamForgeBasic,
  dreamForgeHD,
  stableDiffusionXL,
  dalle3,
  fluxPro,
  // Video
  dreamForgeMotion,
  stableVideo,
  minimaxVideo,
  // Audio
  dreamForgeAudio,
  barkTTS,
];

const modelMap = new Map<string, AIModel>(
  ALL_MODELS.map((m) => [m.id, m])
);

/** Retrieve a model by its ID. Returns undefined if not found. */
export function getModelById(id: string): AIModel | undefined {
  return modelMap.get(id);
}

/** List all registered models, optionally filtered by type and/or provider. */
export function listModels(filter?: {
  type?: AIModel["type"];
  provider?: AIModel["provider"];
  tier?: AIModel["tier"];
}): AIModel[] {
  let models = ALL_MODELS;
  if (filter?.type) {
    models = models.filter((m) => m.type === filter.type);
  }
  if (filter?.provider) {
    models = models.filter((m) => m.provider === filter.provider);
  }
  if (filter?.tier) {
    const tierOrder: Record<string, number> = {
      free: 0,
      creator: 1,
      pro: 2,
      studio: 3,
    };
    const maxTier = tierOrder[filter.tier] ?? 0;
    models = models.filter((m) => (tierOrder[m.tier] ?? 0) <= maxTier);
  }
  return models;
}

/** Tier hierarchy for access checks. */
const TIER_RANK: Record<AIModel["tier"], number> = {
  free: 0,
  creator: 1,
  pro: 2,
  studio: 3,
};

/** Check whether a user tier can access a given model tier. */
export function canAccessModel(
  userTier: AIModel["tier"],
  modelTier: AIModel["tier"]
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[modelTier];
}
