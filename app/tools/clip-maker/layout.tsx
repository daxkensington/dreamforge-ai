import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viral Clip Maker — DreamForgeX",
  description: "AI creates scroll-stopping short clips for TikTok and Reels",
  openGraph: {
    title: "Viral Clip Maker — DreamForgeX",
    description: "AI creates scroll-stopping short clips for TikTok and Reels",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
