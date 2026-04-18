import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Real Estate Twilight — DreamForgeX",
  description: "Convert daytime listing exteriors to golden-hour and twilight MLS shots.",
  openGraph: {
    title: "Real Estate Twilight — DreamForgeX",
    description: "Daytime to twilight for real estate listings.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
