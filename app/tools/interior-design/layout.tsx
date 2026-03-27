import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Interior Design — DreamForgeX",
  description: "Redesign any room with AI interior design concepts",
  openGraph: {
    title: "AI Interior Design — DreamForgeX",
    description: "Redesign any room with AI interior design concepts",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
