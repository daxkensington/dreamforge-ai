import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/upscaler" },
  title: "Real-ESRGAN Online Free — 4x AI Image Upscaler (No Install) | DreamForgeX",
  description:
    "Run Real-ESRGAN online free in your browser. Upscale images 2x or 4x up to 4K resolution on dedicated GPUs — no install, no watermark on free daily credits.",
  openGraph: {
    title: "Real-ESRGAN Online Free — 4x AI Image Upscaler (No Install) | DreamForgeX",
    description:
      "Run Real-ESRGAN online free in your browser. Upscale images 2x or 4x up to 4K resolution on dedicated GPUs.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
