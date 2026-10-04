import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Soundtrack Suggester — AI Music & Sound Design for Video | DreamForgeX",
  description: "Get AI-curated music and sound design recommendations matched to your video's mood, pacing, and scenes — with per-scene track suggestions.",
  alternates: { canonical: "https://dreamforgex.ai/video-studio/soundtrack" },
  openGraph: {
    title: "Soundtrack Suggester — DreamForgeX",
    description: "AI-powered music and sound design recommendations for your video.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
