import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Object Eraser — DreamForgeX",
  description: "Remove unwanted objects from images with AI",
  openGraph: {
    title: "AI Object Eraser — DreamForgeX",
    description: "Remove unwanted objects from images with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
