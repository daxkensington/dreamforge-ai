import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Prompts, LoRAs & Workflows Marketplace | DreamForgeX",
  description:
    "Buy and sell curated AI prompts, Flux & SDXL LoRAs, style presets, asset packs, and multi-step workflows from creators on the DreamForgeX Marketplace.",
  openGraph: {
    title: "AI Prompts, LoRAs & Workflows Marketplace | DreamForgeX",
    description: "Buy and sell curated AI prompts, LoRAs, presets, and workflows from DreamForgeX creators.",
    images: ["/showcase/home-tool-market.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
