import type { Metadata } from "next";
import Uncensored from "@/pages/Uncensored";
import { UNCENSORED_FAQ } from "@shared/uncensoredFaq";
import { UNCENSORED_PLANS } from "@shared/uncensoredPlans";

export const metadata: Metadata = {
  title: "Uncensored AI Image & Video Studio — No Filter, Card or Crypto | DreamForgeX",
  description:
    "Generate uncensored AI images & 5–10s videos with no content filter. 3 free previews (no card). Unlock all 7 Pro Studio tools from $4.99 with Card / Apple Pay (Credits) or Bitcoin. 18+ only.",
  alternates: { canonical: "https://dreamforgex.ai/uncensored" },
  openGraph: {
    title: "Uncensored AI Image & Video Studio — No Filter | DreamForgeX",
    description:
      "No content filter. 3 free previews. 7 unfiltered AI tools (Image, Video, Face Lock, Outfit Swap, Inpaint, 4-View Sheet). Unlock from $4.99 with Card / Apple Pay or Bitcoin. 18+.",
    url: "https://dreamforgex.ai/uncensored",
    siteName: "DreamForgeX",
    type: "website",
    images: [
      {
        url: "https://dreamforgex.ai/showcase/uncensored-char-aria-nordic.jpg",
        width: 1024,
        height: 1024,
        alt: "DreamForgeX Uncensored 18+ AI Image & Video Pro Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Uncensored AI Image & Video Studio — No Filter | DreamForgeX",
    description:
      "3 free previews (no card). 7 unfiltered AI tools: Flux Image, Wan 2.2 Video, Face Lock, Outfit Swap, Brush Inpaint & 4-View Character Sheets. From $4.99 via Card / Apple Pay or Bitcoin.",
    images: ["https://dreamforgex.ai/showcase/uncensored-char-aria-nordic.jpg"],
    site: "@dreamforgex_ai",
  },
};

// Product + FAQPage + BreadcrumbList structured data. Pricing ladder → AggregateOffer so rich
// results show the full $4.99–$19 range, not just the 30-day anchor.
const lowPrice = Math.min(...UNCENSORED_PLANS.map((p) => p.priceUsd)).toFixed(2);
const highPrice = Math.max(...UNCENSORED_PLANS.map((p) => p.priceUsd)).toFixed(2);

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "DreamForgeX", item: "https://dreamforgex.ai" },
        { "@type": "ListItem", position: 2, name: "Uncensored 18+ Pro Studio", item: "https://dreamforgex.ai/uncensored" },
      ],
    },
    {
      "@type": "Product",
      name: "DreamForgeX Uncensored Pro Studio Pass",
      image: "https://dreamforgex.ai/showcase/uncensored-char-aria-nordic.jpg",
      description:
        "Uncensored AI image & video studio with no content filter — 7 pro tools unlocked with a Day, Week, or 30-Day pass via Card / Apple Pay (DreamForgeX Credits) or anonymously with Bitcoin. 18+ only. Three free watermarked previews with a free account.",
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
          description: `${p.durationDays} day${p.durationDays > 1 ? "s" : ""} of uncensored access (${p.creditPrice} Credits or $${p.priceUsd} BTC) + ${p.bonusCredits} bonus credits. One-time, no auto-renew.`,
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
