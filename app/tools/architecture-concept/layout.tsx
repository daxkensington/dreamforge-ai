import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Architecture Concept Renderer — DreamForgeX",
  description: "Photorealistic building and interior renders from text — 10 styles, 6 views.",
  openGraph: { title: "Architecture Concept — DreamForgeX", description: "Architectural visualization with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
