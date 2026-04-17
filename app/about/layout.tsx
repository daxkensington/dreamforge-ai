import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — DreamForgeX",
  description:
    "DreamForgeX is the all-in-one creative AI studio: 75+ tools, 30+ models (Flux, Runway, Kling, Veo 3, Wan 2.5, MusicGen, Bark), self-hosted GPU workers, and exclusive LoRA styles — built for creators who ship.",
  openGraph: {
    title: "About DreamForgeX — One platform, every creative AI worth using",
    description:
      "75+ tools. 30+ models. Self-hosted GPUs. Exclusive LoRAs. The creative studio for people who use AI to ship.",
    images: ["/showcase/hero-forge.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
