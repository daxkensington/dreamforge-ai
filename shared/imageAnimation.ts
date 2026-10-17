/** Fal's published 480p rate is $0.05/s (verified 2026-10-17).
 * Five seconds cost $0.25. The 5,170 credits/USD margin floor rounds up. */
export const IMAGE_ANIMATION_POLICY = {
  modelId: "fal-ai/wan-25-preview/image-to-video",
  name: "Wan 2.5 image animation",
  duration: 5,
  resolution: "480p",
  creditCost: Math.ceil(0.25 * 5170),
  requiredTier: "creator",
} as const;
