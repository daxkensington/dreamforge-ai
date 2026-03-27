import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Transparent PNG — DreamForgeX",
  description: "Create clean transparent PNG cutouts with AI",
  openGraph: {
    title: "AI Transparent PNG — DreamForgeX",
    description: "Create clean transparent PNG cutouts with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
