import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image Variations — DreamForgeX",
  description: "Generate creative variations of any image",
  openGraph: {
    title: "AI Image Variations — DreamForgeX",
    description: "Generate creative variations of any image",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
