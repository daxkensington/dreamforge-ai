import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/outpainting" },
  title: "AI Outpainting — DreamForgeX",
  description: "Extend images beyond their borders with AI",
  openGraph: {
    title: "AI Outpainting — DreamForgeX",
    description: "Extend images beyond their borders with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
