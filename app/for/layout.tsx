import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Your Work — Use-Case Guides | DreamForgeX",
  description: "Curated AI tool guides by profession — Etsy sellers, musicians, teachers, podcasters, D&D players, fitness coaches, weddings and more. The right tools for your work.",
  // NOTE: deliberately no `alternates.canonical` here. A canonical on this
  // shared /for layout would be INHERITED by every /for/<slug> page that
  // doesn't set its own (the 12 original audience pages don't), pointing them
  // all at /for and de-indexing them. The hub self-canonicalizes; each new
  // audience page sets its own canonical in its own layout.
  openGraph: {
    title: "AI Tools for Your Work — DreamForgeX",
    description: "Curated AI tool guides by profession — the right tools for your line of work.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
