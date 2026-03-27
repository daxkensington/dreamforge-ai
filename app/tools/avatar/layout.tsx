import type { Metadata } from "next";

export const metadata: Metadata = {
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
