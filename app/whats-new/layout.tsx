import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What's New — DreamForgeX Changelog",
  description: "Every shipped phase on DreamForgeX — new tools, reliability work, auth, SEO, infrastructure. Build-in-public changelog.",
  openGraph: {
    title: "What's New — DreamForgeX",
    description: "Changelog of every shipped phase — new tools, reliability, auth, infrastructure.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
