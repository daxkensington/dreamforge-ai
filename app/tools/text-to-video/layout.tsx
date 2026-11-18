import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/text-to-video" },
  title: "AI Text to Video — DreamForgeX",
  description: "Create video from text in the workspace with a model and credit price of your choice.",
  openGraph: {
    title: "AI Text to Video — DreamForgeX",
    description: "Create video from text in the workspace with a model and credit price of your choice.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
