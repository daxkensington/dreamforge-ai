import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Wallpaper Generator — DreamForgeX",
  description: "Generate stunning wallpapers for any device",
  openGraph: {
    title: "AI Wallpaper Generator — DreamForgeX",
    description: "Generate stunning wallpapers for any device",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
