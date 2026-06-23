import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real-ESRGAN Image Upscaler — Free Online 4x | DreamForgeX",
  description: "Upscale images up to 4x with Real-ESRGAN, self-hosted on our own GPUs. Free online AI image upscaler — no install, sharp detailed results.",
  openGraph: {
    title: "Real-ESRGAN Image Upscaler — Free Online 4x | DreamForgeX",
    description: "Upscale images up to 4x with Real-ESRGAN, self-hosted on our own GPUs. Free online AI image upscaler — no install, sharp detailed results.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
