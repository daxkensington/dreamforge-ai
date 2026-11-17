import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Playground — 30+ Models, Video & Audio",
  description:
    "Looking for a Playground alternative? DreamForgeX bundles 30+ image models with AI video, audio, 100+ workflow tools, and a public REST API from $9/mo.",
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
