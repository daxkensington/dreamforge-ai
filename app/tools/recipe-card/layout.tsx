import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Recipe Card Generator — DreamForgeX",
  description: "Pinterest-ready recipe cards with hero food photography and structured layout.",
  openGraph: { title: "Recipe Card Generator — DreamForgeX", description: "AI recipe cards for food blogs and Pinterest." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
