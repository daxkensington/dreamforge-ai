import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "71+ AI Tools — DreamForgeX",
  description: "Image editing, creative generation, video production, audio tools, and more. Upscaler, background remover, style transfer, logo maker, and 50+ AI-powered creative tools.",
  openGraph: {
    title: "71+ AI Creative Tools — DreamForgeX",
    description: "The most comprehensive AI creative toolkit. Image, video, audio, and design tools.",
    images: ["/showcase/hero-2.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
