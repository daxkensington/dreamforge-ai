import { auth } from "../../client/src/lib/auth";
import * as db from "../db";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  user: User | null;
  session: any;
  /** Caller IP (best-effort), used for IP-keyed rate limits on public procedures. */
  ip: string | null;
};

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

function extractIp(req?: Request): string | null {
  if (!req) return null;
  return getClientIp(req.headers);
}

export async function createContext(req?: Request): Promise<TrpcContext> {
  let user: User | null = null;
  const ip = extractIp(req);

  try {
    // Get NextAuth session
    const session = await auth();

    if (session?.user?.email) {
      // Look up or create user in our DB
      const found = await db.getUserByEmail(session.user.email);
      user = found ?? null;

      if (!user && session.user.email) {
        // Auto-create user on first sign-in
        await db.upsertUser({
          openId: session.user.id || session.user.email,
          name: session.user.name || null,
          email: session.user.email,
          loginMethod: (session as any).provider || "oauth",
          lastSignedIn: new Date(),
        });
        const created = await db.getUserByEmail(session.user.email);
        user = created ?? null;
      } else if (user) {
        // Bump lastSignedIn on return visits. Without this the column keeps its
        // account-creation value forever, so every user looks like they never
        // came back. Throttled to 30 min so it isn't a write per request, and
        // isolated so a failed write can never null out an authenticated user.
        const last = user.lastSignedIn ? new Date(user.lastSignedIn).getTime() : 0;
        if (Date.now() - last > 30 * 60 * 1000) {
          try {
            await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
          } catch {
            // telemetry only — never fail the request over it
          }
        }
      }
    }
  } catch (error) {
    user = null;
  }

  return { user, session: null, ip };
}
