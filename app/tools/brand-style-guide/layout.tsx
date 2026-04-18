import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Brand Style Guide Generator — DreamForgeX",
  description: "Full brand systems with logo, color palette, and typography on one reference sheet.",
  openGraph: { title: "Brand Style Guide — DreamForgeX", description: "AI-designed brand systems." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
