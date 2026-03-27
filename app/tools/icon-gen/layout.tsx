import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Icon Generator — DreamForgeX",
  description: "Create custom app icons and favicons with AI",
  openGraph: {
    title: "AI Icon Generator — DreamForgeX",
    description: "Create custom app icons and favicons with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
