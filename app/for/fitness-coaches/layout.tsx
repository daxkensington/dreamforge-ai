import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Fitness Coaches — Branding, Social, Ads | DreamForgeX",
  description: "A full marketing department for personal trainers: logo and brand kit, on-brand social posts, challenge flyers, ad copy, and a profile headshot.",
  alternates: { canonical: "https://dreamforgex.ai/for/fitness-coaches" },
  openGraph: {
    title: "AI Tools for Fitness Coaches — DreamForgeX",
    description: "Logo, brand kit, social posts, challenge flyers, and ads — look like a brand from day one.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
