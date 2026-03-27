import type { Metadata } from "next";

export const metadata: Metadata = {
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
