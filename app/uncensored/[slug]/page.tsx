import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UncensoredLanding from "@/pages/UncensoredLanding";
import { UNCENSORED_LANDINGS, UNCENSORED_LANDING_SLUGS } from "@shared/uncensoredLanding";
import { UNCENSORED_PLANS } from "@shared/uncensoredPlans";

const SITE = "https://dreamforgex.ai";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return UNCENSORED_LANDING_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = UNCENSORED_LANDINGS[slug];
  if (!page) {
    return { title: "Not found — DreamForgeX", robots: { index: false, follow: true } };
  }
  const url = `${SITE}/uncensored/${slug}`;
  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url,
      siteName: "DreamForgeX",
      type: "website",
      images: [
        {
          url: `${SITE}/showcase/uncensored-char-aria-nordic.jpg`,
          width: 1024,
          height: 1024,
          alt: page.h1,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.metaDescription,
      images: [`${SITE}/showcase/uncensored-char-aria-nordic.jpg`],
      site: "@dreamforgex_ai",
    },
    robots: { index: true, follow: true },
  };
}

const lowPrice = Math.min(...UNCENSORED_PLANS.map((p) => p.priceUsd)).toFixed(2);
const highPrice = Math.max(...UNCENSORED_PLANS.map((p) => p.priceUsd)).toFixed(2);

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = UNCENSORED_LANDINGS[slug];
  if (!page) notFound();

  const url = `${SITE}/uncensored/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DreamForgeX", item: SITE },
          { "@type": "ListItem", position: 2, name: "Uncensored 18+ Studio", item: `${SITE}/uncensored` },
          { "@type": "ListItem", position: 3, name: page.h1, item: url },
        ],
      },
      {
        "@type": "Product",
        name: page.h1,
        image: `${SITE}/showcase/uncensored-char-aria-nordic.jpg`,
        description: page.metaDescription,
        brand: { "@type": "Brand", name: "DreamForgeX" },
        url,
        offers: {
          "@type": "AggregateOffer",
          lowPrice,
          highPrice,
          priceCurrency: "USD",
          offerCount: UNCENSORED_PLANS.length,
          availability: "https://schema.org/InStock",
          url: `${SITE}/uncensored`,
          offers: UNCENSORED_PLANS.map((p) => ({
            "@type": "Offer",
            name: `Uncensored ${p.label}`,
            price: p.priceUsd.toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: `${SITE}/uncensored`,
            description: `${p.durationDays} day${p.durationDays > 1 ? "s" : ""} of uncensored access (${p.creditPrice} Credits via Card/Apple Pay or $${p.priceUsd} Bitcoin) + ${p.bonusCredits} bonus credits. One-time, no auto-renew.`,
          })),
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <UncensoredLanding page={page} />
    </>
  );
}
