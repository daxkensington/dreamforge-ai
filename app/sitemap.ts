import type { MetadataRoute } from "next";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { getDb } from "../server/db";
import { galleryItems, generations } from "../drizzle/schema";

const BASE_URL = "https://dreamforgex.ai";

// Cap on how many gallery generations to expose in the sitemap. Keeps the
// XML payload bounded and within Google's 50k-URL-per-sitemap soft cap.
const GALLERY_LIMIT = 1000;

/**
 * Pull the most recently approved gallery items so each `/g/<id>` share
 * page becomes discoverable to crawlers. If the DB is unavailable at build
 * time, we silently return an empty list — base sitemap is still valid.
 */
async function loadGallerySitemap() {
  try {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        generationId: galleryItems.generationId,
        approvedAt: galleryItems.approvedAt,
      })
      .from(galleryItems)
      .innerJoin(generations, eq(galleryItems.generationId, generations.id))
      .where(
        and(
          isNotNull(galleryItems.approvedAt),
          eq(generations.status, "completed"),
          isNotNull(generations.imageUrl),
        ),
      )
      .orderBy(desc(galleryItems.approvedAt))
      .limit(GALLERY_LIMIT);
    return rows;
  } catch (err) {
    console.warn("[sitemap] gallery query failed, omitting share URLs:", err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Core pages
  const coreRoutes = [
    { url: "", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/tools", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/gallery", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/marketplace", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/workspace", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/video-studio", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/api-docs", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/batch", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/demo/text-to-image", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/story", priority: 0.8, changeFrequency: "weekly" as const },
  ];

  // Tool pages
  const toolRoutes = [
    "upscaler", "background", "inpainting", "outpainting", "face-enhancer",
    "color-grading", "style-transfer", "object-eraser", "image-blender",
    "variations", "nl-edit", "photo-restore", "hdr-enhance", "transparent-png",
    "panorama", "film-grain", "depth-map", "headshot", "logo-maker", "avatar",
    "wallpaper", "qr-art", "product-photo", "text-effects", "sketch-to-image",
    "vectorize", "texture", "icon-gen", "canvas", "mockup", "thumbnail",
    "character-sheet", "meme", "interior-design", "collage", "text-to-video",
    "image-to-video", "batch-prompts", "social-resize", "prompt-builder",
    "color-palette", "image-to-prompt", "image-caption", "music-gen",
    "text-to-speech", "audio-enhance", "sound-effects",
    "song-creator", "music-video", "social-templates", "clip-maker",
    "presentations", "templates", "ad-copy", "blog-writer", "caption-writer",
    "pixel-art", "coloring-book", "tattoo-design", "cover-maker",
    "pose-turnaround", "photo-colorize", "podcast-cover", "listing-photos",
    "real-estate-twilight", "fashion-lookbook", "meme-template",
    "yt-thumbnails", "ig-carousel", "sticker-pack", "recipe-card",
    "invitation", "business-card", "pet-portrait", "tarot-card",
    "movie-poster", "trading-card", "menu-design", "greeting-card",
    "emoji-creator", "brand-style-guide", "event-flyer", "certificate",
    "bookmark", "zine-spread", "concert-poster", "architecture-concept",
    "cosplay-reference", "travel-postcard",
    // Phase 39 Tier 2 — viral preset tools
    "action-figure", "funko-pop", "chibi-figure", "lego-mini", "pet-to-person",
    "barbie-box", "jellycat-plush", "pop-mart",
  ].map((tool) => ({
    url: `/tools/${tool}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  // Competitor comparison pages (high buying-intent SEO — "X alternative")
  const comparisonRoutes = [
    "midjourney", "leonardo", "runway", "ideogram", "krea",
    "canva-ai", "adobe-firefly", "playground", "nightcafe",
  ].map((s) => ({
    url: `/vs/${s}`,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  }));

  // Use-case landing pages (high buyer-intent SEO)
  const useCaseRoutes = [
    "etsy-sellers", "podcasters", "real-estate-agents", "cosplayers",
    "indie-devs", "authors", "restaurants", "tattoo-artists",
    "youtubers", "shopify-sellers", "streamers", "small-business",
  ].map((s) => ({
    url: `/for/${s}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  // Video Studio sub-pages
  const videoRoutes = [
    "storyboard", "scene-director", "script", "style-transfer",
    "upscaler", "soundtrack",
  ].map((page) => ({
    url: `/video-studio/${page}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  const galleryRows = await loadGallerySitemap();
  const galleryRoutes = galleryRows.map((row) => ({
    url: `${BASE_URL}/g/${row.generationId}`,
    lastModified: row.approvedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const staticRoutes = [
    ...coreRoutes,
    { url: "/whats-new", priority: 0.7, changeFrequency: "weekly" as const },
    ...toolRoutes,
    ...useCaseRoutes,
    ...comparisonRoutes,
    ...videoRoutes,
  ].map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [...staticRoutes, ...galleryRoutes];
}
