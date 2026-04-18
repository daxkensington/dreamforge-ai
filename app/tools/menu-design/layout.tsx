import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Menu Designer — DreamForgeX",
  description: "Restaurant menus in single-page, bi-fold, or tri-fold layouts with AI.",
  openGraph: { title: "Menu Designer — DreamForgeX", description: "Print-ready restaurant menus." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
