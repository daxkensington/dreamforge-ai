import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Caption Writer — DreamForgeX",
  description: "Generate social media captions and hashtags for every platform",
  openGraph: {
    title: "AI Caption Writer — DreamForgeX",
    description: "Generate social media captions and hashtags for every platform",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
