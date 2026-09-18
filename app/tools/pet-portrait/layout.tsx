import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/pet-portrait" },
  title: "Pet Portrait Generator — DreamForgeX",
  description: "Royal, fantasy, and artistic portraits of your dog, cat, or any pet.",
  openGraph: { title: "Pet Portrait Generator — DreamForgeX", description: "Turn your pet into a masterpiece." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
