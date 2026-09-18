import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/style-transfer" },
  title: "AI Style Transfer — DreamForgeX",
  description: "Transform images into any art style with AI",
  openGraph: {
    title: "AI Style Transfer — DreamForgeX",
    description: "Transform images into any art style with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
