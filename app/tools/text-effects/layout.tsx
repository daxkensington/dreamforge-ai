import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Text Effects — DreamForgeX",
  description: "Generate stunning stylized text art with AI",
  openGraph: {
    title: "AI Text Effects — DreamForgeX",
    description: "Generate stunning stylized text art with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
