import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/music-video" },
  title: "AI Music Video Studio — DreamForgeX",
  description: "Animate an image and loop the clip over your song to create a music video.",
  openGraph: {
    title: "AI Music Video Studio — DreamForgeX",
    description: "Animate an image and loop the clip over your song to create a music video.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
