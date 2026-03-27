import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Background Remover — DreamForgeX",
  description: "Remove or replace image backgrounds instantly with AI",
  openGraph: {
    title: "AI Background Remover — DreamForgeX",
    description: "Remove or replace image backgrounds instantly with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
