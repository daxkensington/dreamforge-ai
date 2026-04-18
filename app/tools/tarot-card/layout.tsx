import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Tarot Card Designer — DreamForgeX",
  description: "Custom major arcana–style tarot cards with rich symbolism and ornate borders.",
  openGraph: { title: "Tarot Card Designer — DreamForgeX", description: "Custom tarot cards with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
