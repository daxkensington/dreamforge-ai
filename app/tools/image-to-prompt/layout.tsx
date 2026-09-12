import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/image-to-prompt" },
  title: "Image to Prompt Analyzer — DreamForgeX",
  description: "Reverse-engineer any image into an AI prompt",
  openGraph: {
    title: "Image to Prompt Analyzer — DreamForgeX",
    description: "Reverse-engineer any image into an AI prompt",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
