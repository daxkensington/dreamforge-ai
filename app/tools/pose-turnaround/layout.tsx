import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pose Turnaround — DreamForgeX",
  description: "Multi-view character reference sheets for artists — front, side, back, and 3/4 views.",
  openGraph: {
    title: "Pose Turnaround — DreamForgeX",
    description: "Character turnarounds with consistent design across views.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
