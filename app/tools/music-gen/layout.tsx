import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MusicGen Online — Free AI Music Generator | DreamForgeX",
  description: "Generate original instrumental music with MusicGen, self-hosted on our own GPUs. Free online AI music generator — no install, royalty-free output.",
  openGraph: {
    title: "MusicGen Online — Free AI Music Generator | DreamForgeX",
    description: "Generate original instrumental music with MusicGen, self-hosted on our own GPUs. Free online AI music generator — no install, royalty-free output.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
