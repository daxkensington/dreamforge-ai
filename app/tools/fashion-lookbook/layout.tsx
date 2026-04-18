import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fashion Lookbook — DreamForgeX",
  description: "Multi-scene editorial lookbook shots from a single garment description.",
  openGraph: {
    title: "Fashion Lookbook — DreamForgeX",
    description: "Editorial lookbook scenes with AI fashion photography.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
