/**
 * Credit costs for every generation/tool operation.
 * Imported by both client (to show costs) and server (to deduct).
 */

export const CREDIT_COSTS = {
  imageGeneration: { basic: 5, hd: 10, ultra: 20 },
  videoGeneration: { short5s: 50, medium10s: 100, long30s: 250 },
  audioGeneration: { sfx: 15, music30s: 30, voiceover: 25 },
  imageToVideo: { basic: 40, premium: 80 },
  upscale: { x2: 10, x4: 20 },
  promptEnhance: 2,
  batchMultiplier: 0.9, // 10% discount on batch operations
} as const;

/** Flat lookup for legacy tool-name based deductions (backwards compat with existing CREDIT_COSTS in stripe.ts) */
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
    monthlyCredits: 0, // daily credits instead (100/day)
    features: [
      "100 images/day (free models)",
      "5 songs/day (watermarked)",
      "3 videos/day (480p, watermarked)",
      "All 63+ tools with limits",
      "Non-commercial use only",
    ],
  },
  {
    name: "pro",
    displayName: "Pro",
    price: 1200, // $12/mo
    monthlyCredits: 5000,
    features: [
      "5,000 credits/month",
      "No watermarks",
      "Commercial use rights",
      "All 20 AI models",
      "HD exports (2048px / 1080p)",
      "100 songs/month",
      "Priority queue",
    ],
  },
  {
    name: "studio",
    displayName: "Studio",
    price: 2900, // $29/mo
    monthlyCredits: 15000,
    features: [
      "15,000 credits/month",
      "Everything in Pro",
      "4K video exports",
      "Unlimited music videos",
      "Song stems + MIDI export",
      "Marketplace selling (85%)",
      "5 brand kits",
    ],
  },
  {
    name: "enterprise",
    displayName: "Enterprise",
    price: 7900, // $79/mo
    monthlyCredits: 50000,
    features: [
      "50,000 credits/month",
      "Everything in Studio",
      "API access (2,000 req/hr)",
      "5 team seats",
      "White-label exports",
      "Unlimited brand kits",
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
