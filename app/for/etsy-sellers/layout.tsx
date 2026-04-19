import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Etsy Sellers — Listing Photos, Mockups, Stickers | DreamForgeX",
  description: "Every creator tool an Etsy seller needs in one subscription — listing photos, mockups, sticker packs, printables, logos, brand kits. Commercial use included.",
  openGraph: {
    title: "AI Tools for Etsy Sellers — DreamForgeX",
    description: "Listing photos, mockups, stickers, printables — commercial use included.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
