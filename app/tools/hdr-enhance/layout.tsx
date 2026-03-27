import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI HDR Enhancer — DreamForgeX",
  description: "Transform lighting and enhance dynamic range with AI",
  openGraph: {
    title: "AI HDR Enhancer — DreamForgeX",
    description: "Transform lighting and enhance dynamic range with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
