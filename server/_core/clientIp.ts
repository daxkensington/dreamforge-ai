/**
 * Best-effort caller IP for rate limiting, in descending order of trust:
 *
 *  1. `x-vercel-forwarded-for` — set by Vercel's edge from the actual
 *     connecting peer. A client cannot forge it, and it is a single value.
 *  2. LAST entry of `x-forwarded-for` — every proxy APPENDS the peer it saw,
 *     so the last entry is the one added closest to our server. The FIRST
 *     entry is whatever the client claimed and is trivially spoofable;
 *     keying rate limits on it let attackers mint a fresh IP per request.
 *  3. `x-real-ip` — last resort; only meaningful on a single-proxy setup.
 *
 * Accepts any Headers-like object (Fetch `Headers`, NextRequest `headers`),
 * so the same helper works from the edge middleware, route handlers, and
 * the tRPC context builder.
 */
export function getClientIp(headers: { get(name: string): string | null }): string | null {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    // Platform-verified single value; take the first segment defensively in
    // case a proxy ever appends to it.
    const ip = vercel.split(",")[0]!.trim();
    if (ip) return ip;
  }
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const chain = xff.split(",").map((s) => s.trim()).filter(Boolean);
    // Closest-to-server entry is last; the client-controlled entry is first.
    const closest = chain[chain.length - 1];
    if (closest) return closest;
  }
  const xreal = headers.get("x-real-ip");
  if (xreal) return xreal.trim();
  return null;
}

