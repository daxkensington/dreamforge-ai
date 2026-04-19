import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Restaurants — Menus, Recipe Cards, Food Photos, Flyers | DreamForgeX",
  description: "Run a tighter restaurant marketing shop. Print-ready menus, Pinterest-ready recipe cards, food photography, event flyers — without an external designer.",
  openGraph: {
    title: "AI Tools for Restaurants — DreamForgeX",
    description: "Menus, recipe cards, event flyers, food photography — restaurant marketing in one place.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
