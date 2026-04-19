import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Krea.ai — Multi-Model Breadth + Audio Stack | DreamForgeX",
  description:
    "Looking for a Krea.ai alternative? DreamForgeX matches the multi-model breadth (30+ models across image, video, and audio) and adds full audio gen, niche tools, and a public REST API.",
  alternates: { canonical: "https://dreamforgex.ai/vs/krea" },
  openGraph: {
    title: "DreamForgeX vs Krea.ai — Compare features and pricing",
    description: "Multi-model breadth + full audio stack + public API. 100+ named workflow tools.",
    url: "https://dreamforgex.ai/vs/krea",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
