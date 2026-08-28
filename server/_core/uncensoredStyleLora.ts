/**
 * Server-side LoRA resolution for uncensored image styles.
 *
 * Kept OUT of the shared style registry so a LoRA can be tuned/added purely via
 * env — no code change, no client rebuild, and the weights URL never ships in
 * the browser bundle. Each style optionally maps to a Wan/Flux NSFW LoRA
 * (HuggingFace repo id or a direct .safetensors URL); the worker's handle_flux
 * already loads `lora_id`. Unset → prompt-engineering only (safe default).
 *
 *   UNCENSORED_LORA_REALISTIC=some-org/flux-realism-nsfw-lora
 *   UNCENSORED_LORA_ANIME=https://.../anime-nsfw.safetensors
 *   UNCENSORED_LORA_FANTASY=...
 *   UNCENSORED_LORA_ARTISTIC=...
 *   UNCENSORED_LORA_DEFAULT=...   (applied to any style with no specific LoRA)
 */
import { DEFAULT_UNCENSORED_STYLE } from "../../shared/uncensoredStyles";

/**
 * Known-good Flux Schnell realism LoRA. Env still wins so we can swap weights
 * without a deploy; this default means production isn't prompt-only just
 * because UNCENSORED_LORA_REALISTIC wasn't copied to Vercel.
 */
export const BUILTIN_REALISM_LORA =
  "hugovntr/flux-schnell-realism::schnell-realism_v2.3.safetensors";

const BUILTIN_UNCENSORED_LORAS: Record<string, string> = {
  realistic: BUILTIN_REALISM_LORA,
  cinematic: BUILTIN_REALISM_LORA,
  analog: BUILTIN_REALISM_LORA,
};

export function resolveUncensoredLora(styleId: string | null | undefined): string | undefined {
  // Empty/unspecified style is treated as the default aesthetic (realistic), so
  // the LoRA matches the prompt styling applyUncensoredStyle() already applies.
  const id = (styleId && styleId.trim()) || DEFAULT_UNCENSORED_STYLE;
  const key = id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const specific = (process.env[`UNCENSORED_LORA_${key}`] || "").trim();
  const fallback = (process.env.UNCENSORED_LORA_DEFAULT || "").trim();
  const builtin = BUILTIN_UNCENSORED_LORAS[id];
  return specific || fallback || builtin || undefined;
}
