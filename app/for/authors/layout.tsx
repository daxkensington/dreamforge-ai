import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Authors — Book Covers, Headshots, Bookmarks, Launch Kits | DreamForgeX",
  description: "Self-publish like a traditional house. Professional covers, author photos, bookmarks, launch-party invitations, BookTok promos — the whole launch kit.",
  openGraph: {
    title: "AI Tools for Authors — DreamForgeX",
    description: "Book covers, headshots, bookmarks, launch assets — self-publishing tier up.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
