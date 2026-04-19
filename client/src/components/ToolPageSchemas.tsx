"use client";

import { usePathname } from "next/navigation";
import { TOOL_SEO_COPY } from "../../../shared/toolSeoCopy";

const BASE = "https://dreamforgex.ai";

// Emits schema.org JSON-LD blocks so Google can render rich-result snippets
// (FAQ accordion, How-To steps, SoftwareApplication card) directly in SERPs.
// Requires the tool to have an entry in toolSeoCopy — no copy, no schemas.
export function ToolPageSchemas() {
  const pathname = usePathname() || "";
  const match = pathname.match(/^\/tools\/([^/?#]+)/);
  const slug = match?.[1];
  if (!slug) return null;

  const entry = TOOL_SEO_COPY[slug];
  if (!entry) return null;

  const url = `${BASE}/tools/${slug}`;

  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: entry.title,
    description: entry.intro,
    url,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (web)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      description: "Free tier available; credits unlock higher-quality models",
    },
    creator: { "@type": "Organization", name: "DreamForgeX", url: BASE },
    isAccessibleForFree: true,
  };

  const faqPage =
    entry.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${url}#faq`,
          mainEntity: entry.faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }
      : null;

  const howTo =
    entry.howItWorks.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          "@id": `${url}#howto`,
          name: `How to use ${entry.title}`,
          description: `Step-by-step guide to using ${entry.title} on DreamForgeX.`,
          totalTime: "PT1M",
          supply: [],
          tool: [{ "@type": "HowToTool", name: entry.title }],
          step: entry.howItWorks.map((text, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            name: `Step ${i + 1}`,
            text,
          })),
        }
      : null;

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Tools", item: `${BASE}/tools` },
      { "@type": "ListItem", position: 3, name: entry.title, item: url },
    ],
  };

  const schemas = [softwareApp, faqPage, howTo, breadcrumbs].filter(Boolean);

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
