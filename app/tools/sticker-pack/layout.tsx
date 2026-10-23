import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/sticker-pack" },
  title: "Sticker Pack Designer — DreamForgeX",
  description: "Coordinated 3-8 sticker packs ready for Telegram, iMessage, and WhatsApp.",
  openGraph: { title: "Sticker Pack Designer — DreamForgeX", description: "Coordinated 3-8 sticker packs ready for Telegram, iMessage, and WhatsApp." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
