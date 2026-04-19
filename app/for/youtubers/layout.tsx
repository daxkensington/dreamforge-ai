import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for YouTubers — Thumbnails, B-roll, Soundtracks | DreamForgeX",
  description: "Retention-tuned thumbnails, B-roll visuals, intro sequences, and commercial-use MusicGen soundtracks. Everything a YouTube creator ships in one subscription.",
  openGraph: {
    title: "AI Tools for YouTubers — DreamForgeX",
    description: "Thumbnails, B-roll, soundtracks — one subscription, one credit pool.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
