import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Natural Language Image Editor — DreamForgeX",
  description: "Edit images by describing changes in English",
  openGraph: {
    title: "AI Natural Language Image Editor — DreamForgeX",
    description: "Edit images by describing changes in English",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
