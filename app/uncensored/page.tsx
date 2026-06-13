import type { Metadata } from "next";
import Uncensored from "@/pages/Uncensored";

export const metadata: Metadata = {
  title: "Uncensored AI Image Generator — No Filter, Pay with Crypto | DreamForgeX",
  description:
    "Generate uncensored AI images with no content filter. Unfiltered open-source models, private by default, pay anonymously with Bitcoin. 18+ only.",
  alternates: { canonical: "https://dreamforgex.ai/uncensored" },
  openGraph: {
    title: "Uncensored AI Image Generator — No Filter | DreamForgeX",
    description:
      "No content filter. Unfiltered models. Private generations. Pay with crypto. 18+.",
    url: "https://dreamforgex.ai/uncensored",
    siteName: "DreamForgeX",
    images: ["/showcase/gallery-1.jpg"],
  },
};

export default function Page() {
  return <Uncensored />;
}
