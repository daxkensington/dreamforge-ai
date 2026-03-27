import type { Metadata } from "next";

export const metadata: Metadata = {
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
