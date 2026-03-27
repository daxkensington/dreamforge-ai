import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Panorama Generator — DreamForgeX",
  description: "Transform photos into panoramic views",
  openGraph: {
    title: "AI Panorama Generator — DreamForgeX",
    description: "Transform photos into panoramic views",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
