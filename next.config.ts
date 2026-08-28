import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // tRPC needs server actions or API routes
  serverExternalPackages: ["@neondatabase/serverless"],
  async redirects() {
    return [
      // Forge (and leftover bookmarks) used to invent /tools/refine — Refine
      // lives on the uncensored page and needs a pass, not a standalone tool.
      { source: "/tools/refine", destination: "/uncensored", permanent: true },
      { source: "/refine", destination: "/uncensored", permanent: true },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "vakaygo",
  project: "dreamforge",
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
});
