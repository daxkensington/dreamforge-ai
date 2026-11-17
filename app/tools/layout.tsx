import type { Metadata } from "next";
import { GlobalToolStatusBanner } from "@/components/GlobalToolStatusBanner";

export const metadata: Metadata = {
  title: "100+ Free & Pro AI Creative Tools Online | DreamForgeX",
  description:
    "Explore 100+ online AI tools: 4x image upscaler, background remover, headshots, text-to-video, song creator & logo maker. Start with 50 free daily credits.",
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
