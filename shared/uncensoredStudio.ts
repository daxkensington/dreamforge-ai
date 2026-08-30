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

export interface UncensoredCamera {
  id: string;
  label: string;
  promptSuffix: string;
}

export const UNCENSORED_CAMERAS: UncensoredCamera[] = [
  {
    id: "eyelevel",
    label: "Eye level",
    promptSuffix: "eye-level camera, natural perspective",
  },
  {
    id: "low",
    label: "Low angle",
    promptSuffix: "low-angle shot looking up, heroic perspective, 35mm",
  },
  {
    id: "high",
    label: "High angle",
    promptSuffix: "high-angle shot looking down, intimate overhead perspective",
  },
  {
    id: "dutch",
    label: "Dutch angle",
    promptSuffix: "dutch angle, tilted camera, cinematic tension",
  },
  {
    id: "overshoulder",
    label: "Over-shoulder",
    promptSuffix: "over-the-shoulder camera, cinematic coverage",
  },
];

export function getUncensoredCamera(id: string | null | undefined): UncensoredCamera | null {
  if (!id) return null;
  return UNCENSORED_CAMERAS.find((c) => c.id === id) ?? null;
}

export function applyUncensoredCamera(prompt: string, cameraId: string | null | undefined): string {
  const camera = getUncensoredCamera(cameraId);
  return camera ? `${prompt}. ${camera.promptSuffix}` : prompt;
}

export interface UncensoredLighting {
  id: string;
  label: string;
  promptSuffix: string;
}

/** Exclusive lighting, same idea as pose — stacking golden hour + neon is noise. */
export const UNCENSORED_LIGHTING: UncensoredLighting[] = [
  {
    id: "golden",
    label: "Golden hour",
    promptSuffix: "golden hour sunlight, warm rim light, glowing skin",
  },
  {
    id: "neon",
    label: "Neon night",
    promptSuffix: "neon-lit night, cyan and magenta practicals, wet pavement reflections",
  },
  {
    id: "studio",
    label: "Studio",
    promptSuffix: "soft studio lighting, beauty dish, clean seamless backdrop",
  },
  {
    id: "candle",
    label: "Candlelight",
    promptSuffix: "candlelight, warm chiaroscuro, intimate low-key lighting",
  },
  {
    id: "rain",
    label: "Rain",
    promptSuffix: "rain-soaked, specular highlights, moody atmosphere",
  },
  {
    id: "film",
    label: "Film still",
    promptSuffix: "cinematic film still, anamorphic bokeh, color-graded",
  },
];

export function getUncensoredLighting(id: string | null | undefined): UncensoredLighting | null {
  if (!id) return null;
  return UNCENSORED_LIGHTING.find((l) => l.id === id) ?? null;
}

export function applyUncensoredLighting(prompt: string, lightingId: string | null | undefined): string {
  const lighting = getUncensoredLighting(lightingId);
  return lighting ? `${prompt}. ${lighting.promptSuffix}` : prompt;
}

export interface UncensoredWardrobe {
  id: string;
  label: string;
  promptSuffix: string;
}

/** Clothing / styling — exclusive, like pose. Content still stays in the user's prompt. */
export const UNCENSORED_WARDROBE: UncensoredWardrobe[] = [
  {
    id: "dress",
    label: "Dress",
    promptSuffix: "wearing a flowing dress, fashion editorial",
  },
  {
    id: "silk",
    label: "Silk",
    promptSuffix: "wearing silk, soft drapery, specular highlights on fabric",
  },
  {
    id: "lingerie",
    label: "Lingerie",
    promptSuffix: "delicate lingerie, boudoir photography, soft fabric detail",
  },
  {
    id: "swimsuit",
    label: "Swimsuit",
    promptSuffix: "wearing a swimsuit, wet skin highlights, sun on water",
  },
  {
    id: "casual",
    label: "Casual",
    promptSuffix: "oversized shirt, casual at-home look, relaxed styling",
  },
  {
    id: "evening",
    label: "Evening",
    promptSuffix: "evening gown, red-carpet styling, elegant tailoring",
  },
  {
    id: "leather",
    label: "Leather",
    promptSuffix: "black leather outfit, editorial fashion, sharp tailoring",
  },
  {
    id: "knit",
    label: "Knit",
    promptSuffix: "cozy knitwear, intimate indoor look, soft texture",
  },
];

export function getUncensoredWardrobe(id: string | null | undefined): UncensoredWardrobe | null {
  if (!id) return null;
  return UNCENSORED_WARDROBE.find((w) => w.id === id) ?? null;
}

export function applyUncensoredWardrobe(prompt: string, wardrobeId: string | null | undefined): string {
  const wardrobe = getUncensoredWardrobe(wardrobeId);
  return wardrobe ? `${prompt}. ${wardrobe.promptSuffix}` : prompt;
}

export interface UncensoredSetting {
  id: string;
  label: string;
  promptSuffix: string;
}

export const UNCENSORED_SETTINGS: UncensoredSetting[] = [
  {
    id: "bedroom",
    label: "Bedroom",
    promptSuffix: "in a bedroom, rumpled sheets, warm practical lamps",
  },
  {
    id: "bathroom",
    label: "Bathroom",
    promptSuffix: "in a bathroom, steamed mirror, marble and chrome, soft moisture in the air",
  },
  {
    id: "balcony",
    label: "Balcony",
    promptSuffix: "on a night balcony, city lights bokeh, warm interior spill",
  },
  {
    id: "beach",
    label: "Beach",
    promptSuffix: "on a beach at dusk, wet sand, ocean horizon",
  },
  {
    id: "hotel",
    label: "Hotel",
    promptSuffix: "in a luxury hotel suite, floor-to-ceiling windows, cinematic interior",
  },
  {
    id: "club",
    label: "Club",
    promptSuffix: "in a nightclub, neon practicals, haze, colored gels",
  },
  {
    id: "forest",
    label: "Forest",
    promptSuffix: "in a misty forest, dappled light through trees",
  },
  {
    id: "loft",
    label: "Loft",
    promptSuffix: "in an industrial loft, large windows, concrete and linen",
  },
];

export function getUncensoredSetting(id: string | null | undefined): UncensoredSetting | null {
  if (!id) return null;
  return UNCENSORED_SETTINGS.find((s) => s.id === id) ?? null;
}

export function applyUncensoredSetting(prompt: string, settingId: string | null | undefined): string {
  const setting = getUncensoredSetting(settingId);
  return setting ? `${prompt}. ${setting.promptSuffix}` : prompt;
}

export function formatUncensoredRecipe(input: {
  prompt: string;
  style?: string | null;
  aspect?: string | null;
  framing?: string | null;
  pose?: string | null;
  camera?: string | null;
  lighting?: string | null;
  wardrobe?: string | null;
  setting?: string | null;
  seed?: number | null;
}): string {
  const bits: string[] = [];
  if (input.style) bits.push(`style ${input.style}`);
  if (input.aspect) bits.push(input.aspect);
  if (input.framing) bits.push(`framing ${input.framing}`);
  if (input.pose) bits.push(`pose ${input.pose}`);
  if (input.camera) bits.push(`camera ${input.camera}`);
  if (input.lighting) bits.push(input.lighting);
  if (input.wardrobe) bits.push(input.wardrobe);
  if (input.setting) bits.push(input.setting);
  if (typeof input.seed === "number") bits.push(`seed ${input.seed}`);
  return bits.length ? `${input.prompt}\n${bits.join(" · ")}` : input.prompt;
}

export interface UncensoredVideoMotion {
  id: string;
  label: string;
  promptSuffix: string;
}

export const UNCENSORED_VIDEO_MOTIONS: UncensoredVideoMotion[] = [
  {
    id: "turn",
    label: "Turn to camera",
    promptSuffix: "slow turn toward camera, natural motion",
  },
  {
    id: "sway",
    label: "Sway",
    promptSuffix: "slow body sway, weight shifting, natural hips",
  },
  {
    id: "lean",
    label: "Lean in",
    promptSuffix: "leans toward camera, intimate approach",
  },
  {
    id: "approach",
    label: "Walk in",
    promptSuffix: "walks toward camera, closing the distance, smooth gait",
  },
  {
    id: "still",
    label: "Mostly still",
    promptSuffix: "subject mostly still, only breathing and slight hair movement",
  },
  {
    id: "hair",
    label: "Hair in wind",
    promptSuffix: "hair blowing in the wind, subtle body movement",
  },
  {
    id: "breathe",
    label: "Breathing",
    promptSuffix: "subtle breathing, slight chest movement, still otherwise",
  },
  {
    id: "walk",
    label: "Walk forward",
    promptSuffix: "walking toward camera, natural gait, smooth motion",
  },
  {
    id: "look",
    label: "Look around",
    promptSuffix: "looks around slowly, eyes scanning, gentle head turn",
  },
  {
    id: "smile",
    label: "Smile",
    promptSuffix: "expression shifts into a smile, natural facial motion",
  },
  {
    id: "pan",
    label: "Camera pan",
    promptSuffix: "slow cinematic camera pan, subject mostly still",
  },
  {
    id: "zoom",
    label: "Slow zoom",
    promptSuffix: "slow zoom in, subtle subject movement",
  },
];

export function getUncensoredVideoMotion(id: string | null | undefined): UncensoredVideoMotion | null {
  if (!id) return null;
  return UNCENSORED_VIDEO_MOTIONS.find((m) => m.id === id) ?? null;
}

export function applyUncensoredVideoMotion(prompt: string, motionId: string | null | undefined): string {
  const motion = getUncensoredVideoMotion(motionId);
  return motion ? `${prompt}. ${motion.promptSuffix}` : prompt;
}

export interface UncensoredVideoIntensity {
  id: string;
  label: string;
  promptSuffix: string;
}

export const UNCENSORED_VIDEO_INTENSITIES: UncensoredVideoIntensity[] = [
  {
    id: "subtle",
    label: "Subtle",
    promptSuffix: "very subtle motion, almost still, only breathing and micro-movements",
  },
  {
    id: "natural",
    label: "Natural",
    promptSuffix: "natural moderate motion, smooth and continuous",
  },
  {
    id: "energetic",
    label: "Energetic",
    promptSuffix: "strong dynamic motion, energetic, continuous movement",
  },
];

export const DEFAULT_UNCENSORED_VIDEO_INTENSITY = "natural";

export function getUncensoredVideoIntensity(id: string | null | undefined): UncensoredVideoIntensity {
  return (
    UNCENSORED_VIDEO_INTENSITIES.find((i) => i.id === id) ??
    UNCENSORED_VIDEO_INTENSITIES.find((i) => i.id === DEFAULT_UNCENSORED_VIDEO_INTENSITY)!
  );
}

export function applyUncensoredVideoIntensity(prompt: string, intensityId: string | null | undefined): string {
  const intensity = getUncensoredVideoIntensity(intensityId);
  return `${prompt}. ${intensity.promptSuffix}`;
}

/** I2V must lock to the source frame or the clip drifts off the character. */
export const UNCENSORED_I2V_IDENTITY =
  "Animate the person in the first frame. Keep the same face, same body, same identity throughout the clip";

export function applyUncensoredI2vIdentity(prompt: string, isI2v: boolean): string {
  return isI2v ? `${UNCENSORED_I2V_IDENTITY}. ${prompt}` : prompt;
}

export const DEFAULT_UNCENSORED_VIDEO_NEGATIVE =
  "blurry, low quality, distorted, deformed, extra limbs, extra fingers, morphing face, identity change, watermark, text";

export type UncensoredVideoAspect = "portrait" | "landscape" | "square";
export type UncensoredVideoQuality = "fast" | "hd";

export const UNCENSORED_VIDEO_SIZES: Record<
  UncensoredVideoQuality,
  Record<UncensoredVideoAspect, { w: number; h: number }>
> = {
  fast: {
    portrait: { w: 480, h: 832 },
    landscape: { w: 832, h: 480 },
    square: { w: 640, h: 640 },
  },
  hd: {
    portrait: { w: 720, h: 1280 },
    landscape: { w: 1280, h: 720 },
    square: { w: 768, h: 768 },
  },
};

export function getUncensoredVideoSize(
  aspect: UncensoredVideoAspect,
  quality: UncensoredVideoQuality,
): { w: number; h: number } {
  return UNCENSORED_VIDEO_SIZES[quality][aspect];
}

/** Pick the Wan frame that won't stretch the source still. */
export function getUncensoredVideoAspectFromSize(
  width?: number | null,
  height?: number | null,
): UncensoredVideoAspect {
  if (!width || !height) return "portrait";
  const r = width / height;
  if (r >= 1.2) return "landscape";
  if (r <= 0.85) return "portrait";
  return "square";
}

export const DEFAULT_CHARACTER_STRENGTH = 0.45;
export const CHARACTER_STRENGTH_MIN = 0.25;
export const CHARACTER_STRENGTH_MAX = 0.7;

export function clampCharacterStrength(n: number | null | undefined): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : DEFAULT_CHARACTER_STRENGTH;
  return Math.min(CHARACTER_STRENGTH_MAX, Math.max(CHARACTER_STRENGTH_MIN, v));
}

export function getUncensoredAspectFromSize(width?: number | null, height?: number | null): string {
  const match = UNCENSORED_ASPECTS.find((a) => a.width === width && a.height === height);
  return match?.id ?? DEFAULT_UNCENSORED_ASPECT;
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

export interface UncensoredSheetView {
  id: string;
  label: string;
  promptSuffix: string;
}

/**
 * Four-view identity pack. Same locked character, studio turnaround — the
 * product people actually pay character tools for.
 */
export const UNCENSORED_SHEET_VIEWS: UncensoredSheetView[] = [
  {
    id: "front",
    label: "Front",
    promptSuffix:
      "front view facing camera, bust portrait, even studio lighting, white seamless backdrop, character reference sheet",
  },
  {
    id: "threequarter",
    label: "Three-quarter",
    promptSuffix:
      "three-quarter view, head and torso, even studio lighting, white seamless backdrop, character reference sheet",
  },
  {
    id: "profile",
    label: "Profile",
    promptSuffix:
      "side profile, head in profile, even studio lighting, white seamless backdrop, character reference sheet",
  },
  {
    id: "full",
    label: "Full body",
    promptSuffix:
      "full body standing, head to toe, even studio lighting, white seamless backdrop, character turnaround sheet",
  },
];

export type UncensoredClothType = "upper" | "lower" | "overall";

export type UncensoredVideoDurationId = "5s" | "8s" | "10s";

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
  /** Same 121 frames as 8s, 12fps — longest Wan will go on this worker. */
  { id: "10s", label: "~10s", seconds: 10, numFrames: 121, fps: 12, creditMul: 1.5 },
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
  /** 4-view character sheet (discount vs 4× character lock). */
  sheet: 32,
  /** RMBG-2.0 cutout of one of the caller's own gens. */
  cutout: 5,
  /** CatVTON outfit transfer between two of the caller's own gens. */
  outfit: 10,
  /** Lighting-only img2img — same shot, new light. */
  relight: 8,
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
