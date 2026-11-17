import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Adobe Firefly — API, Video & 100+ AI Tools",
  description:
    "Looking for an Adobe Firefly alternative? DreamForgeX offers REST API access from $9/mo, 100+ AI workflow tools, and full video + audio generation.",
  alternates: { canonical: "https://dreamforgex.ai/vs/adobe-firefly" },
  openGraph: {
    title: "DreamForgeX vs Adobe Firefly — Compare features and pricing",
    description: "API from $9/mo, 100+ named tools, full audio + video stack. No Adobe account required.",
    url: "https://dreamforgex.ai/vs/adobe-firefly",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
