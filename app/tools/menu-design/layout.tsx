import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/menu-design" },
  title: "Menu Designer — DreamForgeX",
  description: "Restaurant menus in single-page, bi-fold, or tri-fold layouts with AI.",
  openGraph: { title: "Menu Designer — DreamForgeX", description: "Print-ready restaurant menus." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
