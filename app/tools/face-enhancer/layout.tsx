import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Face Enhancer — DreamForgeX",
  description: "AI portrait retouching and face restoration",
  openGraph: {
    title: "AI Face Enhancer — DreamForgeX",
    description: "AI portrait retouching and face restoration",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
