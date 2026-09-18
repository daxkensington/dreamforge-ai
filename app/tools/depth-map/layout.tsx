import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/depth-map" },
  title: "AI Depth Map Generator — DreamForgeX",
  description: "Generate 3D depth maps from 2D images",
  openGraph: {
    title: "AI Depth Map Generator — DreamForgeX",
    description: "Generate 3D depth maps from 2D images",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
