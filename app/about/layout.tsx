import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/about" },
  title: "About DreamForgeX — 100+ Tools & 30+ AI Models Studio",
  description:
    "DreamForgeX is the all-in-one AI creative studio: 100+ tools, 30+ models (FLUX, Veo 3, Runway Gen-4, Kling, Wan 2.2), and dedicated self-hosted GPUs.",
  openGraph: {
    title: "About DreamForgeX — One platform, every creative AI worth using",
    description:
      "100+ tools. 30+ models. Self-hosted GPUs. Exclusive LoRAs. The creative studio for people who use AI to ship.",
    images: ["/showcase/hero-forge.jpg"],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
