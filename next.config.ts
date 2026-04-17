import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // tRPC needs server actions or API routes
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default withSentryConfig(nextConfig, {
  org: "vakaygo",
  project: "dreamforge",
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
});
