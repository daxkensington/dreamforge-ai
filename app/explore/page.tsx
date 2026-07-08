/**
 * /explore — the SEO growth hub. A SERVER-rendered feed of public gallery
 * creations, so crawlers actually see the content (the interactive /gallery is
 * client-rendered = invisible to bots). Every card links to an OG-rich /g/<id>
 * share page, turning each generation into an indexable, linkable surface. This
 * is the free compounding-traffic loop: creations → indexable pages → search
 * traffic → funnel. Uncensored generations never reach here (blocked at
 * submit + excluded from the gallery by construction).
 */
import type { Metadata } from "next";
import { getGalleryItems } from "../../server/db";

const SITE = "https://dreamforgex.ai";
const PAGE_SIZE = 60;

export const metadata: Metadata = {
  title: "Explore AI Art — Community Creations Gallery | DreamForgeX",
  description:
    "Browse AI-generated art from the DreamForgeX community — images and video across 100+ tools and 30+ models. Free to try, no signup for the demo.",
  alternates: { canonical: `${SITE}/explore` },
  openGraph: {
    title: "Explore AI Art — DreamForgeX Gallery",
    description: "AI-generated images and video from the DreamForgeX community. Try any prompt yourself, free.",
    url: `${SITE}/explore`,
    siteName: "DreamForgeX",
    type: "website",
  },
};

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ExplorePage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let items: any[] = [];
  let total = 0;
  try {
    const res = await getGalleryItems({ limit: PAGE_SIZE, offset, sort: "newest" });
    items = res.items ?? [];
    total = res.total ?? 0;
  } catch {
    /* DB hiccup — render the shell, still a valid indexable page */
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ItemList JSON-LD so the feed is machine-readable for search.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "DreamForgeX AI Art Gallery",
    url: `${SITE}/explore`,
    hasPart: items.slice(0, 30).map((it) => ({
      "@type": "ImageObject",
      contentUrl: it.generation?.imageUrl,
      url: `${SITE}/g/${it.generation?.id}`,
      name: (it.title || it.generation?.prompt || "AI creation").slice(0, 120),
    })),
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2.5rem 1rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          Explore AI Art
        </h1>
        <p style={{ marginTop: "0.75rem", opacity: 0.7, maxWidth: 640, marginInline: "auto" }}>
          Real creations from the DreamForgeX community — made with 100+ AI tools on self-hosted GPUs.{" "}
          <a href="/demo/text-to-image" style={{ color: "#f43f5e", textDecoration: "underline" }}>
            Try it free
          </a>{" "}
          — no signup needed.
        </p>
      </header>

      {items.length === 0 ? (
        <p style={{ textAlign: "center", opacity: 0.6, padding: "3rem 0" }}>
          The gallery is filling up.{" "}
          <a href="/demo/text-to-image" style={{ color: "#f43f5e", textDecoration: "underline" }}>
            Be the first — create something
          </a>
          .
        </p>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: "0.9rem",
          }}
        >
          {items.map((it) => {
            const gen = it.generation ?? {};
            const caption = (it.title || gen.prompt || "AI creation").slice(0, 100);
            return (
              <a
                key={it.id}
                href={`/g/${gen.id}`}
                style={{
                  display: "block",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(128,128,128,0.2)",
                  background: "rgba(128,128,128,0.05)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gen.imageUrl}
                  alt={caption}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: "0.6rem 0.7rem" }}>
                  <p style={{ fontSize: "0.8rem", lineHeight: 1.3, margin: 0 }}>{caption}</p>
                  {it.userName ? (
                    <p style={{ fontSize: "0.7rem", opacity: 0.5, margin: "0.3rem 0 0" }}>by {it.userName}</p>
                  ) : null}
                </div>
              </a>
            );
          })}
        </section>
      )}

      {/* Pagination — real <a> links so crawlers walk the whole feed */}
      {totalPages > 1 && (
        <nav style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginTop: "2.5rem" }}>
          {page > 1 && (
            <a href={`/explore?page=${page - 1}`} style={{ color: "#f43f5e" }}>
              ← Previous
            </a>
          )}
          <span style={{ opacity: 0.6 }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/explore?page=${page + 1}`} style={{ color: "#f43f5e" }}>
              Next →
            </a>
          )}
        </nav>
      )}
    </main>
  );
}
