import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/music-video" },
  title: "AI Music Video Studio — DreamForgeX",
  description: "Create a video in the workspace and add your audio in the timeline editor.",
  openGraph: {
    title: "AI Music Video Studio — DreamForgeX",
    description: "Create a video in the workspace and add your audio in the timeline editor.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
