import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/texture" },
  title: "AI Texture Generator — DreamForgeX",
  description: "Generate seamless textures for 3D and design",
  openGraph: {
    title: "AI Texture Generator — DreamForgeX",
    description: "Generate seamless textures for 3D and design",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
