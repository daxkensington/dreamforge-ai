/**
 * Credit costs for every generation/tool operation.
 * Imported by both client (to show costs) and server (to deduct).
 *
 * NEW: Model-tier-aware credit costs — costs depend on which model
 * the user selected, not just which tool they used.
 */

// ─── Model Tier Type ──────────────────────────────────────────────────────
export type ModelTier = "free" | "standard" | "quality" | "premium" | "ultra";

// ─── Model-Aware Credit Costs ─────────────────────────────────────────────
export const MODEL_CREDIT_COSTS = {
  image: { free: 2, standard: 5, quality: 10, premium: 15, ultra: 25 } as Record<ModelTier, number>,
  video: { free: 10, standard: 40, quality: 50, premium: 75, ultra: 200 } as Record<ModelTier, number>,
  audio: { tts_free: 1, tts_premium: 8, music: 6, sfx: 4 } as Record<string, number>,
} as const;

// ─── Tool Credit Costs (non-model operations) ────────────────────────────
export const TOOL_CREDIT_COSTS: Record<string, number> = {
  "prompt-assist": 0,
  "image-caption": 0,
  "background-remove": 5,
  "upscale": 5,
  "super-resolution": 10,
  "style-transfer": 10,
  "panorama": 15,
  "storyboard": 15,
  "character-sheet": 15,
  "animate": 40,
  "virtual-tryon": 10,
  "relight": 10,
  "3d-generate": 15,
  "comic-strip": 15,
  "tshirt-design": 10,
  "pixel-art": 5,
  "coloring-book": 5,
  "tattoo-design": 10,
  "cover-maker": 10,
  "pose-turnaround": 15,
  "photo-colorize": 8,
  "podcast-cover": 8,
  "listing-photos": 20,
  "real-estate-twilight": 8,
  "fashion-lookbook": 20,
  "meme-template": 5,
  "yt-thumbnails": 25,
  "ig-carousel": 35,
  "sticker-pack": 25,
  "recipe-card": 8,
  "invitation": 8,
  "business-card": 15,
  "pet-portrait": 10,
  "tarot-card": 10,
  "movie-poster": 10,
  "trading-card": 10,
  "menu-design": 10,
  "greeting-card": 15,
};

// ─── Old flat costs (kept for backward compat) ───────────────────────────
/** @deprecated Use MODEL_CREDIT_COSTS + TOOL_CREDIT_COSTS instead */
export const CREDIT_COSTS = {
  imageGeneration: { basic: 5, hd: 10, ultra: 20 },
  videoGeneration: { short5s: 50, medium10s: 100, long30s: 250 },
  audioGeneration: { sfx: 15, music30s: 30, voiceover: 25 },
  imageToVideo: { basic: 40, premium: 80 },
  upscale: { x2: 10, x4: 20 },
  promptEnhance: 2,
  batchMultiplier: 0.9,
} as const;

/** @deprecated Use MODEL_CREDIT_COSTS + TOOL_CREDIT_COSTS instead */
export const LEGACY_CREDIT_COSTS: Record<string, number> = {
  "text-to-image": 5,
  "image-to-image": 5,
  "text-to-video": 50,
  "image-to-video": 40,
  "background-remove": 5,
  "background-edit": 5,
  "style-transfer": 10,
  "face-enhance": 5,
  "color-grade": 5,
  "super-resolution": 10,
  "object-remove": 10,
  "sketch-to-image": 10,
  "image-merge": 10,
  "texture-gen": 5,
  "panorama": 15,
  "animate": 40,
  storyboard: 15,
  "scene-director": 10,
  "video-style-transfer": 15,
  "video-upscaler": 15,
  "soundtrack-suggest": 5,
  "text-to-video-script": 5,
  "prompt-assist": 0,
  "ai-refine": 5,
  "model-compare": 15,
};

/** Subscription plan definitions (mirrors DB seed) */
export const SUBSCRIPTION_PLANS = [
  {
    name: "free",
    displayName: "Explorer",
    price: 0,
    yearlyPrice: 0,
    monthlyCredits: 0, // daily credits instead (50/day ~ 1,500/mo)
    features: [
      "50 credits/day (free models only)",
      "5 songs/day (watermarked)",
      "1 music video/day (480p, watermarked)",
      "All 75+ tools with limits",
      "Non-commercial use only",
    ],
  },
  {
    name: "creator",
    displayName: "Creator",
    price: 900, // $9/mo
    yearlyPrice: 8600, // $86/yr ($7.17/mo)
    monthlyCredits: 3000,
    features: [
      "3,000 credits/month",
      "No watermarks",
      "Commercial use rights",
      "Standard + Free models",
      "1536px image / 720p video",
      "100 songs/month",
      "10 music videos/month",
      "1 brand kit",
    ],
  },
  {
    name: "pro",
    displayName: "Pro",
    price: 1900, // $19/mo
    yearlyPrice: 18200, // $182/yr ($15.17/mo)
    monthlyCredits: 10000,
    features: [
      "10,000 credits/month",
      "Quality + Premium models",
      "2048px image / 1080p video",
      "Unlimited songs & music videos",
      "Priority queue",
      "Marketplace buying",
      "3 brand kits",
      "3,000 credit rollover",
    ],
  },
  {
    name: "studio",
    displayName: "Studio",
    price: 3900, // $39/mo
    yearlyPrice: 37400, // $374/yr ($31.17/mo)
    monthlyCredits: 30000,
    features: [
      "30,000 credits/month",
      "All models including Ultra",
      "4096px image / 4K video",
      "Song stems + MIDI export",
      "Marketplace selling (85%)",
      "3 team seats",
      "10 brand kits",
      "15,000 credit rollover",
    ],
  },
  {
    name: "business",
    displayName: "Business",
    price: 7900, // $79/mo
    yearlyPrice: 75800, // $758/yr ($63.17/mo)
    monthlyCredits: 100000,
    features: [
      "100,000 credits/month",
      "Everything in Studio",
      "API access (5,000 req/hr)",
      "10 team seats",
      "Marketplace selling (90%)",
      "Unlimited brand kits",
      "50,000 credit rollover",
    ],
  },
  {
    name: "agency",
    displayName: "Agency",
    price: 14900, // $149/mo
    yearlyPrice: 143000, // $1,430/yr ($119.17/mo)
    monthlyCredits: 300000,
    features: [
      "300,000 credits/month",
      "Everything in Business",
      "API access (20,000 req/hr)",
      "25 team seats",
      "White-label exports",
      "3 custom LoRAs included",
      "200,000 credit rollover",
      "Dedicated support",
    ],
  },
] as const;

/** One-time credit pack purchases */
export const CREDIT_PACKS = [
  { id: "pack-500", name: "500 Credits", credits: 500, price: 499, perCredit: "$0.01" },
  { id: "pack-2500", name: "2,500 Credits", credits: 2500, price: 1999, perCredit: "$0.008" },
  { id: "pack-7500", name: "7,500 Credits", credits: 7500, price: 4999, perCredit: "$0.007" },
  { id: "pack-25000", name: "25,000 Credits", credits: 25000, price: 14999, perCredit: "$0.006" },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];
export type PlanName = (typeof SUBSCRIPTION_PLANS)[number]["name"];

// ─── Helper: get credit cost for a model-based generation ──────────────────
/**
 * Returns the credit cost for a generation based on the model tier and content type.
 * @param contentType - "image" | "video"
 * @param modelTier - The model's tier (free/standard/quality/premium/ultra)
 */
export function getModelCreditCost(
  contentType: "image" | "video",
  modelTier: ModelTier,
): number {
  return MODEL_CREDIT_COSTS[contentType][modelTier] ?? MODEL_CREDIT_COSTS[contentType].standard;
}

/**
 * Returns audio credit cost by audio type.
 */
export function getAudioCreditCost(
  audioType: "tts_free" | "tts_premium" | "music" | "sfx",
): number {
  return MODEL_CREDIT_COSTS.audio[audioType] ?? 5;
}
