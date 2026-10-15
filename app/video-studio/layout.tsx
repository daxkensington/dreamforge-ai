import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Studio — Text-to-Video, Image-to-Video & Storyboards | DreamForgeX",
  description:
    "Multi-scene AI video production studio powered by Google Veo 3, Runway Gen-4, Kling 2.0, Luma Ray 2, and self-hosted Wan 2.2. Storyboards, scene direction, scripts, soundtracks, and 4K upscaling.",
  alternates: { canonical: "https://dreamforgex.ai/video-studio" },
  openGraph: {
    title: "AI Video Studio — Veo 3, Runway Gen-4, Kling 2.0 & Wan 2.2 | DreamForgeX",
    description:
      "Create cinematic AI videos with multi-scene storyboards, scripts, scene direction, soundtracks, and 4K upscaling.",
    url: "https://dreamforgex.ai/video-studio",
    siteName: "DreamForgeX",
    images: ["https://dreamforgex.ai/showcase/home-tool-video.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Video Studio — DreamForgeX",
    description:
      "Multi-scene AI video production with Google Veo 3, Runway Gen-4, Kling 2.0, and self-hosted Wan 2.2.",
    images: ["https://dreamforgex.ai/showcase/home-tool-video.jpg"],
    site: "@dreamforgex_ai",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
