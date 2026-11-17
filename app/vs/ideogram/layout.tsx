import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Ideogram — Typography, Video & 100+ Tools",
  description:
    "Looking for an Ideogram alternative? DreamForgeX pairs Ideogram-grade typography with 30+ models, AI video, audio, virtual try-on, and 100+ tools.",
  alternates: { canonical: "https://dreamforgex.ai/vs/ideogram" },
  openGraph: {
    title: "DreamForgeX vs Ideogram — Compare features and pricing",
    description: "Text-in-image + video + audio + niche workflow tools. Credits roll over instead of expiring monthly.",
    url: "https://dreamforgex.ai/vs/ideogram",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
