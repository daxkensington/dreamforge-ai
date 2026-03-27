import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Image Templates — DreamForgeX",
  description: "25+ design templates for social posts, ads, and print",
  openGraph: {
    title: "AI Image Templates — DreamForgeX",
    description: "25+ design templates for social posts, ads, and print",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
