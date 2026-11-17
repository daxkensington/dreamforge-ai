import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/character-sheet" },
  title: "AI Character Sheet & Turnaround Generator | DreamForgeX",
  description:
    "Generate consistent multi-angle character reference sheets, front/side/back turnarounds, and expressions for games, comics & anime — 50 free credits/day.",
  openGraph: {
    title: "AI Character Sheet & Turnaround Generator | DreamForgeX",
    description:
      "Generate consistent multi-angle character reference sheets, front/side/back turnarounds, and expressions for games, comics & anime — 50 free credits/day.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
