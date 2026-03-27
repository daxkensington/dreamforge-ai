import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Text to Video — DreamForgeX",
  description: "Generate video from text with Google Veo 3",
  openGraph: {
    title: "AI Text to Video — DreamForgeX",
    description: "Generate video from text with Google Veo 3",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
