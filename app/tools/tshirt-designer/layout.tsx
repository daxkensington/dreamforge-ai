import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "T-Shirt Designer — DreamForgeX",
  description: "Generate print-ready t-shirt designs with AI",
  openGraph: {
    title: "T-Shirt Designer — DreamForgeX",
    description: "Generate print-ready t-shirt designs with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
