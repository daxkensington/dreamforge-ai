import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CogVideoX Image to Video — Free Online AI | DreamForgeX",
  description: "Animate still images into video clips with CogVideoX, self-hosted on our own GPUs. Free online AI image-to-video generator.",
  openGraph: {
    title: "CogVideoX Image to Video — Free Online AI | DreamForgeX",
    description: "Animate still images into video clips with CogVideoX, self-hosted on our own GPUs. Free online AI image-to-video generator.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
