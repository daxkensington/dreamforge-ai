import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/character-sheet" },
  title: "AI Character Sheet Generator — DreamForgeX",
  description: "Create detailed character reference sheets",
  openGraph: {
    title: "AI Character Sheet Generator — DreamForgeX",
    description: "Create detailed character reference sheets",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
