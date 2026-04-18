import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Concert Poster Maker — DreamForgeX",
  description: "Silkscreen-quality gig and tour posters for any genre.",
  openGraph: { title: "Concert Poster Maker — DreamForgeX", description: "Merch-table quality gig posters." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
