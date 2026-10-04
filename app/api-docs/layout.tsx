import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "API Documentation — DreamForgeX",
  description: "DreamForgeX REST API reference: API-key authentication, image generation and upscaling endpoints, request/response schemas, and code examples.",
  alternates: { canonical: "https://dreamforgex.ai/api-docs" },
  openGraph: {
    title: "API Documentation — DreamForgeX",
    description: "Integrate DreamForgeX generation endpoints into your own product — auth, endpoints, rate limits, examples.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
