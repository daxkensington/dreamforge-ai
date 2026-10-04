import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Scene Director — AI Scene Composition & Camera Direction | DreamForgeX",
  description: "Direct AI-generated scenes like a filmmaker: describe the shot, pick a camera style, and get keyframes with composition and camera direction notes.",
  alternates: { canonical: "https://dreamforgex.ai/video-studio/scene-director" },
  openGraph: {
    title: "Scene Director — DreamForgeX",
    description: "AI scene composition with keyframe generation and camera direction.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
