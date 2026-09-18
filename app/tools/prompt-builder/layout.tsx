import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/prompt-builder" },
  title: "AI Prompt Builder — DreamForgeX",
  description: "Craft perfect image generation prompts visually",
  openGraph: {
    title: "AI Prompt Builder — DreamForgeX",
    description: "Craft perfect image generation prompts visually",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
