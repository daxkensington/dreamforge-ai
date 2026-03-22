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
    displayName: "Free",
    price: 0,
    monthlyCredits: 1500,
    features: [
      "1,500 credits/month",
      "Basic image generation",
      "Community gallery access",
      "Standard queue priority",
    ],
  },
  {
    name: "creator",
    displayName: "Creator",
    price: 1200, // $12/mo
    monthlyCredits: 30000,
    features: [
      "30,000 credits/month",
      "HD image generation",
      "Video generation (up to 10s)",
      "Priority queue",
      "Brand kit (1)",
      "API access (100 req/hr)",
    ],
  },
  {
    name: "pro",
    displayName: "Pro",
    price: 3500, // $35/mo
    monthlyCredits: 150000,
    features: [
      "150,000 credits/month",
      "Ultra HD generation",
      "Video generation (up to 30s)",
      "Highest queue priority",
      "Brand kits (5)",
      "API access (500 req/hr)",
      "Batch generation",
      "Character consistency",
    ],
  },
  {
    name: "studio",
    displayName: "Studio",
    price: 7500, // $75/mo
    monthlyCredits: 450000,
    features: [
      "450,000 credits/month",
      "Everything in Pro",
      "Unlimited brand kits",
      "API access (2000 req/hr)",
      "Team collaboration (5 seats)",
      "Priority support",
      "Custom model fine-tuning",
    ],
  },
  {
    name: "enterprise",
    displayName: "Enterprise",
    price: 0, // custom pricing
    monthlyCredits: 0, // custom
    features: [
      "Custom credit allocation",
      "Everything in Studio",
      "Unlimited team seats",
      "Dedicated support",
      "SLA guarantee",
      "Custom API limits",
      "On-premise option",
      "Custom model training",
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
