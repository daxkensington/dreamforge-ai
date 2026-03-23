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
  provider: "grok" | "openai" | "gemini" | "anthropic" | "runpod" | "local";
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

// ─── RunPod / Self-Hosted (future) ─────────────────────────────────────────

// Placeholder for RunPod models that can be added later.
// Just add entries here and create a RunPodProvider adapter.
//
// function sdxlRunpod(): AIModel {
//   return {
//     id: "sdxl-runpod",
//     name: "Stable Diffusion XL (RunPod)",
//     provider: "runpod",
//     type: "image",
//     capabilities: ["text-to-image", "image-to-image"],
//     maxResolution: { width: 1536, height: 1536 },
//     creditCost: { base: 2, hd: 4 },
//     isAvailable: !!ENV.runpodApiKey,
//     tier: "creator",
//   };
// }

// ─── Registry ──────────────────────────────────────────────────────────────

/** Build the model list fresh each time (picks up runtime API key changes). */
function buildModelList(): AIModel[] {
  return [
    // Image models
    grokImage(),
    dalleModel(),
    geminiImage(),
    // LLM models
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
