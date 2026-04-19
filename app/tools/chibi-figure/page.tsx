import type { Metadata } from "next";
import ToolChibiFigure from "@/pages/ToolChibiFigure";

export const metadata: Metadata = {
  title: "AI Chibi Figure Generator — Turn Photos Into Cute Anime Figures | DreamForgeX",
  description:
    "Upload a photo and create an adorable 3D anime chibi-style collectible figure with oversized head, big sparkly eyes, and pastel colors.",
  alternates: { canonical: "https://dreamforgex.ai/tools/chibi-figure" },
  openGraph: {
    title: "AI Chibi Figure Generator | DreamForgeX",
    description: "Turn any photo into a cute anime chibi figure.",
    url: "https://dreamforgex.ai/tools/chibi-figure",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolChibiFigure />;
}
