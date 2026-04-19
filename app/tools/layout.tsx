import type { Metadata } from "next";
import { GlobalToolStatusBanner } from "@/components/GlobalToolStatusBanner";

export const metadata: Metadata = {
  title: "100+ AI Tools — DreamForgeX",
  description: "Image editing, creative generation, video production, audio tools, and more. Upscaler, background remover, style transfer, logo maker, and 100+ AI-powered creative tools.",
  openGraph: {
    title: "100+ AI Creative Tools — DreamForgeX",
    description: "The most comprehensive AI creative toolkit. Image, video, audio, and design tools.",
    images: ["/showcase/hero-2.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalToolStatusBanner />
      {children}
    </>
  );
}
