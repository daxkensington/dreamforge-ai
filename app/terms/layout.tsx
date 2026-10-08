import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/terms" },
  title: "Terms of Service — DreamForgeX",
  description: "The terms governing your use of DreamForgeX, our credit system, content ownership, acceptable use, and platform policies.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
