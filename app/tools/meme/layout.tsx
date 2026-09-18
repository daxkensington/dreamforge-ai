import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/meme" },
  title: "AI Meme Generator — DreamForgeX",
  description: "Create viral memes with AI and trending formats",
  openGraph: {
    title: "AI Meme Generator — DreamForgeX",
    description: "Create viral memes with AI and trending formats",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
