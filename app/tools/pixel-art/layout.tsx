import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pixel Art Generator — DreamForgeX",
  description: "Create game-ready 8, 16, and 32-bit pixel art sprites, characters, and tilesets with AI.",
  openGraph: {
    title: "Pixel Art Generator — DreamForgeX",
    description: "Create game-ready 8, 16, and 32-bit pixel art with AI.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
