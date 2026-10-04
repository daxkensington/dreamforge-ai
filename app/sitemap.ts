import type { MetadataRoute } from "next";
import fs from "fs";
import path from "path";
import { desc, eq, and, isNotNull } from "drizzle-orm";
import { getDb } from "../server/db";
import { galleryItems, generations } from "../drizzle/schema";
import { USE_CASE_SLUGS } from "../shared/useCaseData";
import { UNCENSORED_LANDING_SLUGS } from "../shared/uncensoredLanding";
import { BLOG_POSTS } from "../shared/blogPosts";

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
    { url: "/explore", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/marketplace", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/workspace", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/video-studio", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/api-docs", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/batch", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/demo/text-to-image", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/story", priority: 0.8, changeFrequency: "weekly" as const },
    { url: "/uncensored", priority: 0.9, changeFrequency: "monthly" as const },
    { url: "/for", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/takedown", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "/privacy", priority: 0.4, changeFrequency: "yearly" as const },
    { url: "/terms", priority: 0.4, changeFrequency: "yearly" as const },
    { url: "/about", priority: 0.4, changeFrequency: "yearly" as const },
  ];

  // Tool pages — derived from the filesystem (one live route per app/tools/<slug>/dir)
  // so the sitemap can never drift from the actual routes. Falls back to an
  // empty list if the FS read fails; routes are validated again at emit time.
  let toolSlugs: string[] = [];
  try {
    const toolsDir = path.join(process.cwd(), "app", "tools");
    toolSlugs = fs
      .readdirSync(toolsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("["))
      .map((d) => d.name)
      .sort();
  } catch (err) {
    console.warn("[sitemap] could not read app/tools, omitting tool URLs:", err);
  }
  const toolRoutes = toolSlugs.map((tool) => ({
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

  // Use-case landing pages (high buyer-intent SEO). Driven from the registry
  // so new audiences in useCaseData.ts appear here automatically.
  const useCaseRoutes = USE_CASE_SLUGS.map((s) => ({
    url: `/for/${s}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  // Uncensored SEO silo — one landing page per winnable uncensored-AI query.
  const uncensoredSiloRoutes = UNCENSORED_LANDING_SLUGS.map((s) => ({
    url: `/uncensored/${s}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  // Blog posts — one route per published guide.
  const blogRoutes = BLOG_POSTS.map((p) => ({
    url: `/blog/${p.slug}`,
    lastModified: new Date(p.updated ?? p.published),
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
    ...uncensoredSiloRoutes,
    { url: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
    ...blogRoutes,
    ...comparisonRoutes,
    ...videoRoutes,
  ].map((route) => ({
    url: `${BASE_URL}${route.url}`,
    // Only emit lastmod when we know it (blog posts, gallery approvals).
    // Claiming "today" for every static URL makes Google ignore lastmod.
    ...("lastModified" in route && route.lastModified instanceof Date
      ? { lastModified: route.lastModified }
      : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  return [...staticRoutes, ...galleryRoutes];
}
