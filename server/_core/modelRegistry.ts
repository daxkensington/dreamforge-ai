/**
 * Model Registry — unified registry for all AI generation models across providers.
 *
 * Models are marked available based on whether their API key is set.
 * The registry supports image, LLM, video, and audio model types,
 * and is designed so RunPod/self-hosted models can be added later.
 */

import { ENV } from "./env";

export interface AIModel {
  id: string;
  name: string;
  provider: "grok" | "openai" | "gemini" | "anthropic" | "replicate" | "stability" | "groq" | "together" | "cloudflare" | "runpod" | "local";
  type: "image" | "llm" | "video" | "audio";
  capabilities: string[];
  maxResolution: { width: number; height: number };
  creditCost: { base: number; hd?: number; ultra?: number };
  /** Computed at runtime — true when the provider's API key is configured. */
  isAvailable: boolean;
  tier: "free" | "creator" | "pro" | "studio";
  /** Description shown in the UI model picker. */
  description?: string;
  /** Cost info for display. */
  costInfo?: string;
}

// ─── Image Models ──────────────────────────────────────────────────────────

function grokImage(): AIModel {
  return {
    id: "grok-image",
    name: "Grok Image Gen",
    provider: "grok",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 1 },
    isAvailable: !!ENV.grokApiKey,
    tier: "free",
    description: "Fast image generation via xAI. Free tier included.",
    costInfo: "Free tier",
  };
}

function dalleModel(): AIModel {
  return {
    id: "dall-e-3",
    name: "DALL-E 3",
    provider: "openai",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1792, height: 1024 },
    creditCost: { base: 3, hd: 5 },
    isAvailable: !!ENV.openaiApiKey,
    tier: "creator",
    description: "High quality image generation by OpenAI. Excellent prompt following.",
    costInfo: "~$0.04/image (standard), ~$0.08/image (HD)",
  };
}

function geminiImage(): AIModel {
  return {
    id: "gemini-image",
    name: "Gemini Imagen",
    provider: "gemini",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 1 },
    isAvailable: !!ENV.geminiApiKey,
    tier: "free",
    description: "Google Gemini image generation. Generous free tier.",
    costInfo: "Included with Gemini API",
  };
}

// ─── LLM Models (for prompt enhancement, analysis, chat) ──────────────────

function gpt4oMini(): AIModel {
  return {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    type: "llm",
    capabilities: ["chat", "vision", "json-mode", "tool-calling", "prompt-enhancement"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 1 },
    isAvailable: !!ENV.openaiApiKey,
    tier: "free",
    description: "Fast and affordable OpenAI model. Great for most tasks.",
    costInfo: "~$0.15/1M input tokens",
  };
}

function grok3Mini(): AIModel {
  return {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    provider: "grok",
    type: "llm",
    capabilities: ["chat", "vision", "json-mode", "tool-calling", "prompt-enhancement"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 1 },
    isAvailable: !!ENV.grokApiKey,
    tier: "free",
    description: "Fast xAI model with reasoning capabilities.",
    costInfo: "Competitive pricing",
  };
}

function geminiFlash(): AIModel {
  return {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    type: "llm",
    capabilities: ["chat", "vision", "json-mode", "tool-calling", "prompt-enhancement"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 1 },
    isAvailable: !!ENV.geminiApiKey,
    tier: "free",
    description: "Google Gemini — fast with generous free tier.",
    costInfo: "Free tier: 1500 RPD",
  };
}

function claudeSonnet(): AIModel {
  return {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    provider: "anthropic",
    type: "llm",
    capabilities: ["chat", "vision", "json-mode", "tool-calling", "prompt-enhancement", "reasoning"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 3 },
    isAvailable: !!ENV.anthropicApiKey,
    tier: "pro",
    description: "Anthropic Claude — highest quality reasoning and analysis.",
    costInfo: "~$3/1M input tokens",
  };
}

// ─── Replicate Models (Flux Pro, Video, Audio) ──────────────────────────────

function fluxPro(): AIModel {
  return {
    id: "flux-pro",
    name: "Flux 1.1 Pro",
    provider: "replicate",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1440, height: 1440 },
    creditCost: { base: 3, hd: 5 },
    isAvailable: !!ENV.replicateApiToken,
    tier: "creator",
    description: "Black Forest Labs Flux Pro — high-quality, photorealistic images with excellent prompt adherence.",
    costInfo: "~$0.05/image",
  };
}

function fluxSchnell(): AIModel {
  return {
    id: "flux-schnell",
    name: "Flux Schnell",
    provider: "replicate",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 1 },
    isAvailable: !!ENV.replicateApiToken,
    tier: "free",
    description: "Flux Schnell — fast, high-quality image generation. Great for rapid iteration.",
    costInfo: "~$0.003/image",
  };
}

function minimaxVideo(): AIModel {
  return {
    id: "minimax-video",
    name: "Minimax Video",
    provider: "replicate",
    type: "video",
    capabilities: ["text-to-video"],
    maxResolution: { width: 1280, height: 720 },
    creditCost: { base: 10 },
    isAvailable: !!ENV.replicateApiToken,
    tier: "creator",
    description: "Minimax Video — high-quality short video generation from text prompts.",
    costInfo: "~$0.10/video",
  };
}

// ─── Stability AI Models (SD3, Stable Video) ────────────────────────────────

function sd3Image(): AIModel {
  return {
    id: "sd3",
    name: "Stable Diffusion 3",
    provider: "stability",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1536, height: 1536 },
    creditCost: { base: 2, hd: 4 },
    isAvailable: !!ENV.stabilityApiKey,
    tier: "creator",
    description: "Stability AI SD3 — excellent detail, composition, and text rendering.",
    costInfo: "~$0.035/image",
  };
}

function stableVideo(): AIModel {
  return {
    id: "stable-video",
    name: "Stable Video Diffusion",
    provider: "stability",
    type: "video",
    capabilities: ["image-to-video"],
    maxResolution: { width: 1024, height: 576 },
    creditCost: { base: 8 },
    isAvailable: !!ENV.stabilityApiKey,
    tier: "creator",
    description: "Stability Stable Video — animate images into short video clips.",
    costInfo: "~$0.20/video",
  };
}

// ─── Google Veo 3 (Video) ───────────────────────────────────────────────────

function veo3Video(): AIModel {
  return {
    id: "veo-3",
    name: "Google Veo 3",
    provider: "gemini",
    type: "video",
    capabilities: ["text-to-video", "image-to-video"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 5, hd: 10 },
    isAvailable: !!ENV.geminiApiKey,
    tier: "free",
    description: "Google Veo 3 — state-of-the-art video generation with synchronized audio.",
    costInfo: "Included with Gemini API",
  };
}

// ─── Audio Models ───────────────────────────────────────────────────────────

function musicGen(): AIModel {
  return {
    id: "musicgen",
    name: "MusicGen",
    provider: "replicate",
    type: "audio",
    capabilities: ["text-to-music"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 2 },
    isAvailable: !!ENV.replicateApiToken,
    tier: "creator",
    description: "Meta MusicGen — generate original music from text descriptions.",
    costInfo: "~$0.02/track",
  };
}

function openaiTTS(): AIModel {
  return {
    id: "openai-tts",
    name: "OpenAI TTS HD",
    provider: "openai",
    type: "audio",
    capabilities: ["text-to-speech"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 2 },
    isAvailable: !!ENV.openaiApiKey,
    tier: "free",
    description: "OpenAI TTS-1-HD — natural speech in 6 voices.",
    costInfo: "~$0.03/min",
  };
}

// ─── Free Providers ─────────────────────────────────────────────────────────

function groqLlm(): AIModel {
  return {
    id: "groq-llama-70b",
    name: "Llama 3.3 70B (Groq)",
    provider: "groq",
    type: "llm",
    capabilities: ["chat", "json-mode", "prompt-enhancement"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 0 },
    isAvailable: !!ENV.groqApiKey,
    tier: "free",
    description: "Groq Llama 3.3 70B — blazing fast free LLM inference.",
    costInfo: "Free (1,000 req/day)",
  };
}

function togetherFlux(): AIModel {
  return {
    id: "together-flux",
    name: "Flux Schnell (Together AI)",
    provider: "together",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 0 },
    isAvailable: !!ENV.togetherApiKey,
    tier: "free",
    description: "Together AI Flux Schnell — free high-quality image generation.",
    costInfo: "Free for 3 months",
  };
}

function cloudflareImage(): AIModel {
  return {
    id: "cf-flux-schnell",
    name: "Flux Schnell (Cloudflare)",
    provider: "cloudflare",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 0 },
    isAvailable: !!ENV.cfAiToken,
    tier: "free",
    description: "Cloudflare Workers AI — 100K free images per day.",
    costInfo: "Free (100K/day)",
  };
}

function edgeTts(): AIModel {
  return {
    id: "edge-tts",
    name: "Edge TTS",
    provider: "local",
    type: "audio",
    capabilities: ["text-to-speech"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 0 },
    isAvailable: true,
    tier: "free",
    description: "Microsoft Edge TTS — free unlimited text-to-speech with 400+ voices.",
    costInfo: "Free (unlimited)",
  };
}

// ─── RunPod / Self-Hosted (future) ─────────────────────────────────────────
// Add entries here and create a RunPodProvider adapter when ready.

// ─── Registry ──────────────────────────────────────────────────────────────

/** Build the model list fresh each time (picks up runtime API key changes). */
function buildModelList(): AIModel[] {
  return [
    // Image models
    grokImage(),
    dalleModel(),
    geminiImage(),
    fluxPro(),
    fluxSchnell(),
    sd3Image(),
    // Video models
    veo3Video(),
    minimaxVideo(),
    stableVideo(),
    // Free image models
    togetherFlux(),
    cloudflareImage(),
    // Audio models
    edgeTts(),
    openaiTTS(),
    musicGen(),
    // LLM models
    groqLlm(),
    gpt4oMini(),
    grok3Mini(),
    geminiFlash(),
    claudeSonnet(),
  ];
}

/** Retrieve a model by its ID. Returns undefined if not found. */
export function getModelById(id: string): AIModel | undefined {
  return buildModelList().find((m) => m.id === id);
}

/** List all registered models, optionally filtered by type, provider, or tier. */
export function listModels(filter?: {
  type?: AIModel["type"];
  provider?: AIModel["provider"];
  tier?: AIModel["tier"];
  availableOnly?: boolean;
}): AIModel[] {
  let models = buildModelList();

  if (filter?.type) {
    models = models.filter((m) => m.type === filter.type);
  }
  if (filter?.provider) {
    models = models.filter((m) => m.provider === filter.provider);
  }
  if (filter?.availableOnly) {
    models = models.filter((m) => m.isAvailable);
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
  modelTier: AIModel["tier"],
): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[modelTier];
}

/** Get all available image models. Convenience for the UI model picker. */
export function getAvailableImageModels(): AIModel[] {
  return listModels({ type: "image", availableOnly: true });
}

/** Get all available LLM models. */
export function getAvailableLLMModels(): AIModel[] {
  return listModels({ type: "llm", availableOnly: true });
}

/** Get all available video models. */
export function getAvailableVideoModels(): AIModel[] {
  return listModels({ type: "video", availableOnly: true });
}

/** Get all available audio models. */
export function getAvailableAudioModels(): AIModel[] {
  return listModels({ type: "audio", availableOnly: true });
}
