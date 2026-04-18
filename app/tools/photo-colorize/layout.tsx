import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Old Photo Colorizer — DreamForgeX",
  description: "Era-aware AI colorization for black and white photographs.",
  openGraph: {
    title: "Old Photo Colorizer — DreamForgeX",
    description: "Colorize B&W photos with period-accurate AI.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
