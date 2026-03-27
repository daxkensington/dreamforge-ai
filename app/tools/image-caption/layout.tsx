import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image Caption Generator — DreamForgeX",
  description: "Generate alt text and social captions for images",
  openGraph: {
    title: "AI Image Caption Generator — DreamForgeX",
    description: "Generate alt text and social captions for images",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
