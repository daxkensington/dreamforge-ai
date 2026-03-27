import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Music Composer — DreamForgeX",
  description: "Generate original instrumental music and scores",
  openGraph: {
    title: "AI Music Composer — DreamForgeX",
    description: "Generate original instrumental music and scores",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
