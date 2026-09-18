import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/logo-maker" },
  title: "AI Logo Maker — DreamForgeX",
  description: "Generate professional logos for any brand",
  openGraph: {
    title: "AI Logo Maker — DreamForgeX",
    description: "Generate professional logos for any brand",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
