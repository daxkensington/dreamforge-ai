import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/music-video" },
  title: "AI Music Video Studio — DreamForgeX",
  description: "Create AI music videos from your photo and song",
  openGraph: {
    title: "AI Music Video Studio — DreamForgeX",
    description: "Create AI music videos from your photo and song",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
