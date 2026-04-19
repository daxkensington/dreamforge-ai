import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Midjourney — Free Tier, Public API, Video & Audio | DreamForgeX",
  description:
    "Looking for a Midjourney alternative? DreamForgeX gives you Flux + Imagen + DALL-E, video gen, audio, 100+ tools, and a public REST API — starting at $9/mo with a free tier and try-without-signup.",
  alternates: { canonical: "https://dreamforgex.ai/vs/midjourney" },
  openGraph: {
    title: "DreamForgeX vs Midjourney — Compare features and pricing",
    description: "Multi-model image gen + video + audio + 100+ tools + public API. Free tier and try-without-signup demo.",
    url: "https://dreamforgex.ai/vs/midjourney",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
