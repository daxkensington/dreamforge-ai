/**
 * Model Registry — unified registry for all AI generation models across providers.
 *
 * Models are marked available based on whether their API key is set.
 * The registry supports image, LLM, video, and audio model types,
 * and is designed so RunPod/self-hosted models can be added later.
 */

import { ENV } from "./env";
import type { ModelTier } from "../../shared/creditCosts";
import { resolveTierName, type TierName, TIERS } from "../../shared/tiers";

export interface AIModel {
  id: string;
  name: string;
  provider: "grok" | "openai" | "gemini" | "anthropic" | "replicate" | "stability" | "groq" | "together" | "cloudflare" | "runpod" | "local" | "runway" | "kling" | "fal" | "synclabs";
  type: "image" | "llm" | "video" | "audio";
  capabilities: string[];
  maxResolution: { width: number; height: number };
  creditCost: { base: number; hd?: number; ultra?: number };
  /** Computed at runtime — true when the provider's API key is configured. */
  isAvailable: boolean;
  /** Model pricing tier — determines credit cost (free/standard/quality/premium/ultra) */
  modelTier: ModelTier;
  /** Minimum subscription tier to access this model */
  tier: "free" | "creator" | "pro" | "studio";
  /** Description shown in the UI model picker. */
  description?: string;
  /** Cost info for display. */
  costInfo?: string;
}

// ─── Flagship Model ──────────────────────────────────────────────────────────

function ultraMode(): AIModel {
  return {
    id: "ultra",
    name: "DreamForgeX Ultra",
    provider: "replicate",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1440, height: 1440 },
    creditCost: { base: 25, hd: 25 },
    isAvailable: !!ENV.replicateApiToken || !!ENV.openaiApiKey,
    modelTier: "ultra",
    tier: "studio",
    description: "Flagship quality — enhanced prompt engineering + Flux Pro max settings. Midjourney-competitive output.",
    costInfo: "25 credits (Studio+)",
  };
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
    creditCost: { base: 5 },
    isAvailable: !!ENV.grokApiKey,
    modelTier: "standard",
    tier: "creator",
    description: "Fast image generation via xAI.",
    costInfo: "5 credits (Creator+)",
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
    creditCost: { base: 15, hd: 25 },
    isAvailable: !!ENV.openaiApiKey,
    modelTier: "premium",
    tier: "pro",
    description: "High quality image generation by OpenAI. Excellent prompt following.",
    costInfo: "15 credits (Pro+), 25 HD",
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
    creditCost: { base: 2 },
    isAvailable: !!ENV.geminiApiKey,
    modelTier: "free",
    tier: "free",
    description: "Google Gemini image generation. Generous free tier.",
    costInfo: "2 credits (Free)",
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
    modelTier: "free",
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
    modelTier: "free",
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
    modelTier: "free",
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
    modelTier: "quality",
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
    creditCost: { base: 15 },
    isAvailable: !!ENV.replicateApiToken,
    modelTier: "premium",
    tier: "pro",
    description: "Black Forest Labs Flux Pro — high-quality, photorealistic images with excellent prompt adherence.",
    costInfo: "15 credits (Pro+)",
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
    creditCost: { base: 10 },
    isAvailable: !!ENV.replicateApiToken,
    modelTier: "quality",
    tier: "pro",
    description: "Flux Schnell via Replicate — fast, high-quality image generation.",
    costInfo: "10 credits (Pro+)",
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
    creditCost: { base: 40 },
    isAvailable: !!ENV.replicateApiToken,
    modelTier: "standard",
    tier: "creator",
    description: "Minimax Video — high-quality short video generation from text prompts.",
    costInfo: "40 credits (Creator+)",
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
    creditCost: { base: 10 },
    isAvailable: !!ENV.stabilityApiKey,
    modelTier: "quality",
    tier: "pro",
    description: "Stability AI SD3 — excellent detail, composition, and text rendering.",
    costInfo: "10 credits (Pro+)",
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
    creditCost: { base: 40 },
    isAvailable: !!ENV.stabilityApiKey,
    modelTier: "standard",
    tier: "creator",
    description: "Stability Stable Video — animate images into short video clips.",
    costInfo: "40 credits (Creator+)",
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
    creditCost: { base: 10 },
    isAvailable: !!ENV.geminiApiKey,
    modelTier: "free",
    tier: "free",
    description: "Google Veo 3 — state-of-the-art video generation with synchronized audio.",
    costInfo: "10 credits (Free)",
  };
}

// ─── Runway Models (Video) ────────────────────────────────────────────────────

function runwayGen45(): AIModel {
  return {
    id: "runway-gen4.5",
    name: "Runway Gen-4.5",
    provider: "runway",
    type: "video",
    capabilities: ["text-to-video", "image-to-video"],
    maxResolution: { width: 1280, height: 720 },
    creditCost: { base: 200 },
    isAvailable: !!ENV.runwayApiKey,
    modelTier: "ultra",
    tier: "studio",
    description: "Runway Gen-4.5 — flagship commercial-grade video generation. Best-in-class quality and coherence.",
    costInfo: "200 credits (Studio+)",
  };
}

function runwayGen4Turbo(): AIModel {
  return {
    id: "runway-gen4-turbo",
    name: "Runway Gen-4 Turbo",
    provider: "runway",
    type: "video",
    capabilities: ["text-to-video", "image-to-video"],
    maxResolution: { width: 1280, height: 720 },
    creditCost: { base: 200 },
    isAvailable: !!ENV.runwayApiKey,
    modelTier: "ultra",
    tier: "studio",
    description: "Runway Gen-4 Turbo — fast, cost-effective video generation with great quality.",
    costInfo: "200 credits (Studio+)",
  };
}

// ─── Kling Models (Video) ─────────────────────────────────────────────────────

function kling20(): AIModel {
  return {
    id: "kling-2.0",
    name: "Kling 2.0 Master",
    provider: "kling",
    type: "video",
    capabilities: ["text-to-video", "image-to-video"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 75 },
    isAvailable: !!ENV.klingAccessKey && !!ENV.klingSecretKey,
    modelTier: "premium",
    tier: "pro",
    description: "Kling 2.0 Master — high-quality video generation with excellent motion and detail.",
    costInfo: "75 credits (Pro+)",
  };
}

function kling16(): AIModel {
  return {
    id: "kling-1.6",
    name: "Kling 1.6 Standard",
    provider: "kling",
    type: "video",
    capabilities: ["text-to-video", "image-to-video"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 50 },
    isAvailable: !!ENV.klingAccessKey && !!ENV.klingSecretKey,
    modelTier: "quality",
    tier: "pro",
    description: "Kling 1.6 — fast and affordable video generation. Great for quick iterations.",
    costInfo: "50 credits (Pro+)",
  };
}

function cogVideoX(): AIModel {
  return {
    id: "cogvideo",
    name: "CogVideoX (Self-Hosted)",
    provider: "runpod",
    type: "video",
    capabilities: ["text-to-video"],
    maxResolution: { width: 720, height: 480 },
    creditCost: { base: 20 },
    isAvailable: !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId,
    modelTier: "standard",
    tier: "creator",
    description: "CogVideoX-5B on DreamForge GPUs — 75% cheaper than API video.",
    costInfo: "20 credits (Creator+)",
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
    creditCost: { base: 6 },
    isAvailable: !!ENV.replicateApiToken,
    modelTier: "standard",
    tier: "creator",
    description: "Meta MusicGen — generate original music from text descriptions.",
    costInfo: "6 credits (Creator+)",
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
    creditCost: { base: 8 },
    isAvailable: !!ENV.openaiApiKey,
    modelTier: "premium",
    tier: "free",
    description: "OpenAI TTS-1-HD — natural speech in 6 voices.",
    costInfo: "8 credits",
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
    modelTier: "free",
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
    creditCost: { base: 2 },
    isAvailable: !!ENV.togetherApiKey,
    modelTier: "free",
    tier: "free",
    description: "Together AI Flux Schnell — free high-quality image generation.",
    costInfo: "2 credits (Free)",
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
    creditCost: { base: 2 },
    isAvailable: !!ENV.cfAiToken,
    modelTier: "free",
    tier: "free",
    description: "Cloudflare Workers AI — 100K free images per day.",
    costInfo: "2 credits (Free)",
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
    creditCost: { base: 1 },
    isAvailable: true,
    modelTier: "free",
    tier: "free",
    description: "Microsoft Edge TTS — free unlimited text-to-speech with 400+ voices.",
    costInfo: "1 credit (Free)",
  };
}

// ─── RunPod / Self-Hosted ──────────────────────────────────────────────────

function runpodFluxDev(): AIModel {
  return {
    id: "runpod-flux-dev",
    name: "Flux Dev (Self-Hosted)",
    provider: "runpod",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1440, height: 1440 },
    creditCost: { base: 5 },
    isAvailable: !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId,
    modelTier: "standard",
    tier: "creator",
    description: "Flux Dev on DreamForge GPUs — high quality at 80% lower cost. 20-step generation.",
    costInfo: "5 credits (Creator+)",
  };
}

function runpodFluxSchnell(): AIModel {
  return {
    id: "runpod-flux-schnell",
    name: "Flux Schnell (Self-Hosted)",
    provider: "runpod",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 5 },
    isAvailable: !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId,
    modelTier: "standard",
    tier: "creator",
    description: "Flux Schnell on DreamForge GPUs — fast 4-step generation at minimal cost.",
    costInfo: "5 credits (Creator+)",
  };
}

function runpodUpscaler(): AIModel {
  return {
    id: "runpod-esrgan",
    name: "Real-ESRGAN (Self-Hosted)",
    provider: "runpod",
    type: "image",
    capabilities: ["upscale"],
    maxResolution: { width: 4096, height: 4096 },
    creditCost: { base: 5 },
    isAvailable: !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId,
    modelTier: "free",
    tier: "free",
    description: "Real-ESRGAN 4x upscaling on DreamForge GPUs — 90% cheaper than API.",
    costInfo: "5 credits",
  };
}

function runpodBgRemoval(): AIModel {
  return {
    id: "runpod-rmbg",
    name: "RMBG-2.0 (Self-Hosted)",
    provider: "runpod",
    type: "image",
    capabilities: ["background-removal"],
    maxResolution: { width: 2048, height: 2048 },
    creditCost: { base: 5 },
    isAvailable: !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId,
    modelTier: "free",
    tier: "free",
    description: "RMBG-2.0 background removal on DreamForge GPUs — 95% cheaper than API.",
    costInfo: "5 credits",
  };
}

// ─── fal.ai Models (Image + Video) ─────────────────────────────────────────

function falFluxDev(): AIModel {
  return {
    id: "fal-flux-dev",
    name: "Flux Dev (fal.ai)",
    provider: "fal",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1440, height: 1440 },
    creditCost: { base: 10 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "quality",
    tier: "pro",
    description: "Flux Dev via fal.ai — high-quality image generation with great prompt adherence.",
    costInfo: "10 credits (Pro+)",
  };
}

function falFluxSchnell(): AIModel {
  return {
    id: "fal-flux-schnell",
    name: "Flux Schnell (fal.ai)",
    provider: "fal",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1024, height: 1024 },
    creditCost: { base: 5 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "standard",
    tier: "creator",
    description: "Flux Schnell via fal.ai — fast, cheap image generation.",
    costInfo: "5 credits (Creator+)",
  };
}

function falFluxProUltra(): AIModel {
  return {
    id: "fal-flux-pro-ultra",
    name: "Flux Pro 1.1 Ultra (fal.ai)",
    provider: "fal",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 2048, height: 2048 },
    creditCost: { base: 25 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "ultra",
    tier: "studio",
    description: "Flux Pro 1.1 Ultra via fal.ai — highest quality Flux model with ultra-high resolution.",
    costInfo: "25 credits (Studio+)",
  };
}

function falSeedream(): AIModel {
  return {
    id: "fal-seedream",
    name: "Seedream V4 (fal.ai)",
    provider: "fal",
    type: "image",
    capabilities: ["text-to-image"],
    maxResolution: { width: 1440, height: 1440 },
    creditCost: { base: 10 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "quality",
    tier: "pro",
    description: "Seedream V4 via fal.ai — excellent at creative and artistic imagery.",
    costInfo: "10 credits (Pro+)",
  };
}

function falFluxKontext(): AIModel {
  return {
    id: "fal-flux-kontext",
    name: "Flux Kontext Pro (fal.ai)",
    provider: "fal",
    type: "image",
    capabilities: ["text-to-image", "image-editing"],
    maxResolution: { width: 1440, height: 1440 },
    creditCost: { base: 15 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "premium",
    tier: "pro",
    description: "Flux Kontext Pro via fal.ai — context-aware image editing and generation.",
    costInfo: "15 credits (Pro+)",
  };
}

function falWanVideo(): AIModel {
  return {
    id: "fal-wan-video",
    name: "Wan 2.5 1080p (fal.ai)",
    provider: "fal",
    type: "video",
    capabilities: ["text-to-video"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 40 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "standard",
    tier: "creator",
    description: "Wan 2.5 via fal.ai — high-quality 1080p video generation from text.",
    costInfo: "40 credits (Creator+)",
  };
}

function falKlingVideo(): AIModel {
  return {
    id: "fal-kling-video",
    name: "Kling 2.5 Turbo (fal.ai)",
    provider: "fal",
    type: "video",
    capabilities: ["image-to-video"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 50 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "quality",
    tier: "pro",
    description: "Kling 2.5 Turbo via fal.ai — fast image-to-video generation.",
    costInfo: "50 credits (Pro+)",
  };
}

// ─── Sync Labs Models (Lip Sync) ──────────────────────────────────────────

function syncLabsSync3(): AIModel {
  return {
    id: "synclabs-sync3",
    name: "Sync-3 Lip Sync",
    provider: "synclabs",
    type: "video",
    capabilities: ["lip-sync"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 50 },
    isAvailable: !!ENV.syncLabsApiKey,
    modelTier: "quality",
    tier: "pro",
    description: "Sync Labs Sync-3 — AI lip sync for video. Upload video + audio to generate realistic lip movement.",
    costInfo: "50 credits (Pro+)",
  };
}

function syncLabsLipsync2(): AIModel {
  return {
    id: "synclabs-lipsync-2",
    name: "Lipsync-2 Pro",
    provider: "synclabs",
    type: "video",
    capabilities: ["lip-sync"],
    maxResolution: { width: 1920, height: 1080 },
    creditCost: { base: 40 },
    isAvailable: !!ENV.syncLabsApiKey,
    modelTier: "standard",
    tier: "creator",
    description: "Sync Labs Lipsync-2 Pro — general-purpose lip sync. Great for wide shots and group scenes.",
    costInfo: "40 credits (Creator+)",
  };
}

// ─── Stable Audio (via fal.ai) ────────────────────────────────────────────

function falStableAudio(): AIModel {
  return {
    id: "fal-stable-audio",
    name: "Stable Audio 2.0 (fal.ai)",
    provider: "fal",
    type: "audio",
    capabilities: ["text-to-music", "text-to-sfx"],
    maxResolution: { width: 0, height: 0 },
    creditCost: { base: 8 },
    isAvailable: !!ENV.falApiKey,
    modelTier: "standard",
    tier: "creator",
    description: "Stability AI Stable Audio 2.0 via fal.ai — high-quality music and sound effect generation up to 47 seconds.",
    costInfo: "8 credits (Creator+)",
  };
}

// ─── Registry ──────────────────────────────────────────────────────────────

/** Build the model list fresh each time (picks up runtime API key changes). */
function buildModelList(): AIModel[] {
  return [
    // Flagship
    ultraMode(),
    // Image models
    grokImage(),
    dalleModel(),
    geminiImage(),
    fluxPro(),
    fluxSchnell(),
    sd3Image(),
    // fal.ai image models
    falFluxDev(),
    falFluxSchnell(),
    falFluxProUltra(),
    falSeedream(),
    falFluxKontext(),
    // Video models
    veo3Video(),
    runwayGen45(),
    runwayGen4Turbo(),
    kling20(),
    kling16(),
    falWanVideo(),
    falKlingVideo(),
    minimaxVideo(),
    stableVideo(),
    // Self-hosted (RunPod) — cheapest image gen
    runpodFluxDev(),
    runpodFluxSchnell(),
    runpodUpscaler(),
    runpodBgRemoval(),
    // Free image models
    togetherFlux(),
    cloudflareImage(),
    // Self-hosted video
    cogVideoX(),
    // Lip sync models
    syncLabsSync3(),
    syncLabsLipsync2(),
    // Audio models
    edgeTts(),
    openaiTTS(),
    musicGen(),
    falStableAudio(),
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
    const maxTier = TIER_RANK[filter.tier] ?? 0;
    models = models.filter((m) => (TIER_RANK[m.tier] ?? 0) <= maxTier);
  }
  return models;
}

/** Tier hierarchy for access checks (subscription tiers). */
const TIER_RANK: Record<string, number> = {
  free: 0,
  creator: 1,
  pro: 2,
  studio: 3,
  business: 4,
  agency: 5,
  // Legacy mapping
  enterprise: 4,
};

/** Check whether a user subscription tier can access a model that requires the given tier. */
export function canAccessModel(
  userTier: string,
  modelTier: AIModel["tier"],
): boolean {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[modelTier] ?? 0);
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
