import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/photo-restore" },
  title: "AI Photo Restorer — DreamForgeX",
  description: "Restore old and damaged photos with AI",
  openGraph: {
    title: "AI Photo Restorer — DreamForgeX",
    description: "Restore old and damaged photos with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
