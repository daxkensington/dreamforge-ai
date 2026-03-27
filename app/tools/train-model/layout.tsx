import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Train Custom AI Model — DreamForgeX",
  description: "Upload 5-20 images and train your own custom AI model. Generate consistent images of your face, brand, product, or art style.",
  openGraph: { title: "Train Custom AI Model — DreamForgeX", description: "Train your own AI model with custom images" },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
