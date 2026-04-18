import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Bookmark Designer — DreamForgeX",
  description: "Printable bookmarks for readers, book clubs, and Etsy sellers.",
  openGraph: { title: "Bookmark Designer — DreamForgeX", description: "AI-designed printable bookmarks." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
