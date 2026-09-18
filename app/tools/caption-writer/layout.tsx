import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/caption-writer" },
  title: "AI Caption Writer — DreamForgeX",
  description: "Generate social media captions and hashtags for every platform",
  openGraph: {
    title: "AI Caption Writer — DreamForgeX",
    description: "Generate social media captions and hashtags for every platform",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
