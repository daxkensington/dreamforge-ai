import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Studio — DreamForge",
  description: "Generate AI images and videos with 53+ tools. Text-to-image, style transfer, upscaling, and more — powered by Grok, DALL-E 3, Gemini, and Claude.",
  openGraph: {
    title: "AI Studio — DreamForge",
    description: "Create stunning AI-generated images and videos with 53+ creative tools.",
    images: ["/showcase/home-tool-txtimg.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
