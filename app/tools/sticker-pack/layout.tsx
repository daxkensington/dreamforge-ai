import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Sticker Pack Designer — DreamForgeX",
  description: "Coordinated 3-8 sticker packs ready for Telegram, iMessage, and WhatsApp.",
  openGraph: { title: "Sticker Pack Designer — DreamForgeX", description: "Die-cut sticker packs with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
