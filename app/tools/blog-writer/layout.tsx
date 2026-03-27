import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Blog Writer — DreamForgeX",
  description: "Generate SEO-optimized blog posts with AI",
  openGraph: {
    title: "AI Blog Writer — DreamForgeX",
    description: "Generate SEO-optimized blog posts with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
