import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Midjourney — Free Credits, Video & API",
  description:
    "Looking for a Midjourney alternative? DreamForgeX gives you FLUX, Imagen 4, AI video, audio, 100+ tools, and 50 free daily credits — paid plans from $9/mo.",
  alternates: { canonical: "https://dreamforgex.ai/vs/midjourney" },
  openGraph: {
    title: "DreamForgeX vs Midjourney — Compare features and pricing",
    description: "Multi-model image gen + video + audio + 100+ tools + public API. Free tier and try-without-signup demo.",
    url: "https://dreamforgex.ai/vs/midjourney",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
