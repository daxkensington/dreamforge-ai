import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/product-photo" },
  title: "AI Product Photography — DreamForgeX",
  description: "Generate professional e-commerce product photos",
  openGraph: {
    title: "AI Product Photography — DreamForgeX",
    description: "Generate professional e-commerce product photos",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
