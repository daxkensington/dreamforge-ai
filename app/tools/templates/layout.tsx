import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Templates — DreamForgeX",
  description: "24 ready-to-use creative project templates for social media, marketing, art, design, photography, and video",
  openGraph: {
    title: "Project Templates — DreamForgeX",
    description: "24 ready-to-use creative project templates for social media, marketing, art, design, photography, and video",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
