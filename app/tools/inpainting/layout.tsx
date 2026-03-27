import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Inpainting Editor — DreamForgeX",
  description: "Edit specific regions of images with AI precision",
  openGraph: {
    title: "AI Inpainting Editor — DreamForgeX",
    description: "Edit specific regions of images with AI precision",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
