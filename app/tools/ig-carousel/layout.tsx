import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instagram Carousel Designer — DreamForgeX",
  description: "Branded multi-slide Instagram carousels with AI copy and design.",
  openGraph: {
    title: "Instagram Carousel Designer — DreamForgeX",
    description: "Hook, value, CTA — AI-designed IG carousels.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
