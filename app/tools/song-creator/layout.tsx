import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/song-creator" },
  title: "AI Song Creator — DreamForgeX",
  description: "Create original songs with AI vocals and lyrics",
  openGraph: {
    title: "AI Song Creator — DreamForgeX",
    description: "Create original songs with AI vocals and lyrics",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
