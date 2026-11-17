import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/models" },
  title: "Compare 30+ AI Image, Video & Audio Models | DreamForgeX",
  description:
    "Compare 30+ frontier and open-weights AI models on DreamForgeX — FLUX.1, Imagen 4, Recraft V3, Ideogram V3, Veo 3, Runway Gen-4, Kling 2.0, and Wan 2.2.",
  openGraph: {
    title: "Compare 30+ AI Models | DreamForgeX",
    description:
      "Side-by-side quality, speed, and credit cost comparison across 30+ AI image, video, and audio models.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
