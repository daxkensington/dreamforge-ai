import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AudioGen Sound Effects Generator — Free Online | DreamForgeX",
  description: "Generate custom sound effects with AudioGen, self-hosted on our own GPUs. Free online AI sound-effect generator for games, video, and streams.",
  openGraph: {
    title: "AudioGen Sound Effects Generator — Free Online | DreamForgeX",
    description: "Generate custom sound effects with AudioGen, self-hosted on our own GPUs. Free online AI sound-effect generator for games, video, and streams.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
