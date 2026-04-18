import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Listing Photo Pack — DreamForgeX",
  description: "Turn one product shot into a 5-photo Etsy/Shopify-ready listing pack.",
  openGraph: {
    title: "Listing Photo Pack — DreamForgeX",
    description: "5 pro angles from one product photo.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
