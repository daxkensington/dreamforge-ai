import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image to Video — DreamForgeX",
  description: "Animate still images into video clips with AI",
  openGraph: {
    title: "AI Image to Video — DreamForgeX",
    description: "Animate still images into video clips with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
