import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Indie Game Devs — Pixel Art, Characters, Textures, 3D | DreamForgeX",
  description: "Ship a game without hiring an artist. Pixel sprites, character turnarounds, tileable textures, 3D model concepts, soundtracks — all commercial-use.",
  openGraph: {
    title: "AI Tools for Indie Game Devs — DreamForgeX",
    description: "Pixel art, character design, textures, 3D, music — game-ready assets on demand.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
