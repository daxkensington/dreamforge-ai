import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Social Media Resizer — DreamForgeX",
  description: "Auto-resize for every social platform",
  openGraph: {
    title: "Social Media Resizer — DreamForgeX",
    description: "Auto-resize for every social platform",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
