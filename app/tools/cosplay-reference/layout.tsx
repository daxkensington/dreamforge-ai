import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Cosplay Reference — DreamForgeX",
  description: "Multi-view costume breakdown reference sheets for cosplayers and costumers.",
  openGraph: { title: "Cosplay Reference — DreamForgeX", description: "Buildable costume references with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
