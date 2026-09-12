import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/variations" },
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
