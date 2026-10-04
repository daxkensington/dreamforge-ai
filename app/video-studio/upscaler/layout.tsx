import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Video Upscaler — Resolution Enhancement & Denoising | DreamForgeX",
  description: "Enhance video frame resolution with AI-powered upscaling and denoising — turn low-res footage into crisp, high-definition frames.",
  alternates: { canonical: "https://dreamforgex.ai/video-studio/upscaler" },
  openGraph: {
    title: "AI Video Upscaler — DreamForgeX",
    description: "AI-powered video upscaling and denoising for sharper frames.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
