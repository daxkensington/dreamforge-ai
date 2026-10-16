import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/color-palette" },
  title: "AI Color Palette Extractor — DreamForgeX",
  description: "Extract and generate color palettes from any image",
  openGraph: {
    title: "AI Color Palette Extractor — DreamForgeX",
    description: "Extract and generate color palettes from any image",
    url: "https://dreamforgex.ai/tools/color-palette",
    siteName: "DreamForgeX",
    images: [
      {
        url: "https://dreamforgex.ai/og-image.jpg",
        width: 1408,
        height: 768,
        alt: "DreamForgeX — AI Creative Studio with 100+ tools",
      },
    ],
    type: "website",
    locale: "en_US",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
