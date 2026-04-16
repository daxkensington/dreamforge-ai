import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Relighting — DreamForgeX",
  description: "Change the lighting and mood of any photo",
  openGraph: {
    title: "AI Relighting — DreamForgeX",
    description: "Change the lighting and mood of any photo",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
