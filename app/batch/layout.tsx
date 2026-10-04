import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Batch Studio — Bulk AI Generation | DreamForgeX",
  description: "Generate hundreds of AI images and videos in one run with DreamForgeX Batch Studio — spreadsheet-driven prompts, consistent styles, bulk export.",
  alternates: { canonical: "https://dreamforgex.ai/batch" },
  openGraph: {
    title: "Batch Studio — DreamForgeX",
    description: "Spreadsheet-driven bulk generation: queue hundreds of assets, keep styles consistent, export in one click.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
