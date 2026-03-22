import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tRPC needs server actions or API routes
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
