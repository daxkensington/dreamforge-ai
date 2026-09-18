import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/3d-generator" },
  title: "3D Model Generator — DreamForgeX",
  description: "Turn any image into a 3D model",
  openGraph: {
    title: "3D Model Generator — DreamForgeX",
    description: "Turn any image into a 3D model",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
