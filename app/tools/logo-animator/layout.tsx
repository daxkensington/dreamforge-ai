import type { Metadata } from "next";

const description = "Animate an uploaded logo into a five-second 480p intro. Choose a motion style and review the credit quote before generating.";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/logo-animator" },
  title: "AI Logo Animator — DreamForgeX",
  description,
  openGraph: { title: "AI Logo Animator — DreamForgeX", description },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
