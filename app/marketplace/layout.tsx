import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace — DreamForge",
  description: "Buy and sell AI-generated prompts, presets, workflows, asset packs, and LoRAs from the DreamForge creator community.",
  openGraph: {
    title: "Creator Marketplace — DreamForge",
    description: "Discover premium AI prompts, presets, and workflows from talented creators.",
    images: ["/showcase/home-tool-market.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
