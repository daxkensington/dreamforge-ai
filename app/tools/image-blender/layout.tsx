import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image Blender — DreamForgeX",
  description: "Blend two images into creative mashups",
  openGraph: {
    title: "AI Image Blender — DreamForgeX",
    description: "Blend two images into creative mashups",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
