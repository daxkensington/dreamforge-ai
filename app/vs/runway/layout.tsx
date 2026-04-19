import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Runway — Image, Video & Audio in One Pool | DreamForgeX",
  description:
    "Looking for a Runway alternative? DreamForgeX bundles image, video, and audio generation in one credit pool, with a public REST API from the $9 tier.",
  alternates: { canonical: "https://dreamforgex.ai/vs/runway" },
  openGraph: {
    title: "DreamForgeX vs Runway — Compare features and pricing",
    description: "Image + video + audio + 100+ tools in one credit pool. Public API from $9/mo.",
    url: "https://dreamforgex.ai/vs/runway",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
