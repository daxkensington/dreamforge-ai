import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/vectorize" },
  title: "AI Image Vectorizer — DreamForgeX",
  description: "Convert images to clean SVG vectors",
  openGraph: {
    title: "AI Image Vectorizer — DreamForgeX",
    description: "Convert images to clean SVG vectors",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
