/**
 * Provider-error sanitizer — strips internal details before errors are
 * returned to clients.
 *
 * Backend audit flagged that raw provider errors (e.g. "Gemini image gen
 * failed (429): https://generativelanguage.googleapis.com/...") leak our
 * architecture: which providers we use, their endpoints, and in the worst
 * case fragments of internal IDs or API keys embedded in error bodies.
 *
 * This module gives a single chokepoint we can route any provider error
 * through before returning, plus a passthrough for server-side logs
 * (we still want the full details in Sentry / Vercel logs).
 */

// Map of substrings to generic labels. When a provider's error leaks its
// hostname or model-id, we swap in the label so the user just sees
// "Image generation temporarily unavailable" instead of the provider name.
// Ordered: most-specific first. Patterns later in the list only see what
// earlier ones left behind, so reorder carefully when adding new entries.
const SENSITIVE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // Bearer headers — run FIRST so we don't partially-redact a Bearer
  // header and leave a useless "Bearer [redacted]" fragment behind.
  { regex: /Bearer\s+[A-Za-z0-9._-]+/g, label: "[auth]" },

  // API key patterns (defensive — providers sometimes echo keys back).
  { regex: /sk-[a-zA-Z0-9_-]{15,}/g, label: "[redacted]" },
  { regex: /xai-[a-zA-Z0-9_-]{15,}/g, label: "[redacted]" },
  { regex: /r8_[a-zA-Z0-9]{15,}/g, label: "[redacted]" },
  { regex: /whsec_[a-zA-Z0-9]{15,}/g, label: "[redacted]" },

  // API hostnames, optionally preceded by scheme so the full URL is
  // captured (prevents the generic URL catch-all from later mangling
  // "[provider]" into "[url]").
  { regex: /(?:https?:\/\/)?api\.openai\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?generativelanguage\.googleapis\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.anthropic\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.x\.ai[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.replicate\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.runpod\.ai[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.together\.xyz[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?fal\.ai[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?fal\.run[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.stability\.ai[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.runwayml\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.groq\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.cloudflare\.com[^\s]*/gi, label: "[provider]" },
  { regex: /(?:https?:\/\/)?api\.klingai\.com[^\s]*/gi, label: "[provider]" },

  // Generic URL catch-all — last resort. Won't touch bracket-labeled
  // replacements from earlier patterns because [provider] / [auth] don't
  // start with http.
  { regex: /https?:\/\/[^\s]+/gi, label: "[url]" },
];

// Patterns where we want to REPLACE the whole message with a clean one
// because the raw content is mostly noise (HTML error pages, stack traces).
const NOISY_MESSAGE_PATTERNS: Array<{ regex: RegExp; clean: string }> = [
  { regex: /<html[\s\S]*?<\/html>/i, clean: "Upstream provider returned an HTML error page." },
  { regex: /at\s+\/?[\w/.]+\.(?:ts|js):\d+/, clean: "Internal error processing the request." },
];

/**
 * Sanitize an error message for client return. Keep the semantic content
 * (user still gets "Rate limited, try again in 30s") but scrub endpoints,
 * keys, and deep stack traces.
 */
export function sanitizeErrorMessage(msg: string | undefined | null): string {
  if (!msg) return "An unexpected error occurred. Please try again.";

  let result = String(msg);

  // Clean whole-message patterns first.
  for (const { regex, clean } of NOISY_MESSAGE_PATTERNS) {
    if (regex.test(result)) return clean;
  }

  // Then per-substring patterns.
  for (const { regex, label } of SENSITIVE_PATTERNS) {
    result = result.replace(regex, label);
  }

  // Cap length so no 10KB error blob ever hits the client.
  if (result.length > 300) {
    result = result.slice(0, 297) + "...";
  }

  return result.trim();
}

/**
 * Wrap an unknown caught value (Error, string, anything) into a clean
 * client-facing message. The original is preserved server-side via console
 * so Sentry and Vercel logs still have it for debugging.
 */
export function safeErrorMessage(err: unknown, context?: string): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);

  // Log the full raw error server-side so debugging is still possible.
  const prefix = context ? `[${context}] ` : "";
  console.error(`${prefix}${raw}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }

  return sanitizeErrorMessage(raw);
}
