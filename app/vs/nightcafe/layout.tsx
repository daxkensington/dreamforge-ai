import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "DreamForgeX vs NightCafe — Production Tools + Marketplace | DreamForgeX",
  description:
    "Looking for a NightCafe alternative? DreamForgeX adds full video + audio gen, 100+ named workflow tools, a marketplace (85% revenue share), and a public API.",
  alternates: { canonical: "https://dreamforgex.ai/vs/nightcafe" },
  openGraph: {
    title: "DreamForgeX vs NightCafe — Compare features and pricing",
    description: "Production-focused alternative with marketplace + public API. Runs alongside NightCafe's community.",
    url: "https://dreamforgex.ai/vs/nightcafe",
    siteName: "DreamForgeX",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
