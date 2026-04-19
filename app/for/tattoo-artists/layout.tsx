import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Tattoo Artists — Stencil + Color Designs, Flash, Merch | DreamForgeX",
  description: "Faster consult-to-stencil workflow. Stencil and full-color variants in 10 styles, flash sheets, shop branding, merch — all in one place.",
  openGraph: {
    title: "AI Tools for Tattoo Artists — DreamForgeX",
    description: "Stencil + color concepts, flash sheets, shop branding — tighter consult workflow.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
