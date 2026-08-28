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

export interface UncensoredPose {
  id: string;
  label: string;
  promptSuffix: string;
}

/** Body language / camera-relative poses. One at a time, like framing. */
export const UNCENSORED_POSES: UncensoredPose[] = [
  {
    id: "standing",
    label: "Standing",
    promptSuffix: "standing pose, weight on one hip, confident posture",
  },
  {
    id: "sitting",
    label: "Sitting",
    promptSuffix: "sitting pose, relaxed, looking toward camera",
  },
  {
    id: "reclining",
    label: "Reclining",
    promptSuffix: "reclining on a surface, stretched out, languid pose",
  },
  {
    id: "kneeling",
    label: "Kneeling",
    promptSuffix: "kneeling pose, looking up toward camera",
  },
  {
    id: "frombehind",
    label: "Over shoulder",
    promptSuffix: "shot from behind, looking back over the shoulder toward camera",
  },
  {
    id: "arching",
    label: "Arched",
    promptSuffix: "arched back, elongated silhouette, editorial pose",
  },
  {
    id: "leaning",
    label: "Leaning",
    promptSuffix: "leaning against a wall, casual confident pose",
  },
];

export function getUncensoredPose(id: string | null | undefined): UncensoredPose | null {
  if (!id) return null;
  return UNCENSORED_POSES.find((p) => p.id === id) ?? null;
}

export function applyUncensoredPose(prompt: string, poseId: string | null | undefined): string {
  const pose = getUncensoredPose(poseId);
  return pose ? `${prompt}. ${pose.promptSuffix}` : prompt;
}

/**
 * Named-character rows live in the shared `characters` table. styleNotes
 * carries this marker plus the source generation id so the uncensored studio
 * can lock identity via img2img, and the SFW character library can hide them.
 */
export const UNCENSORED_CHARACTER_MARKER = "uncensored:";

export function uncensoredCharacterRef(generationId: number): string {
  return `${UNCENSORED_CHARACTER_MARKER}${generationId}`;
}

export function isUncensoredCharacter(styleNotes: string | null | undefined): boolean {
  return typeof styleNotes === "string" && styleNotes.startsWith(UNCENSORED_CHARACTER_MARKER);
}

export function parseUncensoredCharacterRef(styleNotes: string | null | undefined): number | null {
  if (!isUncensoredCharacter(styleNotes)) return null;
  const n = Number(styleNotes!.slice(UNCENSORED_CHARACTER_MARKER.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const UNCENSORED_CHARACTER_LIMIT = 24;

export type UncensoredVideoDurationId = "5s" | "8s";

export interface UncensoredVideoDuration {
  id: UncensoredVideoDurationId;
  label: string;
  /** Wall-clock seconds advertised in the UI. */
  seconds: number;
  /** Wan 4k+1 frame counts. */
  numFrames: number;
  fps: number;
  /** Multiplier on the base t2v/i2v credit cost. */
  creditMul: number;
}

export const UNCENSORED_VIDEO_DURATIONS: UncensoredVideoDuration[] = [
  { id: "5s", label: "~5s", seconds: 5, numFrames: 81, fps: 16, creditMul: 1 },
  { id: "8s", label: "~8s", seconds: 8, numFrames: 121, fps: 16, creditMul: 1.5 },
];

export const DEFAULT_UNCENSORED_VIDEO_DURATION: UncensoredVideoDurationId = "5s";

export function getUncensoredVideoDuration(id: string | null | undefined): UncensoredVideoDuration {
  return (
    UNCENSORED_VIDEO_DURATIONS.find((d) => d.id === id) ??
    UNCENSORED_VIDEO_DURATIONS.find((d) => d.id === DEFAULT_UNCENSORED_VIDEO_DURATION)!
  );
}

export function uncensoredVideoCredits(base: number, durationId: string | null | undefined): number {
  return Math.round(base * getUncensoredVideoDuration(durationId).creditMul);
}

/** Credit costs for the paid uncensored image studio. */
export const UNCENSORED_IMAGE_COST = {
  /** Flux Schnell, 4 steps — the iteration loop. */
  fast: 5,
  /** Flux Dev, 20 steps — the keepers. */
  quality: 12,
  /** Same-character img2img (20-step) on one of the caller's own gens. */
  character: 10,
  /** Paint-region inpaint on one of the caller's own gens. */
  inpaint: 10,
  /** Real-ESRGAN 2×. */
  upscale2x: 8,
  /** Real-ESRGAN 4×. */
  upscale4x: 12,
} as const;

/**
 * Always-on quality negatives. These are anatomy/artifact terms, not content
 * policy — they fight the extra-finger / waxy-skin look that raw Flux Schnell
 * still produces without a LoRA. Merged with any user negative.
 */
export const DEFAULT_UNCENSORED_NEGATIVE =
  "extra fingers, extra limbs, fused fingers, deformed hands, mutated hands, waxy skin, plastic skin, oversmoothed, extra people, cropped head, text, watermark, logo, blurry";

/** One-click prompt seasoning. Aesthetic only — content stays in the user's words. */
export const UNCENSORED_PROMPT_CHIPS: { id: string; label: string; text: string }[] = [
  { id: "golden", label: "Golden hour", text: "golden hour sunlight, warm rim light, glowing skin" },
  { id: "neon", label: "Neon night", text: "neon-lit night, cyan and magenta practicals, wet pavement reflections" },
  { id: "studio", label: "Studio", text: "soft studio lighting, beauty dish, clean seamless backdrop" },
  { id: "candle", label: "Candlelight", text: "candlelight, warm chiaroscuro, intimate low-key lighting" },
  { id: "rain", label: "Rain", text: "rain-soaked, specular highlights, moody atmosphere" },
  { id: "film", label: "Film still", text: "cinematic film still, anamorphic bokeh, color-graded" },
];

export type UncensoredImageQuality = keyof typeof UNCENSORED_IMAGE_COST;
