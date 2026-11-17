import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/headshot" },
  title: "Free AI Professional Headshot Generator | DreamForgeX",
  description:
    "Turn any selfie into a studio-quality LinkedIn or corporate headshot online with AI. Choose backdrops, lighting & attire — 50 free daily credits.",
  openGraph: {
    title: "Free AI Professional Headshot Generator | DreamForgeX",
    description:
      "Turn any selfie into a studio-quality LinkedIn or corporate headshot online with AI. Choose backdrops, lighting & attire — 50 free daily credits.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
