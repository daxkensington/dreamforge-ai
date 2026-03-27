import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Design Canvas — DreamForgeX",
  description: "Drag-and-drop design editor powered by AI. Create social posts, ads, and graphics with AI-generated elements, text, and shapes.",
  openGraph: { title: "AI Design Canvas — DreamForgeX", description: "Canva-style design editor powered by AI" },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
