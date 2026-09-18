import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/presentations" },
  title: "AI Presentation Builder — DreamForgeX",
  description: "AI creates full slide decks from a topic description",
  openGraph: {
    title: "AI Presentation Builder — DreamForgeX",
    description: "AI creates full slide decks from a topic description",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
