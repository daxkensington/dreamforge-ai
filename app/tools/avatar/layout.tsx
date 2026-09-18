import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/avatar" },
  title: "AI Avatar Generator — DreamForgeX",
  description: "Create custom AI avatars in any style",
  openGraph: {
    title: "AI Avatar Generator — DreamForgeX",
    description: "Create custom AI avatars in any style",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
