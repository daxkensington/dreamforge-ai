import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/canvas" },
  title: "AI Canvas Editor — DreamForgeX",
  description: "Draw, paint, and edit with AI assistance",
  openGraph: {
    title: "AI Canvas Editor — DreamForgeX",
    description: "Draw, paint, and edit with AI assistance",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
