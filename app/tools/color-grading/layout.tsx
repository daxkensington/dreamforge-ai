import type { Metadata } from "next";

export const metadata: Metadata = {
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
