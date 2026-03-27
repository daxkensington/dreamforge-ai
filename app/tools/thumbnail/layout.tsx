import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI YouTube Thumbnail Maker — DreamForgeX",
  description: "Create click-worthy YouTube thumbnails",
  openGraph: {
    title: "AI YouTube Thumbnail Maker — DreamForgeX",
    description: "Create click-worthy YouTube thumbnails",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
