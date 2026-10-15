import { and, desc, eq, gte, inArray, like, lte, or, sql, asc, count } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createHash } from "crypto";
import {
  InsertUser,
  users,
  generations,
  tags,
  generationTags,
  galleryItems,
  galleryLikes,
  galleryComments,
  moderationQueue,
  moderationLog,
  takedownRequests,
  videoProjects,
  projectCollaborators,
  projectShareTokens,
  projectRevisions,
  type InsertGeneration,
  type InsertTag,
  type InsertGalleryItem,
  type InsertModerationItem,
  type TakedownRequest,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      _db = drizzle(sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * True when err is a Postgres unique-constraint violation (SQLSTATE 23505),
 * including when a driver wraps the original error on `cause`.
 */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code ?? (err as { cause?: { code?: unknown } })?.cause?.code;
  return code === "23505";
}

// ─── User Helpers ────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserProfile(
  userId: number,
  data: { bio?: string; institution?: string; name?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Tag Helpers ─────────────────────────────────────────────────────────────

export async function getAllTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).orderBy(asc(tags.category), asc(tags.name));
}

export async function getTagBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return result[0];
}

export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) return;
  await db.insert(tags).values(data);
}

export async function seedDefaultTags() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: tags.id }).from(tags).limit(1);
  if (existing.length > 0) return;

  const defaultTags: InsertTag[] = [
    { name: "Fantasy", slug: "fantasy", category: "genre", color: "#8b5cf6", description: "Mythical worlds, magic, and fantastical creatures" },
    { name: "Sci-Fi", slug: "sci-fi", category: "genre", color: "#06b6d4", description: "Futuristic technology, space, and speculative science" },
    { name: "Mythological", slug: "mythological", category: "theme", color: "#f59e0b", description: "Ancient myths, legends, and divine narratives" },
    { name: "Stylized Dynamics", slug: "stylized-dynamics", category: "style", color: "#ec4899", description: "Artistic motion, interpersonal dynamics, and kinetic compositions" },
    { name: "Abstract Eroticism", slug: "abstract-eroticism", category: "theme", color: "#ef4444", description: "Non-representational exploration of form, intimacy, and embodiment" },
    { name: "Surreal Anatomy", slug: "surreal-anatomy", category: "subject", color: "#10b981", description: "Dreamlike body studies and impossible biological forms" },
    { name: "Cyberpunk", slug: "cyberpunk", category: "genre", color: "#a855f7", description: "Neon-lit dystopias and high-tech low-life aesthetics" },
    { name: "Impressionist", slug: "impressionist", category: "style", color: "#3b82f6", description: "Soft edges, light play, and atmospheric rendering" },
    { name: "Biomechanical", slug: "biomechanical", category: "subject", color: "#64748b", description: "Fusion of organic and mechanical forms" },
    { name: "Cosmic Horror", slug: "cosmic-horror", category: "theme", color: "#1e1b4b", description: "Lovecraftian vastness and incomprehensible entities" },
    { name: "Art Nouveau", slug: "art-nouveau", category: "style", color: "#d97706", description: "Flowing organic lines and decorative natural motifs" },
    { name: "Ethereal", slug: "ethereal", category: "style", color: "#c4b5fd", description: "Otherworldly, luminous, and dreamlike qualities" },
  ];

  await db.insert(tags).values(defaultTags);
}

// ─── Generation Helpers ──────────────────────────────────────────────────────

export async function createGeneration(data: InsertGeneration) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(generations).values(data).returning({ id: generations.id });
  return result[0].id;
}

export async function updateGeneration(
  id: number,
  data: Partial<InsertGeneration>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(generations).set(data).where(eq(generations.id, id));
}

/**
 * Generations a user created under one client requestId, oldest first.
 *
 * The requestId is minted in the browser per click and travels in the POST
 * body, so a transport-level retry of the same click carries the same id.
 * Looking it up BEFORE creating rows / debiting credits / submitting GPU work
 * is what turns a retry into "return what the first attempt made" instead of
 * a second charge and a second job (see routers/uncensored.ts).
 */
export async function findGenerationsByRequestId(userId: number, requestId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(generations)
    .where(and(eq(generations.userId, userId), sql`${generations.metadata}->>'requestId' = ${requestId}`))
    .orderBy(asc(generations.id));
}

export async function getGenerationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(generations).where(eq(generations.id, id)).limit(1);
  return result[0];
}

export async function getUserGenerations(userId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getChildGenerations(parentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(generations)
    .where(eq(generations.parentGenerationId, parentId))
    .orderBy(desc(generations.createdAt));
}

export async function getGenerationWithTags(generationId: number) {
  const db = await getDb();
  if (!db) return null;
  const gen = await db
    .select()
    .from(generations)
    .where(eq(generations.id, generationId))
    .limit(1);
  if (!gen[0]) return null;

  const tagRows = await db
    .select({ tag: tags })
    .from(generationTags)
    .innerJoin(tags, eq(generationTags.tagId, tags.id))
    .where(eq(generationTags.generationId, generationId));

  return { ...gen[0], tags: tagRows.map((r) => r.tag) };
}

export async function setGenerationTags(generationId: number, tagIds: number[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(generationTags).where(eq(generationTags.generationId, generationId));
  if (tagIds.length > 0) {
    await db.insert(generationTags).values(
      tagIds.map((tagId) => ({ generationId, tagId }))
    );
  }
}

// ─── Gallery Helpers ─────────────────────────────────────────────────────────

export async function getGalleryItems(options: {
  limit?: number;
  offset?: number;
  tagSlugs?: string[];
  search?: string;
  modelVersion?: string;
  featured?: boolean;
  sort?: "newest" | "oldest" | "most_viewed";
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { limit = 24, offset = 0, tagSlugs, search, modelVersion, featured, sort = "newest" } = options;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(generations.prompt, `%${search}%`),
        like(galleryItems.title, `%${search}%`),
        like(galleryItems.description, `%${search}%`)
      )
    );
  }
  if (modelVersion) {
    conditions.push(eq(generations.modelVersion, modelVersion));
  }
  if (featured !== undefined) {
    conditions.push(eq(galleryItems.featured, featured));
  }

  let query = db
    .select({
      galleryItem: galleryItems,
      generation: generations,
      userName: users.name,
    })
    .from(galleryItems)
    .innerJoin(generations, eq(galleryItems.generationId, generations.id))
    .innerJoin(users, eq(galleryItems.userId, users.id));

  if (tagSlugs && tagSlugs.length > 0) {
    const tagRows = await db
      .select({ id: tags.id })
      .from(tags)
      .where(inArray(tags.slug, tagSlugs));
    const tagIdList = tagRows.map((t) => t.id);
    if (tagIdList.length > 0) {
      const genIdsWithTags = await db
        .select({ generationId: generationTags.generationId })
        .from(generationTags)
        .where(inArray(generationTags.tagId, tagIdList));
      const genIds = Array.from(new Set(genIdsWithTags.map((r) => r.generationId)));
      if (genIds.length > 0) {
        conditions.push(inArray(galleryItems.generationId, genIds));
      } else {
        return { items: [], total: 0 };
      }
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ total: count() })
    .from(galleryItems)
    .innerJoin(generations, eq(galleryItems.generationId, generations.id))
    .innerJoin(users, eq(galleryItems.userId, users.id))
    .where(where);

  const items = await db
    .select({
      galleryItem: galleryItems,
      generation: generations,
      userName: users.name,
    })
    .from(galleryItems)
    .innerJoin(generations, eq(galleryItems.generationId, generations.id))
    .innerJoin(users, eq(galleryItems.userId, users.id))
    .where(where)
    .orderBy(
      sort === "most_viewed"
        ? desc(galleryItems.viewCount)
        : sort === "oldest"
        ? asc(galleryItems.createdAt)
        : desc(galleryItems.createdAt)
    )
    .limit(limit)
    .offset(offset);

  // Get tags for each item
  const genIds = items.map((i) => i.generation.id);
  let tagMap: Record<number, typeof tags.$inferSelect[]> = {};
  if (genIds.length > 0) {
    const tagRows = await db
      .select({ generationId: generationTags.generationId, tag: tags })
      .from(generationTags)
      .innerJoin(tags, eq(generationTags.tagId, tags.id))
      .where(inArray(generationTags.generationId, genIds));
    for (const row of tagRows) {
      if (!tagMap[row.generationId]) tagMap[row.generationId] = [];
      tagMap[row.generationId].push(row.tag);
    }
  }

  return {
    items: items.map((i) => ({
      ...i.galleryItem,
      generation: i.generation,
      userName: i.userName,
      tags: tagMap[i.generation.id] || [],
    })),
    total: countResult[0]?.total ?? 0,
  };
}

export async function getGalleryItemById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const items = await db
    .select({
      galleryItem: galleryItems,
      generation: generations,
      userName: users.name,
      userInstitution: users.institution,
    })
    .from(galleryItems)
    .innerJoin(generations, eq(galleryItems.generationId, generations.id))
    .innerJoin(users, eq(galleryItems.userId, users.id))
    .where(eq(galleryItems.id, id))
    .limit(1);

  if (!items[0]) return null;

  // increment view count
  await db
    .update(galleryItems)
    .set({ viewCount: sql`${galleryItems.viewCount} + 1` })
    .where(eq(galleryItems.id, id));

  const tagRows = await db
    .select({ tag: tags })
    .from(generationTags)
    .innerJoin(tags, eq(generationTags.tagId, tags.id))
    .where(eq(generationTags.generationId, items[0].generation.id));

  return {
    ...items[0].galleryItem,
    generation: items[0].generation,
    userName: items[0].userName,
    userInstitution: items[0].userInstitution,
    tags: tagRows.map((r) => r.tag),
  };
}

// ─── Moderation Helpers ──────────────────────────────────────────────────────

export async function createModerationItem(data: InsertModerationItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(moderationQueue).values(data).returning({ id: moderationQueue.id });
  return result[0].id;
}

/**
 * Publish a generation straight to the public gallery (auto-approved). Used by
 * the growth loop so clean SFW submissions flow without a manual review step.
 * Idempotent-ish: skips if this generation is already in the gallery.
 */
export async function publishGalleryItem(data: {
  generationId: number;
  userId: number;
  title: string;
  description?: string | null;
  approvedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select({ id: galleryItems.id })
    .from(galleryItems)
    .where(eq(galleryItems.generationId, data.generationId))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const result = await db
    .insert(galleryItems)
    .values({
      generationId: data.generationId,
      userId: data.userId,
      title: data.title,
      description: data.description ?? null,
      approvedBy: data.approvedBy ?? null,
      approvedAt: new Date(),
    })
    .returning({ id: galleryItems.id });
  return result[0].id;
}

export async function getModerationQueue(
  status: "pending" | "approved" | "rejected" = "pending",
  limit = 50,
  offset = 0
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const countResult = await db
    .select({ total: count() })
    .from(moderationQueue)
    .where(eq(moderationQueue.status, status));

  const items = await db
    .select({
      moderation: moderationQueue,
      generation: generations,
      userName: users.name,
    })
    .from(moderationQueue)
    .innerJoin(generations, eq(moderationQueue.generationId, generations.id))
    .innerJoin(users, eq(moderationQueue.userId, users.id))
    .where(eq(moderationQueue.status, status))
    .orderBy(desc(moderationQueue.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: items.map((i) => ({
      ...i.moderation,
      generation: i.generation,
      userName: i.userName,
    })),
    total: countResult[0]?.total ?? 0,
  };
}

/**
 * Review outcome for one moderation-queue item.
 *
 * State machine: only `pending` items may transition — the guarded UPDATE
 * matches `AND status = 'pending'`, so a rejected item can never be
 * re-approved (or vice versa) by a second review; that second review is a
 * no-op reported via `updated: false`.
 *
 * The approve path flips the status and publishes to the galleryItems table
 * atomically (single non-interactive transaction via db.batch — the neon-http
 * driver has no interactive transactions, but its batch API submits all
 * statements as one Postgres transaction in a single HTTP round trip). A
 * unique-constraint violation on the publish is treated as already-published
 * success: another flow (e.g. publishGalleryItem's growth loop) got the
 * generation into the gallery first, so the desired end state already holds.
 */
export async function reviewModerationItem(
  id: number,
  reviewerId: number,
  status: "approved" | "rejected",
  note?: string
): Promise<{ updated: boolean; galleryItemId?: number; submitterUserId?: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pendingGuard = and(
    eq(moderationQueue.id, id),
    eq(moderationQueue.status, "pending")
  );

  const [modItem] = await db
    .select()
    .from(moderationQueue)
    .where(pendingGuard)
    .limit(1);
  if (!modItem) return { updated: false };

  const reviewSet = {
    status,
    reviewedBy: reviewerId,
    reviewNote: note ?? null,
    reviewedAt: new Date(),
  };

  if (status === "rejected") {
    const rows = await db
      .update(moderationQueue)
      .set(reviewSet)
      .where(pendingGuard)
      .returning({ id: moderationQueue.id });
    return { updated: rows.length > 0 };
  }

  try {
    const [updated, inserted] = await db.batch([
      db
        .update(moderationQueue)
        .set(reviewSet)
        .where(pendingGuard)
        .returning({ id: moderationQueue.id }),
      db
        .insert(galleryItems)
        .values({
          generationId: modItem.generationId,
          userId: modItem.userId,
          title: modItem.title,
          description: modItem.description,
          approvedBy: reviewerId,
          approvedAt: new Date(),
        })
        .returning({ id: galleryItems.id }),
    ]);
    return { updated: updated.length > 0, galleryItemId: inserted[0]?.id, submitterUserId: modItem.userId };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // galleryItems(generationId) already satisfied: the generation is in the
    // gallery, which is the state approval wanted. The batch rolled back the
    // status flip too, so re-apply it alone and surface the existing row.
    const rows = await db
      .update(moderationQueue)
      .set(reviewSet)
      .where(pendingGuard)
      .returning({ id: moderationQueue.id });
    const existing = await db
      .select({ id: galleryItems.id })
      .from(galleryItems)
      .where(eq(galleryItems.generationId, modItem.generationId))
      .limit(1);
    return { updated: rows.length > 0, galleryItemId: existing[0]?.id, submitterUserId: modItem.userId };
  }
}

export async function getModerationStats() {
  const db = await getDb();
  if (!db) return { pending: 0, approved: 0, rejected: 0 };

  const result = await db
    .select({
      status: moderationQueue.status,
      count: count(),
    })
    .from(moderationQueue)
    .groupBy(moderationQueue.status);

  const stats = { pending: 0, approved: 0, rejected: 0 };
  for (const row of result) {
    if (row.status === "pending") stats.pending = row.count;
    if (row.status === "approved") stats.approved = row.count;
    if (row.status === "rejected") stats.rejected = row.count;
  }
  return stats;
}

// ─── Takedown Helpers ────────────────────────────────────────────────────────
// Back-office review for the public /api/takedown intake. Reporters reference
// content by URL only (see app/api/takedown/route.ts), so resolution maps the
// two public content shapes back to gallery rows:
//   /gallery/<id> → galleryItems.id
//   /g/<id>       → generations.id → galleryItems.generationId (share links)
// Anything else (CDN image URLs, external links) is surfaced as unresolvable
// so an admin acts on it manually instead of trusting a blind action.

export type GalleryRef = { kind: "item" | "generation"; id: number };

function extractGalleryRef(url: string): GalleryRef | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    // Reporters sometimes paste bare paths — treat the raw string as one.
    path = url;
  }
  const galleryMatch = path.match(/\/gallery\/(\d+)(?:[/?#]|$)/);
  if (galleryMatch) return { kind: "item", id: Number(galleryMatch[1]) };
  const shareMatch = path.match(/\/g\/(\d+)(?:[/?#]|$)/);
  if (shareMatch) return { kind: "generation", id: Number(shareMatch[1]) };
  return null;
}

export type TakedownItemSummary = {
  id: number;
  generationId: number;
  userId: number;
  title: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export type TakedownRequestWithItem = TakedownRequest & {
  /** Live gallery row the reported URL points at, or null when it can't be mapped or no longer exists. */
  item: TakedownItemSummary | null;
};

function toItemSummary(item: typeof galleryItems.$inferSelect, generation: { imageUrl: string | null; thumbnailUrl: string | null }): TakedownItemSummary {
  return {
    id: item.id,
    generationId: item.generationId,
    userId: item.userId,
    title: item.title,
    imageUrl: generation.imageUrl,
    thumbnailUrl: generation.thumbnailUrl,
  };
}

/**
 * All takedown requests (newest first, capped at 200), each with the gallery
 * item its URL resolves to when one exists. Gallery lookups are batched
 * (two queries total), not per-request.
 */
export async function listTakedownRequests(status?: string): Promise<TakedownRequestWithItem[]> {
  const db = await getDb();
  if (!db) return [];

  const requests = await db
    .select()
    .from(takedownRequests)
    .where(status ? eq(takedownRequests.status, status) : undefined)
    .orderBy(desc(takedownRequests.createdAt))
    .limit(200);

  const itemIds = new Set<number>();
  const generationIds = new Set<number>();
  for (const request of requests) {
    const ref = extractGalleryRef(request.url);
    if (ref?.kind === "item") itemIds.add(ref.id);
    if (ref?.kind === "generation") generationIds.add(ref.id);
  }

  const itemsById = new Map<number, TakedownItemSummary>();
  const itemsByGenerationId = new Map<number, TakedownItemSummary>();
  const collect = (rows: { item: typeof galleryItems.$inferSelect; imageUrl: string | null; thumbnailUrl: string | null }[]) => {
    for (const row of rows) {
      const summary = toItemSummary(row.item, row);
      itemsById.set(summary.id, summary);
      itemsByGenerationId.set(summary.generationId, summary);
    }
  };
  if (itemIds.size > 0) {
    collect(
      await db
        .select({ item: galleryItems, imageUrl: generations.imageUrl, thumbnailUrl: generations.thumbnailUrl })
        .from(galleryItems)
        .innerJoin(generations, eq(galleryItems.generationId, generations.id))
        .where(inArray(galleryItems.id, [...itemIds]))
    );
  }
  if (generationIds.size > 0) {
    collect(
      await db
        .select({ item: galleryItems, imageUrl: generations.imageUrl, thumbnailUrl: generations.thumbnailUrl })
        .from(galleryItems)
        .innerJoin(generations, eq(galleryItems.generationId, generations.id))
        .where(inArray(galleryItems.generationId, [...generationIds]))
    );
  }

  return requests.map((request) => {
    const ref = extractGalleryRef(request.url);
    const item =
      ref?.kind === "item"
        ? itemsById.get(ref.id) ?? null
        : ref?.kind === "generation"
          ? itemsByGenerationId.get(ref.id) ?? null
          : null;
    return { ...request, item };
  });
}

export type TakedownTarget =
  | { kind: "gallery_item"; item: TakedownItemSummary }
  | { kind: "already_removed"; ref: GalleryRef }
  | { kind: "unresolvable" };

/**
 * Map one reported URL to the gallery row an admin would act on.
 * `already_removed` means the URL is unambiguously our content but the
 * gallery row is gone (removed earlier) — resolving such a request as
 * remove_content is safe idempotently. `unresolvable` means the URL gives us
 * nothing actionable (CDN/external links) and needs human judgment.
 */
export async function resolveTakedownTarget(url: string): Promise<TakedownTarget> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const ref = extractGalleryRef(url);
  if (!ref) return { kind: "unresolvable" };

  const rows = await db
    .select({ item: galleryItems, imageUrl: generations.imageUrl, thumbnailUrl: generations.thumbnailUrl })
    .from(galleryItems)
    .innerJoin(generations, eq(galleryItems.generationId, generations.id))
    .where(ref.kind === "item" ? eq(galleryItems.id, ref.id) : eq(galleryItems.generationId, ref.id))
    .limit(1);

  if (!rows[0]) return { kind: "already_removed", ref };
  return { kind: "gallery_item", item: toItemSummary(rows[0].item, rows[0]) };
}

/**
 * Transition an open takedown request to its resolution. The UPDATE carries
 * `AND status = 'open'` so a request can be resolved exactly once — a second
 * call (double-click, two admins) updates zero rows and reports it, instead
 * of silently re-resolving or clobbering the first decision.
 */
export async function resolveTakedownRequest(data: {
  id: number;
  action: "remove_content" | "reject";
  adminNote?: string;
  adminUserId: number;
}): Promise<{ updated: boolean; request?: TakedownRequest }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .update(takedownRequests)
    .set({
      status: data.action === "remove_content" ? "actioned" : "rejected",
      notes: data.adminNote ?? null,
      resolvedAt: new Date(),
    })
    .where(and(eq(takedownRequests.id, data.id), eq(takedownRequests.status, "open")))
    .returning();
  return { updated: rows.length > 0, request: rows[0] };
}

/**
 * Permanently remove one gallery item and everything that references it
 * (likes, comments — the only dependent tables). All three deletes run as a
 * single non-interactive Postgres transaction via db.batch (the neon-http
 * driver has no interactive transactions, but batch submits every statement
 * atomically in one HTTP round trip): either the item and all dependents
 * disappear together or nothing does. The underlying generation row is
 * intentionally kept — only its public gallery presence is removed.
 */
export async function removeGalleryItem(itemId: number): Promise<{
  removed: boolean;
  item: typeof galleryItems.$inferSelect | null;
  likesRemoved: number;
  commentsRemoved: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [likes, comments, items] = await db.batch([
    db
      .delete(galleryLikes)
      .where(eq(galleryLikes.galleryItemId, itemId))
      .returning({ id: galleryLikes.id }),
    db
      .delete(galleryComments)
      .where(eq(galleryComments.galleryItemId, itemId))
      .returning({ id: galleryComments.id }),
    db
      .delete(galleryItems)
      .where(eq(galleryItems.id, itemId))
      .returning(),
  ]);

  return {
    removed: items.length > 0,
    item: items[0] ?? null,
    likesRemoved: likes.length,
    commentsRemoved: comments.length,
  };
}

/**
 * Best-effort audit trail for a takedown resolution, written to moderation_log
 * (the same compliance log prompt refusals use). takedown_requests itself has
 * no resolvedBy column, so the acting admin lands here. Follows the log's
 * privacy posture — no content stored, the reported URL is hashed for
 * correlation. Never throws: the takedown_requests row is the system of
 * record and must not fail because the trail did.
 */
export async function logTakedownAction(entry: {
  adminUserId: number;
  action: "remove_content" | "reject";
  ticket: string;
  url: string;
  ip?: string | null;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(moderationLog).values({
      category: "takedown",
      surface: `admin.takedown.${entry.action}`,
      userId: entry.adminUserId,
      ip: entry.ip ?? null,
      promptLen: 0,
      promptSha256: createHash("sha256").update(entry.url, "utf8").digest("hex"),
    });
  } catch (err) {
    console.warn("[takedown] moderation_log write failed:", err);
  }
}

// ─── Export Helpers ──────────────────────────────────────────────────────────

export async function getGenerationsForExport(ids: number[], userId: number) {
  const db = await getDb();
  if (!db) return [];

  const gens = await db
    .select()
    .from(generations)
    .where(and(inArray(generations.id, ids), eq(generations.userId, userId)));

  const tagRows = await db
    .select({ generationId: generationTags.generationId, tag: tags })
    .from(generationTags)
    .innerJoin(tags, eq(generationTags.tagId, tags.id))
    .where(inArray(generationTags.generationId, ids));

  const tagMap: Record<number, typeof tags.$inferSelect[]> = {};
  for (const row of tagRows) {
    if (!tagMap[row.generationId]) tagMap[row.generationId] = [];
    tagMap[row.generationId].push(row.tag);
  }

  return gens.map((g) => ({
    ...g,
    tags: tagMap[g.id] || [],
  }));
}

// ─── Usage Analytics Helpers ────────────────────────────────────────────────

export async function getUserUsageStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // Total counts by media type and status
  const genCounts = await db
    .select({
      mediaType: generations.mediaType,
      status: generations.status,
      count: count(),
    })
    .from(generations)
    .where(eq(generations.userId, userId))
    .groupBy(generations.mediaType, generations.status);

  const stats = {
    totalGenerations: 0,
    completedGenerations: 0,
    failedGenerations: 0,
    images: 0,
    videos: 0,
    animations: 0, // parentGenerationId not null
  };

  for (const row of genCounts) {
    stats.totalGenerations += row.count;
    if (row.status === "completed") {
      stats.completedGenerations += row.count;
      if (row.mediaType === "image") stats.images += row.count;
      if (row.mediaType === "video") stats.videos += row.count;
    }
    if (row.status === "failed") stats.failedGenerations += row.count;
  }

  // Count animations (video with parentGenerationId)
  const animCount = await db
    .select({ count: count() })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        eq(generations.status, "completed"),
        sql`${generations.parentGenerationId} IS NOT NULL`
      )
    );
  stats.animations = animCount[0]?.count ?? 0;

  // Model usage breakdown
  const modelUsage = await db
    .select({
      modelVersion: generations.modelVersion,
      count: count(),
    })
    .from(generations)
    .where(and(eq(generations.userId, userId), eq(generations.status, "completed")))
    .groupBy(generations.modelVersion)
    .orderBy(desc(count()));

  // Gallery stats for this user
  const galleryCount = await db
    .select({ count: count() })
    .from(galleryItems)
    .where(eq(galleryItems.userId, userId));

  const viewsResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${galleryItems.viewCount}), 0)` })
    .from(galleryItems)
    .where(eq(galleryItems.userId, userId));

  // Daily activity for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyActivity = await db
    .select({
      date: sql<string>`DATE(${generations.createdAt})`.as("activity_date"),
      count: count(),
    })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        gte(generations.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`activity_date`)
    .orderBy(asc(sql`activity_date`));

  // Free tier limits
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyImages = await db
    .select({ count: count() })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        eq(generations.mediaType, "image"),
        gte(generations.createdAt, monthStart)
      )
    );

  const monthlyVideos = await db
    .select({ count: count() })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        eq(generations.mediaType, "video"),
        gte(generations.createdAt, monthStart)
      )
    );

  const monthlyAnimations = await db
    .select({ count: count() })
    .from(generations)
    .where(
      and(
        eq(generations.userId, userId),
        sql`${generations.parentGenerationId} IS NOT NULL`,
        gte(generations.createdAt, monthStart)
      )
    );

  return {
    ...stats,
    modelUsage: modelUsage.map((m) => ({ model: m.modelVersion, count: m.count })),
    galleryItems: galleryCount[0]?.count ?? 0,
    totalViews: Number(viewsResult[0]?.total ?? 0),
    dailyActivity: dailyActivity.map((d) => ({ date: d.date, count: d.count })),
    monthlyUsage: {
      images: monthlyImages[0]?.count ?? 0,
      videos: monthlyVideos[0]?.count ?? 0,
      animations: monthlyAnimations[0]?.count ?? 0,
    },
    quota: {
      images: { used: monthlyImages[0]?.count ?? 0, limit: 25 },
      videos: { used: monthlyVideos[0]?.count ?? 0, limit: 5 },
      animations: { used: monthlyAnimations[0]?.count ?? 0, limit: 3 },
      gallerySubmissions: { used: galleryCount[0]?.count ?? 0, limit: 5 },
    },
  };
}

export async function getUserActivityTimeline(
  userId: number,
  limit = 30,
  offset = 0
) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const totalResult = await db
    .select({ count: count() })
    .from(generations)
    .where(eq(generations.userId, userId));

  const items = await db
    .select({
      id: generations.id,
      prompt: generations.prompt,
      mediaType: generations.mediaType,
      modelVersion: generations.modelVersion,
      status: generations.status,
      imageUrl: generations.imageUrl,
      parentGenerationId: generations.parentGenerationId,
      animationStyle: generations.animationStyle,
      createdAt: generations.createdAt,
    })
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items,
    total: totalResult[0]?.count ?? 0,
  };
}

export async function getGalleryStats() {
  const db = await getDb();
  if (!db) return { totalItems: 0, totalViews: 0, totalGenerations: 0 };

  const galleryCount = await db.select({ total: count() }).from(galleryItems);
  const genCount = await db.select({ total: count() }).from(generations);
  const viewSum = await db
    .select({ total: sql<number>`COALESCE(SUM(${galleryItems.viewCount}), 0)` })
    .from(galleryItems);

  return {
    totalItems: galleryCount[0]?.total ?? 0,
    totalGenerations: genCount[0]?.total ?? 0,
    totalViews: viewSum[0]?.total ?? 0,
  };
}

// ─── Video Project Helpers ──────────────────────────────────────────────────

export async function createVideoProject(project: {
  userId: number;
  type: "storyboard" | "script" | "scene-direction" | "soundtrack";
  title: string;
  description?: string;
  data: unknown;
  thumbnailUrl?: string;
  templateId?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(videoProjects).values(project).returning({ id: videoProjects.id });
  const id = result[0].id;
  return { id };
}

export async function updateVideoProject(
  id: number,
  userId: number,
  updates: {
    title?: string;
    description?: string;
    data?: unknown;
    thumbnailUrl?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(videoProjects)
    .set(updates)
    .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)));
  return { success: true };
}

export async function getVideoProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listVideoProjects(
  userId: number,
  opts?: { type?: string; limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return { projects: [], total: 0 };

  const conditions = [eq(videoProjects.userId, userId)];
  if (opts?.type) {
    conditions.push(eq(videoProjects.type, opts.type as any));
  }

  const whereClause = and(...conditions);
  const rows = await db
    .select()
    .from(videoProjects)
    .where(whereClause)
    .orderBy(desc(videoProjects.updatedAt))
    .limit(opts?.limit ?? 20)
    .offset(opts?.offset ?? 0);

  const totalResult = await db
    .select({ count: count() })
    .from(videoProjects)
    .where(whereClause);

  return {
    projects: rows,
    total: totalResult[0]?.count ?? 0,
  };
}

export async function deleteVideoProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(videoProjects)
    .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)));
  return { success: true };
}

// ─── Collaboration Helpers ──────────────────────────────────────────────────

export async function createShareToken(data: {
  projectId: number;
  token: string;
  permission: "viewer" | "editor";
  createdBy: number;
  expiresAt?: Date;
  maxUses?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectShareTokens).values(data).returning({ id: projectShareTokens.id });
  return { id: result[0].id };
}

export async function getShareToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(projectShareTokens)
    .where(eq(projectShareTokens.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function incrementShareTokenUse(tokenId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(projectShareTokens)
    .set({ useCount: sql`${projectShareTokens.useCount} + 1` })
    .where(eq(projectShareTokens.id, tokenId));
}

export async function deactivateShareToken(tokenId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only the creator can deactivate
  await db
    .update(projectShareTokens)
    .set({ active: false })
    .where(and(eq(projectShareTokens.id, tokenId), eq(projectShareTokens.createdBy, userId)));
}

export async function listShareTokens(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(projectShareTokens)
    .where(and(eq(projectShareTokens.projectId, projectId), eq(projectShareTokens.active, true)))
    .orderBy(desc(projectShareTokens.createdAt));
}

export async function addCollaborator(data: {
  projectId: number;
  userId: number;
  role: "viewer" | "editor";
  invitedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if already a collaborator
  const existing = await db
    .select()
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, data.projectId),
        eq(projectCollaborators.userId, data.userId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    // Update role if already exists
    await db
      .update(projectCollaborators)
      .set({ role: data.role })
      .where(eq(projectCollaborators.id, existing[0].id));
    return { id: existing[0].id, action: "updated" as const };
  }
  const result = await db.insert(projectCollaborators).values(data).returning({ id: projectCollaborators.id });
  return { id: result[0].id, action: "created" as const };
}

export async function listCollaborators(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: projectCollaborators.id,
      userId: projectCollaborators.userId,
      role: projectCollaborators.role,
      userName: users.name,
      userEmail: users.email,
      createdAt: projectCollaborators.createdAt,
    })
    .from(projectCollaborators)
    .leftJoin(users, eq(projectCollaborators.userId, users.id))
    .where(eq(projectCollaborators.projectId, projectId))
    .orderBy(desc(projectCollaborators.createdAt));
}

export async function removeCollaborator(collaboratorId: number, projectOwnerId: number, projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify the caller owns the project
  const project = await db
    .select()
    .from(videoProjects)
    .where(and(eq(videoProjects.id, projectId), eq(videoProjects.userId, projectOwnerId)))
    .limit(1);
  if (!project.length) throw new Error("Not authorized");
  await db
    .delete(projectCollaborators)
    .where(and(eq(projectCollaborators.id, collaboratorId), eq(projectCollaborators.projectId, projectId)));
  return { success: true };
}

export async function listSharedWithMe(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      collaboratorId: projectCollaborators.id,
      role: projectCollaborators.role,
      projectId: videoProjects.id,
      projectTitle: videoProjects.title,
      projectType: videoProjects.type,
      projectDescription: videoProjects.description,
      ownerName: users.name,
      ownerId: videoProjects.userId,
      updatedAt: videoProjects.updatedAt,
      createdAt: videoProjects.createdAt,
    })
    .from(projectCollaborators)
    .innerJoin(videoProjects, eq(projectCollaborators.projectId, videoProjects.id))
    .leftJoin(users, eq(videoProjects.userId, users.id))
    .where(eq(projectCollaborators.userId, userId))
    .orderBy(desc(videoProjects.updatedAt));
}

export async function getUserCollaboratorRole(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      )
    )
    .limit(1);
  return rows[0]?.role ?? null;
}

// ─── Version History Helpers ────────────────────────────────────────────────

export async function createRevision(data: {
  projectId: number;
  userId: number;
  version: number;
  data: unknown;
  changeNote?: string;
  source?: "manual" | "ai-refinement" | "revert" | "template";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projectRevisions).values({
    ...data,
    source: data.source ?? "manual",
  }).returning({ id: projectRevisions.id });
  return { id: result[0].id };
}

export async function listRevisions(projectId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: projectRevisions.id,
      version: projectRevisions.version,
      changeNote: projectRevisions.changeNote,
      source: projectRevisions.source,
      userName: users.name,
      userId: projectRevisions.userId,
      createdAt: projectRevisions.createdAt,
    })
    .from(projectRevisions)
    .leftJoin(users, eq(projectRevisions.userId, users.id))
    .where(eq(projectRevisions.projectId, projectId))
    .orderBy(desc(projectRevisions.version))
    .limit(limit);
}

export async function getRevision(revisionId: number, projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(projectRevisions)
    .where(and(eq(projectRevisions.id, revisionId), eq(projectRevisions.projectId, projectId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestRevisionVersion(projectId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${projectRevisions.version}), 0)` })
    .from(projectRevisions)
    .where(eq(projectRevisions.projectId, projectId));
  return rows[0]?.maxVersion ?? 0;
}
