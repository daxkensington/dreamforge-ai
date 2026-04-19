import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Podcasters — Cover Art, Thumbnails, Audio, Voiceover | DreamForgeX",
  description: "Everything a podcaster needs to produce, brand, and promote episodes — Spotify-ready cover art, per-episode thumbnails, audio cleanup, voiceover.",
  openGraph: {
    title: "AI Tools for Podcasters — DreamForgeX",
    description: "Cover art, thumbnails, voiceover, audio cleanup — the whole podcast production stack.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
