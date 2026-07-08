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

export function resolveUncensoredLora(styleId: string | null | undefined): string | undefined {
  // Empty/unspecified style is treated as the default aesthetic (realistic), so
  // the LoRA matches the prompt styling applyUncensoredStyle() already applies.
  const id = (styleId && styleId.trim()) || DEFAULT_UNCENSORED_STYLE;
  const key = id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const specific = process.env[`UNCENSORED_LORA_${key}`];
  const lora = (specific || process.env.UNCENSORED_LORA_DEFAULT || "").trim();
  return lora || undefined;
}
