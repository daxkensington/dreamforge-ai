import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comic Strip Generator — DreamForgeX",
  description: "Create multi-panel comic strips from a concept",
  openGraph: {
    title: "Comic Strip Generator — DreamForgeX",
    description: "Create multi-panel comic strips from a concept",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
