import type { Metadata } from "next";
import Uncensored from "@/pages/Uncensored";
import { UNCENSORED_FAQ } from "@shared/uncensoredFaq";

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

// Product + FAQPage structured data. The FAQ entries are driven from the same
// shared module the visible on-page FAQ renders from, so Google's rich result
// always matches what the user sees.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "DreamForgeX Uncensored Pass",
      description:
        "Uncensored AI image generation with no content filter — 30 days of access plus 500 bonus credits, paid anonymously with Bitcoin or Lightning. 18+ only.",
      brand: { "@type": "Brand", name: "DreamForgeX" },
      url: "https://dreamforgex.ai/uncensored",
      offers: {
        "@type": "Offer",
        price: "19.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://dreamforgex.ai/uncensored",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: UNCENSORED_FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Uncensored />
    </>
  );
}
