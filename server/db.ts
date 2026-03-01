import { and, desc, eq, inArray, like, or, sql, asc, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  generations,
  tags,
  generationTags,
  galleryItems,
  moderationQueue,
  type InsertGeneration,
  type InsertTag,
  type InsertGalleryItem,
  type InsertModerationItem,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
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

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  const result = await db.insert(generations).values(data);
  return result[0].insertId;
}

export async function updateGeneration(
  id: number,
  data: Partial<InsertGeneration>
) {
  const db = await getDb();
  if (!db) return;
  await db.update(generations).set(data).where(eq(generations.id, id));
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
  const result = await db.insert(moderationQueue).values(data);
  return result[0].insertId;
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

export async function reviewModerationItem(
  id: number,
  reviewerId: number,
  status: "approved" | "rejected",
  note?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(moderationQueue)
    .set({
      status,
      reviewedBy: reviewerId,
      reviewNote: note ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(moderationQueue.id, id));

  if (status === "approved") {
    const modItem = await db
      .select()
      .from(moderationQueue)
      .where(eq(moderationQueue.id, id))
      .limit(1);
    if (modItem[0]) {
      await db.insert(galleryItems).values({
        generationId: modItem[0].generationId,
        userId: modItem[0].userId,
        title: modItem[0].title,
        description: modItem[0].description,
        approvedBy: reviewerId,
        approvedAt: new Date(),
      });
    }
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

// ─── Export Helpers ──────────────────────────────────────────────────────────

export async function getGenerationsForExport(ids: number[]) {
  const db = await getDb();
  if (!db) return [];

  const gens = await db
    .select()
    .from(generations)
    .where(inArray(generations.id, ids));

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
