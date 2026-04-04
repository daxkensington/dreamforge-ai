import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Simple in-memory rate limiter for auth endpoints ──────────────────────
const authHits = new Map<string, number[]>();
const AUTH_RATE_LIMIT = 20; // max requests
const AUTH_WINDOW_MS = 60_000; // per minute

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of authHits) {
    const fresh = hits.filter((t) => now - t < AUTH_WINDOW_MS);
    if (fresh.length === 0) authHits.delete(key);
    else authHits.set(key, fresh);
  }
}, 5 * 60_000);

function isAuthRateLimited(ip: string): boolean {
  const now = Date.now();
  let hits = authHits.get(ip);
  if (!hits) {
    hits = [];
    authHits.set(ip, hits);
  }
  // Prune old hits
  const fresh = hits.filter((t) => now - t < AUTH_WINDOW_MS);
  authHits.set(ip, fresh);

  if (fresh.length >= AUTH_RATE_LIMIT) return true;
  fresh.push(now);
  return false;
}

// ─── Combined middleware ───────────────────────────────────────────────────

const authMiddleware = auth;

export default async function middleware(request: NextRequest) {
  // Rate-limit /api/auth paths by IP
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (isAuthRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many authentication requests. Please try again later." },
        { status: 429 },
      );
    }
  }

  // Delegate to NextAuth for session/protection checks
  return (authMiddleware as any)(request);
}

export const config = {
  matcher: [
    "/workspace/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/credits/:path*",
    "/api-keys/:path*",
    "/batch/:path*",
    "/characters/:path*",
    "/video-studio/:path*",
    "/brand-kits/:path*",
    "/notifications/:path*",
    "/api/auth/:path*",
  ],
};
