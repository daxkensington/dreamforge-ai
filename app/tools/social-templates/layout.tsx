import type { Metadata } from "next";

const description = "Start with a social video prompt for TikTok, Reels, Shorts, or LinkedIn. Edit the draft and review the video settings and credit cost in Workspace.";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/social-templates" },
  title: "Social Video Templates — DreamForgeX",
  description,
  openGraph: {
    title: "Social Video Templates — DreamForgeX",
    description,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
