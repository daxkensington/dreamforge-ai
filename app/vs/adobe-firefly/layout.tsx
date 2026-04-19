import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Adobe Firefly — 10× Cheaper API + 100+ Tools | DreamForgeX",
  description:
    "Looking for an Adobe Firefly alternative? DreamForgeX offers API from $9/mo (Firefly gates API to $200 Premium), 100+ named workflow tools, and full audio + video gen.",
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
