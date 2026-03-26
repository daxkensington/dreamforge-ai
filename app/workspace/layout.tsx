import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio — DreamForgeX",
  description: "Generate AI images and videos with 66+ tools. Text-to-image, style transfer, upscaling, and more — powered by Grok, DALL-E 3, Gemini, and Claude.",
  openGraph: {
    title: "AI Studio — DreamForgeX",
    description: "Create stunning AI-generated images and videos with 66+ creative tools.",
    images: ["/showcase/home-tool-txtimg.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
