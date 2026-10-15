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
      images: [`${SITE}/showcase/uncensored-char-aria-nordic.jpg`],
    },
    robots: { index: true, follow: true },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = UNCENSORED_LANDINGS[slug];
  if (!page) notFound();

  const url = `${SITE}/uncensored/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: page.h1,
        description: page.metaDescription,
        brand: { "@type": "Brand", name: "DreamForgeX" },
        url,
        offers: {
          "@type": "AggregateOffer",
          lowPrice: "4.99",
          highPrice: "19.00",
          priceCurrency: "USD",
          offerCount: UNCENSORED_PLANS.length,
          offers: UNCENSORED_PLANS.map((p) => ({
            "@type": "Offer",
            name: `Uncensored ${p.label}`,
            price: p.priceUsd.toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: `${SITE}/uncensored`,
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
