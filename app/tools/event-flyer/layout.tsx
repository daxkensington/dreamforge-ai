import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/event-flyer" },
  title: "Event Flyer Designer — DreamForgeX",
  description: "Concerts, clubs, conferences, and sales — 8.5x11 promotional flyers with AI.",
  openGraph: { title: "Event Flyer Designer — DreamForgeX", description: "Promotional flyers with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
