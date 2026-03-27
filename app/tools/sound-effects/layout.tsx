import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Sound Effects Generator — DreamForgeX",
  description: "Generate custom sound effects with AI",
  openGraph: {
    title: "AI Sound Effects Generator — DreamForgeX",
    description: "Generate custom sound effects with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
