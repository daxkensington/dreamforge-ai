import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Logo Animator — DreamForgeX",
  description: "Upload your logo and AI creates stunning animated video intros. 8 animation styles including particle reveal, glitch, and neon glow.",
  openGraph: { title: "AI Logo Animator — DreamForgeX", description: "Create animated logo intros with AI" },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
