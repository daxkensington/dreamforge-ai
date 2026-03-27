import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Mockup Generator — DreamForgeX",
  description: "Create professional product mockups with AI",
  openGraph: {
    title: "AI Mockup Generator — DreamForgeX",
    description: "Create professional product mockups with AI",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
