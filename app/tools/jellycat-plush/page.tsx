import type { Metadata } from "next";
import ToolJellycatPlush from "@/pages/ToolJellycatPlush";

export const metadata: Metadata = {
  title: "AI Jellycat Plush Generator — Turn Photos Into Soft Plush Toys | DreamForgeX",
  description:
    "Upload a photo and generate an adorable ultra-soft Jellycat-style plush toy with pastel fur, embroidered features, and signature Jellycat aesthetic.",
  alternates: { canonical: "https://dreamforgex.ai/tools/jellycat-plush" },
  openGraph: {
    title: "AI Jellycat Plush Generator | DreamForgeX",
    description: "Turn any photo into a cute Jellycat-style plush toy.",
    url: "https://dreamforgex.ai/tools/jellycat-plush",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolJellycatPlush />;
}
