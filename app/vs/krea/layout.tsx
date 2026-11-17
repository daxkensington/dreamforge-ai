import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Krea.ai — 30+ Models, Audio & REST API",
  description:
    "Looking for a Krea.ai alternative? DreamForgeX matches 30+ image & video models and adds full AI audio generation, 100+ workflow tools, and a REST API.",
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
