import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/color-grading" },
  title: "AI Color Grading — DreamForgeX",
  description: "Apply cinematic color grades to your images",
  openGraph: {
    title: "AI Color Grading — DreamForgeX",
    description: "Apply cinematic color grades to your images",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
