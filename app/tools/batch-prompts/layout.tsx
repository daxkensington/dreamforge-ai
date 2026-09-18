import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/batch-prompts" },
  title: "AI Batch Generator — DreamForgeX",
  description: "Generate multiple AI images at once",
  openGraph: {
    title: "AI Batch Generator — DreamForgeX",
    description: "Generate multiple AI images at once",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
