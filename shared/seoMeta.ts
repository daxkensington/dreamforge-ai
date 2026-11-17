/**
 * Shared SERP title & meta-description length guards.
 *
 * Google desktop/mobile SERPs begin truncating <title> past ~60 characters and
 * <meta name="description"> past ~158 characters. Static routes carry crafted
 * titles/descriptions within budget; dynamic routes (/marketplace/[id], /g/[id],
 * /blog/[slug], /uncensored/[slug]) run through these helpers so user-supplied
 * or long-form strings never overflow SERP limits.
 */

export const MAX_SEO_TITLE_CHARS = 60;
export const MAX_SEO_DESCRIPTION_CHARS = 158;

const TRAILING_BRAND_RE =
  /\s*(?:\||—|–|-)\s*DreamForgeX(?:\s+Marketplace)?\s*$/i;

export function formatSeoTitle(
  rawTitle: string,
  brandSuffix = " | DreamForgeX",
  maxLen = MAX_SEO_TITLE_CHARS,
): string {
  const collapsed = rawTitle.replace(/\s+/g, " ").trim();
  if (!collapsed) return "DreamForgeX";
  if (collapsed.length <= maxLen) return collapsed;

  const core = collapsed.replace(TRAILING_BRAND_RE, "").trim();
  const budget = maxLen - brandSuffix.length;
  if (budget <= 10) {
    return collapsed.slice(0, maxLen - 1).trimEnd() + "…";
  }
  if (core.length <= budget) {
    return `${core}${brandSuffix}`;
  }

  const window = core.slice(0, budget);
  for (const sep of [" — ", " – ", ": ", " - ", ", "]) {
    const idx = window.lastIndexOf(sep);
    if (idx >= Math.floor(budget * 0.5)) {
      return `${window.slice(0, idx).trimEnd()}${brandSuffix}`;
    }
  }

  const wordWindow = core.slice(0, budget - 1);
  const lastSpace = wordWindow.lastIndexOf(" ");
  const trimmed =
    lastSpace >= Math.floor((budget - 1) * 0.5)
      ? wordWindow.slice(0, lastSpace)
      : wordWindow;
  const cleaned = trimmed.replace(/[\s,;:—–-]+$/, "");
  return `${cleaned}…${brandSuffix}`;
}

export function formatSeoDescription(
  rawDescription: string,
  maxLen = MAX_SEO_DESCRIPTION_CHARS,
): string {
  const collapsed = rawDescription.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLen) return collapsed;

  const window = collapsed.slice(0, maxLen);
  const lastPeriod = window.lastIndexOf(". ");
  if (lastPeriod >= Math.floor(maxLen * 0.6)) {
    return window.slice(0, lastPeriod + 1);
  }
  if (window.endsWith(".")) return window;

  const wordWindow = collapsed.slice(0, maxLen - 1);
  const lastSpace = wordWindow.lastIndexOf(" ");
  const trimmed =
    lastSpace >= Math.floor((maxLen - 1) * 0.6)
      ? wordWindow.slice(0, lastSpace)
      : wordWindow;
  const cleaned = trimmed.replace(/[\s,;:—–-]+$/, "");
  return `${cleaned}…`;
}
