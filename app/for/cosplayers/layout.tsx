import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Cosplayers — Costume References, Pose Sheets, Props | DreamForgeX",
  description: "Plan your next cosplay build faster. Multi-angle costume references with seams and fabric detail, pose turnarounds, prop breakdowns, makeup studies.",
  openGraph: {
    title: "AI Tools for Cosplayers — DreamForgeX",
    description: "Costume references, pose sheets, prop concepts — built for real costume-makers.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
