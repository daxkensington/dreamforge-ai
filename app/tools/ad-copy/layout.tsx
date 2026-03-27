import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Ad Copy Generator — DreamForgeX",
  description: "Generate high-converting ad copy for Google, Facebook, Instagram, LinkedIn, and TikTok campaigns with AI",
  openGraph: {
    title: "AI Ad Copy Generator — DreamForgeX",
    description: "Generate high-converting ad copy for Google, Facebook, Instagram, LinkedIn, and TikTok campaigns with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
