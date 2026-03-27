import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Professional Headshots — DreamForgeX",
  description: "Generate professional headshots from any photo",
  openGraph: {
    title: "AI Professional Headshots — DreamForgeX",
    description: "Generate professional headshots from any photo",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
