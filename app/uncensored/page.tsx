import type { Metadata } from "next";
import Uncensored from "@/pages/Uncensored";
import { UNCENSORED_FAQ } from "@shared/uncensoredFaq";
import { UNCENSORED_PLANS } from "@shared/uncensoredPlans";

export const metadata: Metadata = {
  title: "Uncensored AI Image Generator — No Filter, Pay with Crypto | DreamForgeX",
  description:
    "Generate uncensored AI images with no content filter. 3 free previews after free sign-in (no card). Day pass $4.99 · week $12 · 30 days $19. Pay anonymously with Bitcoin. 18+ only.",
  alternates: { canonical: "https://dreamforgex.ai/uncensored" },
  openGraph: {
    title: "Uncensored AI Image Generator — No Filter | DreamForgeX",
    description:
      "No content filter. 3 free previews (free account, no card). Passes from $4.99. Private. Crypto. 18+.",
    url: "https://dreamforgex.ai/uncensored",
    siteName: "DreamForgeX",
    images: ["/showcase/gallery-1.jpg"],
  },
};

// Product + FAQPage structured data. Pricing ladder → AggregateOffer so rich
// results show the full $4.99–$19 range, not just the 30-day anchor.
const lowPrice = Math.min(...UNCENSORED_PLANS.map((p) => p.priceUsd)).toFixed(2);
const highPrice = Math.max(...UNCENSORED_PLANS.map((p) => p.priceUsd)).toFixed(2);

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: "DreamForgeX Uncensored Pass",
      description:
        "Uncensored AI image generation with no content filter — day, week, or 30-day pass plus bonus credits, paid anonymously with Bitcoin. 18+ only. Three free watermarked previews with a free account.",
      brand: { "@type": "Brand", name: "DreamForgeX" },
      url: "https://dreamforgex.ai/uncensored",
      offers: {
        "@type": "AggregateOffer",
        lowPrice,
        highPrice,
        priceCurrency: "USD",
        offerCount: UNCENSORED_PLANS.length,
        availability: "https://schema.org/InStock",
        url: "https://dreamforgex.ai/uncensored",
        offers: UNCENSORED_PLANS.map((p) => ({
          "@type": "Offer",
          name: p.label,
          price: p.priceUsd.toFixed(2),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: "https://dreamforgex.ai/uncensored",
          description: `${p.durationDays} day${p.durationDays > 1 ? "s" : ""} of uncensored access + ${p.bonusCredits} bonus credits. One-time, no auto-renew.`,
        })),
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
