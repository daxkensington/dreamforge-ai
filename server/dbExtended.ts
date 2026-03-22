import { eq, and, desc, sql, like } from "drizzle-orm";
import {
  galleryLikes,
  galleryComments,
  userFollows,
  characters,
  brandKits,
  apiKeys,
  sceneKeyframes,
  users,
  galleryItems,
  generations,
  type InsertCharacter,
  type InsertBrandKit,
  type InsertApiKey,
  type InsertSceneKeyframe,
} from "../drizzle/schema";

// Re-use the same db connection
import { getDb } from "./db";

// ─── Gallery Social ─────────────────────────────────────────────────────────

export async function toggleLike(userId: number, galleryItemId: number): Promise<{ liked: boolean; likeCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(galleryLikes)
    .where(and(eq(galleryLikes.userId, userId), eq(galleryLikes.galleryItemId, galleryItemId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(galleryLikes).where(eq(galleryLikes.id, existing[0].id));
  } else {
    await db.insert(galleryLikes).values({ userId, galleryItemId });
  }
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(galleryLikes).where(eq(galleryLikes.galleryItemId, galleryItemId));
  return { liked: existing.length === 0, likeCount: countResult[0]?.count ?? 0 };
}

export async function getLikeStatus(userId: number, galleryItemId: number) {
  const db = await getDb();
  if (!db) return { liked: false, likeCount: 0 };
  const existing = await db.select().from(galleryLikes)
    .where(and(eq(galleryLikes.userId, userId), eq(galleryLikes.galleryItemId, galleryItemId)))
    .limit(1);
  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(galleryLikes).where(eq(galleryLikes.galleryItemId, galleryItemId));
  return { liked: existing.length > 0, likeCount: countResult[0]?.count ?? 0 };
}

export async function getLikeCounts(galleryItemIds: number[]) {
  const db = await getDb();
  if (!db) return {};
  if (galleryItemIds.length === 0) return {};
  const results: Record<number, number> = {};
  for (const id of galleryItemIds) {
    const countResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(galleryLikes).where(eq(galleryLikes.galleryItemId, id));
    results[id] = countResult[0]?.count ?? 0;
  }
  return results;
}

export async function addComment(userId: number, galleryItemId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(galleryComments).values({ userId, galleryItemId, content }).returning({ id: galleryComments.id });
  return { id: result[0].id };
}

export async function getComments(galleryItemId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: galleryComments.id,
    content: galleryComments.content,
    userId: galleryComments.userId,
    userName: users.name,
    createdAt: galleryComments.createdAt,
  })
    .from(galleryComments)
    .leftJoin(users, eq(galleryComments.userId, users.id))
    .where(eq(galleryComments.galleryItemId, galleryItemId))
    .orderBy(desc(galleryComments.createdAt))
    .limit(limit);
}

export async function deleteComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const comment = await db.select().from(galleryComments)
    .where(and(eq(galleryComments.id, commentId), eq(galleryComments.userId, userId)))
    .limit(1);
  if (!comment[0]) throw new Error("Comment not found or not authorized");
  await db.delete(galleryComments).where(eq(galleryComments.id, commentId));
  return { success: true };
}

export async function toggleFollow(followerId: number, followingId: number): Promise<{ following: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (followerId === followingId) throw new Error("Cannot follow yourself");
  const existing = await db.select().from(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)))
    .limit(1);
  if (existing.length > 0) {
    await db.delete(userFollows).where(eq(userFollows.id, existing[0].id));
    return { following: false };
  }
  await db.insert(userFollows).values({ followerId, followingId });
  return { following: true };
}

export async function getFollowStatus(followerId: number, followingId: number) {
  const db = await getDb();
  if (!db) return { following: false, followerCount: 0, followingCount: 0 };
  const existing = await db.select().from(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)))
    .limit(1);
  const followerCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(userFollows).where(eq(userFollows.followingId, followingId));
  const followingCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(userFollows).where(eq(userFollows.followerId, followingId));
  return {
    following: existing.length > 0,
    followerCount: followerCount[0]?.count ?? 0,
    followingCount: followingCount[0]?.count ?? 0,
  };
}

export async function getFollowingFeed(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: galleryItems.id,
    generationId: galleryItems.generationId,
    userId: galleryItems.userId,
    title: galleryItems.title,
    description: galleryItems.description,
    featured: galleryItems.featured,
    viewCount: galleryItems.viewCount,
    createdAt: galleryItems.createdAt,
    userName: users.name,
    imageUrl: generations.imageUrl,
    thumbnailUrl: generations.thumbnailUrl,
    prompt: generations.prompt,
    mediaType: generations.mediaType,
  })
    .from(galleryItems)
    .innerJoin(userFollows, eq(galleryItems.userId, userFollows.followingId))
    .leftJoin(users, eq(galleryItems.userId, users.id))
    .leftJoin(generations, eq(galleryItems.generationId, generations.id))
    .where(eq(userFollows.followerId, userId))
    .orderBy(desc(galleryItems.createdAt))
    .limit(limit);
}

// ─── Characters ─────────────────────────────────────────────────────────────

export async function createCharacter(data: Omit<InsertCharacter, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(characters).values(data).returning({ id: characters.id });
  return { id: result[0].id };
}

export async function listCharacters(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(characters).where(eq(characters.userId, userId)).orderBy(desc(characters.createdAt));
}

export async function getCharacter(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateCharacter(id: number, userId: number, data: Partial<InsertCharacter>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(characters).set(data).where(and(eq(characters.id, id), eq(characters.userId, userId)));
  return { success: true };
}

export async function deleteCharacter(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(characters).where(and(eq(characters.id, id), eq(characters.userId, userId)));
  return { success: true };
}

// ─── Brand Kits ─────────────────────────────────────────────────────────────

export async function createBrandKit(data: Omit<InsertBrandKit, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(brandKits).values(data).returning({ id: brandKits.id });
  return { id: result[0].id };
}

export async function listBrandKits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brandKits).where(eq(brandKits.userId, userId)).orderBy(desc(brandKits.createdAt));
}

export async function getBrandKit(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(brandKits)
    .where(and(eq(brandKits.id, id), eq(brandKits.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateBrandKit(id: number, userId: number, data: Partial<InsertBrandKit>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(brandKits).set(data).where(and(eq(brandKits.id, id), eq(brandKits.userId, userId)));
  return { success: true };
}

export async function deleteBrandKit(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(brandKits).where(and(eq(brandKits.id, id), eq(brandKits.userId, userId)));
  return { success: true };
}

// ─── API Keys ───────────────────────────────────────────────────────────────

export async function createApiKey(data: Omit<InsertApiKey, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(apiKeys).values(data).returning({ id: apiKeys.id });
  return { id: result[0].id };
}

export async function listApiKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    permissions: apiKeys.permissions,
    rateLimit: apiKeys.rateLimit,
    lastUsedAt: apiKeys.lastUsedAt,
    active: apiKeys.active,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
}

export async function getApiKeyByHash(keyHash: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateApiKeyLastUsed(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
}

export async function revokeApiKey(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(apiKeys).set({ active: false }).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
  return { success: true };
}

export async function deleteApiKey(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
  return { success: true };
}

// ─── Scene Keyframes ────────────────────────────────────────────────────────

export async function createSceneKeyframe(data: Omit<InsertSceneKeyframe, "id">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sceneKeyframes).values(data).returning({ id: sceneKeyframes.id });
  return { id: result[0].id };
}

export async function listSceneKeyframes(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sceneKeyframes)
    .where(eq(sceneKeyframes.projectId, projectId))
    .orderBy(sceneKeyframes.sceneIndex);
}

export async function updateSceneKeyframe(id: number, data: Partial<InsertSceneKeyframe>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sceneKeyframes).set(data).where(eq(sceneKeyframes.id, id));
  return { success: true };
}

export async function deleteSceneKeyframes(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sceneKeyframes).where(eq(sceneKeyframes.projectId, projectId));
  return { success: true };
}

// ─── Search Generations ─────────────────────────────────────────────────────

export async function searchGenerations(userId: number, options: {
  query?: string;
  mediaType?: string;
  modelVersion?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  
  const conditions = [eq(generations.userId, userId)];
  if (options.query) {
    conditions.push(like(generations.prompt, `%${options.query}%`));
  }
  if (options.mediaType) {
    conditions.push(eq(generations.mediaType, options.mediaType as any));
  }
  if (options.modelVersion) {
    conditions.push(eq(generations.modelVersion, options.modelVersion));
  }
  if (options.status) {
    conditions.push(eq(generations.status, options.status as any));
  }

  const whereClause = and(...conditions);
  const items = await db.select().from(generations)
    .where(whereClause)
    .orderBy(desc(generations.createdAt))
    .limit(options.limit ?? 20)
    .offset(options.offset ?? 0);

  const countResult = await db.select({ count: sql<number>`COUNT(*)` })
    .from(generations).where(whereClause);

  return { items, total: countResult[0]?.count ?? 0 };
}
