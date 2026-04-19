import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Playground — Multi-Model + Video + Audio | DreamForgeX",
  description:
    "Looking for a Playground alternative? DreamForgeX matches the multi-model access and adds full video + audio gen, 100+ named tools, and a public API — from $9/mo.",
  alternates: { canonical: "https://dreamforgex.ai/vs/playground" },
  openGraph: {
    title: "DreamForgeX vs Playground — Compare features and pricing",
    description: "Same multi-model breadth plus video, audio, and 100+ named tools. Public API from $9/mo.",
    url: "https://dreamforgex.ai/vs/playground",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
