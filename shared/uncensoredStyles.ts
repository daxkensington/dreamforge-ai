/**
 * Uncensored image styles — the quality/realism lever for the NSFW niche.
 *
 * Competitors (Promptchan, SoulGen, Candy…) win on tuned output, not raw model
 * access. Each style steers the unfiltered Flux chain with a curated prompt
 * suffix (and, server-side, an optional NSFW LoRA — see server/_core/
 * uncensoredStyleLora.ts). The style ids line up with the winnable keyword
 * landers (realistic / anime / fantasy nsfw generator) in uncensoredLanding.ts.
 *
 * SFW-safe here: these describe render aesthetics, not explicit content. The
 * moderation gate still refuses illegal prompts regardless of style.
 */
export interface UncensoredStyle {
  id: string;
  label: string;
  /** Appended to the user prompt to steer aesthetic/quality. */
  promptSuffix: string;
}

export const UNCENSORED_STYLES: UncensoredStyle[] = [
  {
    id: "realistic",
    label: "Realistic",
    promptSuffix:
      "photorealistic, ultra detailed, professional photography, natural skin texture with visible pores, correct anatomy, natural proportions, soft cinematic lighting, sharp focus, 85mm portrait lens, high dynamic range",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    promptSuffix:
      "cinematic still, anamorphic lens flare, dramatic motivated lighting, film grain, color-graded, 35mm movie frame, shallow depth of field, correct anatomy",
  },
  {
    id: "analog",
    label: "Analog film",
    promptSuffix:
      "shot on Kodak Portra 400, 35mm film, natural grain, candid photography, available light, true-to-life skin, slight halation, correct anatomy",
  },
  {
    id: "anime",
    label: "Anime",
    promptSuffix:
      "high quality anime illustration, detailed anime art style, clean lineart, vibrant cel shading, expressive, studio-quality key visual",
  },
  {
    id: "render3d",
    label: "3D render",
    promptSuffix:
      "octane render, blender, subsurface scattering skin, cinematic lighting, ultra detailed 3D character, physically based materials",
  },
  {
    id: "fantasy",
    label: "Fantasy",
    promptSuffix:
      "fantasy digital painting, highly detailed, dramatic volumetric lighting, epic atmosphere, artstation trending, concept-art quality, correct anatomy",
  },
  {
    id: "artistic",
    label: "Artistic",
    promptSuffix:
      "fine-art figure study, painterly, dramatic chiaroscuro lighting, masterful composition, rich detail, gallery quality",
  },
];

export const DEFAULT_UNCENSORED_STYLE = "realistic";

export function getUncensoredStyle(id: string | null | undefined): UncensoredStyle {
  return (
    UNCENSORED_STYLES.find((s) => s.id === id) ??
    UNCENSORED_STYLES.find((s) => s.id === DEFAULT_UNCENSORED_STYLE)!
  );
}

/** Build the final prompt for an uncensored image gen with a style applied. */
export function applyUncensoredStyle(prompt: string, styleId: string | null | undefined): string {
  const style = getUncensoredStyle(styleId);
  return `${prompt}. ${style.promptSuffix}. 100% fictional synthetic content, no real people depicted.`;
}
