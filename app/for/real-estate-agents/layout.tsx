import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Real Estate Agents — Twilight Exteriors, Staging, Flyers | DreamForgeX",
  description: "Turn listing photos into MLS-showstoppers. Twilight exteriors, virtual staging, open-house flyers, professional headshots — all from your phone photos.",
  openGraph: {
    title: "AI Tools for Real Estate Agents — DreamForgeX",
    description: "Twilight exteriors, interior staging, MLS-ready photos, marketing flyers.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
