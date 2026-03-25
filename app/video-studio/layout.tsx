import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Studio — DreamForgeX",
  description: "AI video production suite. Storyboards, scene direction, scripts, soundtracks, style transfer, and text-to-video generation powered by Google Veo 2.",
  openGraph: {
    title: "AI Video Studio — DreamForgeX",
    description: "Create AI-generated videos with storyboards, scripts, and scene direction.",
    images: ["/showcase/home-tool-video.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
