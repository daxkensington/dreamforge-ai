import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/film-grain" },
  title: "Film Grain Effects — DreamForgeX",
  description: "Apply vintage film grain and analog photography effects",
  openGraph: {
    title: "Film Grain Effects — DreamForgeX",
    description: "Apply vintage film grain and analog photography effects",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
