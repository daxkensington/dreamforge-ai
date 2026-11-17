import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Small Business — Ads & Branding | DreamForgeX",
  description: "Studio product photos, logos, brand kits, flyers, menus, and social carousels in one AI studio — replace $400–800 of freelancer spend from $9/mo.",
  alternates: { canonical: "https://dreamforgex.ai/for/small-business" },
  openGraph: {
    title: "AI Tools for Small Business Owners — DreamForgeX",
    description: "Photos, ads, flyers, menus, brand — all from one subscription.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
