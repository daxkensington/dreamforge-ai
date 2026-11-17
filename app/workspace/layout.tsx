import type { Metadata } from "next";
import { GlobalToolStatusBanner } from "@/components/GlobalToolStatusBanner";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/workspace" },
  title: "AI Image & Video Studio Workspace | DreamForgeX",
  description:
    "Create AI images, videos, songs, and characters in one studio workspace with 100+ tools and 30+ models including FLUX, Imagen 4, Veo 3, and Runway Gen-4.",
  openGraph: {
    title: "AI Studio — DreamForgeX",
    description: "Create stunning AI-generated images and videos with 100+ creative tools.",
    images: ["/showcase/home-tool-txtimg.jpg"],
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
