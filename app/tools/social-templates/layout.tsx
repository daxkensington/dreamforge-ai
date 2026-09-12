import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/social-templates" },
  title: "Social Video Templates — DreamForgeX",
  description: "50+ one-click video templates for TikTok, Reels, Shorts",
  openGraph: {
    title: "Social Video Templates — DreamForgeX",
    description: "50+ one-click video templates for TikTok, Reels, Shorts",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
