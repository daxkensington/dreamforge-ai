import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image Upscaler — DreamForgeX",
  description: "Enhance image resolution up to 4x with AI",
  openGraph: {
    title: "AI Image Upscaler — DreamForgeX",
    description: "Enhance image resolution up to 4x with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
