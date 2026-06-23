import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Teachers — Worksheets, Certificates, Slides | DreamForgeX",
  description: "Make classroom materials in minutes: printable coloring pages, named award certificates, flashcards, and lesson slides. One tool, classroom-ready.",
  alternates: { canonical: "https://dreamforgex.ai/for/teachers" },
  openGraph: {
    title: "AI Tools for Teachers — DreamForgeX",
    description: "Coloring pages, certificates, flashcards, and lesson slides — classroom-ready in minutes.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
