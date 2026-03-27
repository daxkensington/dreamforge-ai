import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI QR Code Art — DreamForgeX",
  description: "Generate artistic QR codes that scan beautifully",
  openGraph: {
    title: "AI QR Code Art — DreamForgeX",
    description: "Generate artistic QR codes that scan beautifully",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
