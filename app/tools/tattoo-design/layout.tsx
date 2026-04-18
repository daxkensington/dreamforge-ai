import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tattoo Designer — DreamForgeX",
  description: "AI tattoo designs with stencil and full-color variants across 10 classic styles.",
  openGraph: {
    title: "Tattoo Designer — DreamForgeX",
    description: "Stencil + color tattoo designs with AI.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
