import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Color Palette Extractor — DreamForgeX",
  description: "Extract and generate color palettes from any image",
  openGraph: {
    title: "AI Color Palette Extractor — DreamForgeX",
    description: "Extract and generate color palettes from any image",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
