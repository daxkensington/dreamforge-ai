import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/audio-enhance" },
  title: "AI Audio Enhancer — DreamForgeX",
  description: "Professional AI audio cleanup and noise removal",
  openGraph: {
    title: "AI Audio Enhancer — DreamForgeX",
    description: "Professional AI audio cleanup and noise removal",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
