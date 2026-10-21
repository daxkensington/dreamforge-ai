import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/character-sheet" },
  title: "AI Character Sheet Generator Online — Multi-Angle Turnarounds & Reference Sheets | DreamForgeX",
  description: "Generate consistent multi-angle character reference sheets, front/side/back turnarounds, and expression sheets for games, comics, and animation — 50 free daily credits.",
  openGraph: {
    title: "AI Character Sheet Generator Online — Multi-Angle Turnarounds & Reference Sheets | DreamForgeX",
    description: "Generate consistent multi-angle character reference sheets, front/side/back turnarounds, and expression sheets for games, comics, and animation — 50 free daily credits.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
