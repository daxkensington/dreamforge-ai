import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Video Studio — Veo 3, Runway Gen-4 & Wan | DreamForgeX",
  description:
    "Multi-scene AI video studio powered by Google Veo 3, Runway Gen-4, Kling 2.0, and Wan 2.2. Create storyboards, scripts, soundtracks, and 4K upscaled video.",
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
