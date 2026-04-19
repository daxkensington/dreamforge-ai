/**
 * Public share page for a single generation. Short URL `/g/<id>`.
 *
 * Server component — fetches the generation directly from the DB so OG meta
 * tags can be rendered for Twitter/Discord/iMessage unfurls (the whole point
 * of this route). Each share = one indexable, OG-rich URL with rich preview;
 * given GSC shows dreamforgex is search-invisible, this is the cheapest path
 * to backlinks + organic discovery.
 *
 * Linked from:
 *   - workspace generation result card
 *   - gallery cards
 *   - <ShareButton> component (anywhere in-app)
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getGenerationById } from "../../../server/db";
import { ShareGenerationView } from "../../../client/src/components/ShareGenerationView";

const SITE = "https://dreamforgex.ai";
const FALLBACK_OG = `${SITE}/showcase/gallery-4.jpg`;

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadGeneration(rawId: string) {
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const gen = await getGenerationById(id);
    if (!gen) return null;
    if (gen.status !== "completed" || !gen.imageUrl) return null;
    return gen;
  } catch (err) {
    console.error("[/g/:id] DB lookup failed:", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const gen = await loadGeneration(id);

  if (!gen) {
    return {
      title: "Generation not found — DreamForgeX",
      robots: { index: false, follow: true },
    };
  }

  const promptSnippet = gen.prompt.slice(0, 140) + (gen.prompt.length > 140 ? "…" : "");
  const title = `${promptSnippet} — DreamForgeX`;
  const description = `${gen.mediaType === "video" ? "AI video" : "AI image"} created on DreamForgeX. Try this prompt yourself with 100+ AI tools.`;
  const url = `${SITE}/g/${gen.id}`;
  const ogImage = gen.imageUrl ?? gen.thumbnailUrl ?? FALLBACK_OG;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "DreamForgeX",
      images: [{ url: ogImage, width: 1200, height: 1200, alt: promptSnippet }],
      type: gen.mediaType === "video" ? "video.other" : "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const gen = await loadGeneration(id);
  if (!gen) notFound();

  return (
    <ShareGenerationView
      id={gen.id}
      prompt={gen.prompt}
      mediaType={gen.mediaType}
      imageUrl={gen.imageUrl!}
      width={gen.width ?? null}
      height={gen.height ?? null}
      createdAt={gen.createdAt.toISOString()}
    />
  );
}
