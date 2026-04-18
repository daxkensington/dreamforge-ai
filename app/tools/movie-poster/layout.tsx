import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Movie Poster Maker — DreamForgeX",
  description: "Theatrical 24x36 movie posters for any genre — action, horror, sci-fi, drama.",
  openGraph: { title: "Movie Poster Maker — DreamForgeX", description: "One-sheet movie posters with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
