import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Gallery — DreamForge",
  description: "Explore AI-generated images, videos, and art from the DreamForge community. Browse, like, comment, and remix prompts.",
  openGraph: {
    title: "Community Gallery — DreamForge",
    description: "Explore stunning AI-generated art from creators worldwide.",
    images: ["/showcase/gallery-4.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
