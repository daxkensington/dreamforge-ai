import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — DreamForgeX",
  description: "Free, Creator, Pro, and Studio plans for every AI creator. Start free with 1,500 credits. Upgrade for HD, video, batch processing, and more.",
  openGraph: {
    title: "Pricing — DreamForgeX AI Creative Studio",
    description: "Simple, transparent pricing for AI image and video generation. Start free.",
    images: ["/showcase/hero-forge.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
