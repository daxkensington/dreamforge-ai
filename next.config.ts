import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Baseline hardening headers. Applied to every route (including /api — a CSP
// on API responses is harmless noise, and excluding it would complicate the
// matcher without benefit; webhook POSTs don't break on response headers).
// The CSP is production-only: Next.js dev needs 'unsafe-eval' + websocket HMR,
// which we deliberately do not allow in the deployed policy.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No client-side camera/mic/geolocation usage — voice transcription and all
  // media work happen server-side via provider APIs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-inline' required by Next.js inline bootstrap/flight scripts.
  // connect.facebook.net is the Meta Pixel loader (app/MetaPixel.tsx).
  "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline'",
  // Gallery/media are served from R2/S3 https origins; data:/blob: for previews.
  "img-src 'self' data: blob: https:",
  "media-src 'self' https: blob:",
  // Sentry events go through the same-origin /monitoring tunnel (tunnelRoute
  // in the Sentry wrapper below); the sentry.io origins cover direct sends.
  // facebook.com is the Meta Pixel event endpoint (fbq XHR to /tr).
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://www.facebook.com https://graph.facebook.com",
  // next/font serves fonts from same-origin; data: for inline icon fonts.
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // tRPC needs server actions or API routes
  serverExternalPackages: ["@neondatabase/serverless"],
  // Baseline image optimization: serve AVIF/WebP from next/image where it's
  // adopted. Remote R2/S3 gallery media stays on the default loader (https:
  // CSP img-src already allows it) — remotePatterns intentionally not locked
  // down yet to avoid breaking the 254 raw <img> galleries on remote URLs.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      // Forge (and leftover bookmarks) used to invent /tools/refine — Refine
      // lives on the uncensored page and needs a pass, not a standalone tool.
      { source: "/tools/refine", destination: "/uncensored", permanent: true },
      { source: "/refine", destination: "/uncensored", permanent: true },
    ];
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: contentSecurityPolicy });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default withSentryConfig(nextConfig, {
  org: "vakaygo",
  project: "dreamforge",
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
});
