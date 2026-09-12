import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/headshot" },
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
