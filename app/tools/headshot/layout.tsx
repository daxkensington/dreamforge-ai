import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/headshot" },
  title: "Free AI Professional Headshot Generator Online — Studio Portraits from Any Selfie | DreamForgeX",
  description: "Turn any casual selfie into a studio-quality professional LinkedIn or corporate headshot online with AI. Choose backdrops, lighting, and attire — 50 free daily credits.",
  openGraph: {
    title: "Free AI Professional Headshot Generator Online — Studio Portraits from Any Selfie | DreamForgeX",
    description: "Turn any casual selfie into a studio-quality professional LinkedIn or corporate headshot online with AI. Choose backdrops, lighting, and attire — 50 free daily credits.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
