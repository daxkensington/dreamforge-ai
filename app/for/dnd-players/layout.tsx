import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Art for D&D & Tabletop RPGs — Character Portraits, Item Cards | DreamForgeX",
  description: "Generate D&D and tabletop RPG art on demand: character portraits, monster and item cards, NPC faces, and dungeon concept art for your next session.",
  alternates: { canonical: "https://dreamforgex.ai/for/dnd-players" },
  openGraph: {
    title: "AI Art for D&D & Tabletop RPGs — DreamForgeX",
    description: "Character portraits, item & monster cards, NPC faces, and location concept art for your table.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
