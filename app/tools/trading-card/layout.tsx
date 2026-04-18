import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Trading Card Designer — DreamForgeX",
  description: "TCG-quality custom cards with stats, art, and rarity — design your own card game.",
  openGraph: { title: "Trading Card Designer — DreamForgeX", description: "Magic/Pokemon-quality custom cards." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
