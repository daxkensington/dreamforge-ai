import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/virtual-tryon" },
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
