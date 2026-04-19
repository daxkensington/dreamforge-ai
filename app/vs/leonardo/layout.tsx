import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Leonardo.Ai — Public API, Audio & Video Bundled | DreamForgeX",
  description:
    "Looking for a Leonardo.Ai alternative? DreamForgeX matches the multi-model breadth and adds full audio gen, niche workflow tools, and a public REST API — starting at $9/mo.",
  alternates: { canonical: "https://dreamforgex.ai/vs/leonardo" },
  openGraph: {
    title: "DreamForgeX vs Leonardo.Ai — Compare features and pricing",
    description: "Multi-model breadth + audio + video + public API. Free tier and try-without-signup demo.",
    url: "https://dreamforgex.ai/vs/leonardo",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
