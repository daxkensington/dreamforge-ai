import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs Canva Magic Studio — AI-First Workflow + Public API | DreamForgeX",
  description:
    "Looking for a Canva Magic Studio alternative? DreamForgeX is AI-first: 100+ named tools, full video + audio gen, character consistency, and a public REST API from $9/mo.",
  alternates: { canonical: "https://dreamforgex.ai/vs/canva-ai" },
  openGraph: {
    title: "DreamForgeX vs Canva Magic Studio — Compare features and pricing",
    description: "AI-first workflow with 100+ named tools + public API. Same $9 entry point with broader stack.",
    url: "https://dreamforgex.ai/vs/canva-ai",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
