import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Zine Spread Designer — DreamForgeX",
  description: "Multi-page editorial zine spreads with AI copywriting and layout.",
  openGraph: { title: "Zine Spread Designer — DreamForgeX", description: "DIY zine layouts with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
