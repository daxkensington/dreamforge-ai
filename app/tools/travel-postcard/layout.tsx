import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Travel Postcard Maker — DreamForgeX",
  description: "Vintage-style travel postcards for any destination, any era.",
  openGraph: { title: "Travel Postcard Maker — DreamForgeX", description: "Vintage travel postcards with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
