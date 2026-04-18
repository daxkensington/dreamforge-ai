import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meme Template Filler — DreamForgeX",
  description: "Classic meme templates — Drake, Distracted Boyfriend, Galaxy Brain — with your captions.",
  openGraph: {
    title: "Meme Template Filler — DreamForgeX",
    description: "Drop captions into classic meme templates.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
