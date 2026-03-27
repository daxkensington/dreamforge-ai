import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sketch to Image AI — DreamForgeX",
  description: "Transform rough sketches into polished AI artwork",
  openGraph: {
    title: "Sketch to Image AI — DreamForgeX",
    description: "Transform rough sketches into polished AI artwork",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
