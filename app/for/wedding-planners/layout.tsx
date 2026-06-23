import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Weddings — Invitations, Menus, Signage | DreamForgeX",
  description: "DIY a designer-level wedding suite: invitations, save-the-dates, menus, signage, and thank-you cards, coordinated to one theme for a fraction of the cost.",
  alternates: { canonical: "https://dreamforgex.ai/for/wedding-planners" },
  openGraph: {
    title: "AI Tools for Weddings — DreamForgeX",
    description: "Invitations, save-the-dates, menus, signage, and thank-you cards — one coordinated theme.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
