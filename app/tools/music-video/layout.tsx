import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Music Video Studio — DreamForgeX",
  description: "Create AI music videos from your photo and song",
  openGraph: {
    title: "AI Music Video Studio — DreamForgeX",
    description: "Create AI music videos from your photo and song",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
