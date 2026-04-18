import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Chapter Thumbnails — DreamForgeX",
  description: "Batch-generate per-chapter YouTube thumbnails optimized for CTR.",
  openGraph: {
    title: "YouTube Chapter Thumbnails — DreamForgeX",
    description: "Per-chapter YouTube thumbnails with AI.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
