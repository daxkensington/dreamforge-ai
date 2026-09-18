import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/cover-maker" },
  title: "Cover Maker — DreamForgeX",
  description: "AI book, album, eBook, audiobook, and magazine covers with typography baked in.",
  openGraph: {
    title: "Cover Maker — DreamForgeX",
    description: "AI-designed book and album covers.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
