import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/pricing" },
  title: "Pricing, Credit Packs & Uncensored Passes | DreamForgeX",
  description:
    "Start free with 50 credits/day & 3 Uncensored previews. Plans from $9/mo, never-expiring credit packs from $4.99, and 18+ passes via Card or Bitcoin.",
  openGraph: {
    title: "Pricing — DreamForgeX AI Creative Studio",
    description: "Simple, transparent pricing for AI image and video generation. Start free.",
    images: ["/showcase/hero-forge.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
