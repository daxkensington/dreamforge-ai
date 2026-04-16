import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Virtual Try-On — DreamForgeX",
  description: "See how any garment looks on you with AI",
  openGraph: {
    title: "Virtual Try-On — DreamForgeX",
    description: "See how any garment looks on you with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
