import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Musicians — Album Covers, Music Videos, Posters | DreamForgeX",
  description: "Package and promote your music without a label's budget: album covers, lyric and music videos, gig posters, and matching social art in one place.",
  alternates: { canonical: "https://dreamforgex.ai/for/musicians" },
  openGraph: {
    title: "AI Tools for Musicians — DreamForgeX",
    description: "Album covers, music videos, gig posters, and social art — one consistent look per release.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
