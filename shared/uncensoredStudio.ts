/**
 * Uncensored studio controls — aspects, framings, quality ladder.
 *
 * Shared so the landing page, the paid studio UI, and the generate mutation
 * never drift on sizes or prices. Portrait is the default: that's the shot
 * this audience actually wants, and square 768 was making every preview look
 * like a cropped afterthought.
 */
export interface UncensoredAspect {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface UncensoredFraming {
  id: string;
  label: string;
  promptSuffix: string;
}

/** Flux-friendly sizes. Portrait first — the NSFW default. */
export const UNCENSORED_ASPECTS: UncensoredAspect[] = [
  { id: "portrait", label: "Portrait", width: 832, height: 1216 },
  { id: "story", label: "Story 9:16", width: 768, height: 1344 },
  { id: "square", label: "Square", width: 1024, height: 1024 },
  { id: "landscape", label: "Landscape", width: 1216, height: 832 },
];

export const DEFAULT_UNCENSORED_ASPECT = "portrait";

export function getUncensoredAspect(id: string | null | undefined): UncensoredAspect {
  return (
    UNCENSORED_ASPECTS.find((a) => a.id === id) ??
    UNCENSORED_ASPECTS.find((a) => a.id === DEFAULT_UNCENSORED_ASPECT)!
  );
}

export const UNCENSORED_FRAMINGS: UncensoredFraming[] = [
  {
    id: "closeup",
    label: "Close-up",
    promptSuffix: "tight close-up portrait, face filling the frame, shallow depth of field, 85mm lens",
  },
  {
    id: "bust",
    label: "Bust",
    promptSuffix: "upper-body portrait, chest-up, looking toward camera, fashion lighting",
  },
  {
    id: "threequarter",
    label: "Three-quarter",
    promptSuffix: "three-quarter view from the thighs up, confident pose, editorial photography",
  },
  {
    id: "fullbody",
    label: "Full body",
    promptSuffix: "full body shot head to toe, standing, fashion photography, even lighting",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    promptSuffix: "cinematic wide shot with environmental context, anamorphic, film still",
  },
];

export function getUncensoredFraming(id: string | null | undefined): UncensoredFraming | null {
  if (!id) return null;
  return UNCENSORED_FRAMINGS.find((f) => f.id === id) ?? null;
}

export function applyUncensoredFraming(prompt: string, framingId: string | null | undefined): string {
  const framing = getUncensoredFraming(framingId);
  return framing ? `${prompt}. ${framing.promptSuffix}` : prompt;
}

/** Credit costs for the paid uncensored image studio. */
export const UNCENSORED_IMAGE_COST = {
  /** Flux Schnell, 4 steps — the iteration loop. */
  fast: 5,
  /** Flux Dev, 20 steps — the keepers. */
  quality: 12,
  /** Same-character img2img (20-step) on one of the caller's own gens. */
  character: 10,
} as const;

export type UncensoredImageQuality = keyof typeof UNCENSORED_IMAGE_COST;
