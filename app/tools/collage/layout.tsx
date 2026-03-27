import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Collage Maker — DreamForgeX",
  description: "Create AI-arranged photo collages",
  openGraph: {
    title: "AI Collage Maker — DreamForgeX",
    description: "Create AI-arranged photo collages",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
