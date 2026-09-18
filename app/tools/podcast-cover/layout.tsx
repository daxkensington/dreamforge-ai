import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/podcast-cover" },
  title: "Podcast Cover Art — DreamForgeX",
  description: "Spotify and Apple Podcasts–ready square cover art optimized for thumbnail grids.",
  openGraph: {
    title: "Podcast Cover Art — DreamForgeX",
    description: "AI podcast covers that stand out at thumbnail size.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
