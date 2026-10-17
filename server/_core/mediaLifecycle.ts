import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { mediaAssets, users } from "../../drizzle/schema";
import { ENV } from "./env";

export function normalizeStorageKey(value: string): string {
  const key = value.replace(/^\//, "");
  if (!key || key.length > 1024 || /[\\\x00-\x1f?#]/.test(key) || key.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Invalid storage key.");
  }
  return key;
}

/** Only our configured object URLs can become deletion targets. */
export function storageKeyFromUrl(value: string): string | null {
  try {
    const url = new URL(value, "https://dreamforgex.ai");
    const bases = ["https://dreamforgex.ai/img", "https://www.dreamforgex.ai/img", ...(ENV.r2PublicUrl ? [ENV.r2PublicUrl] : [])];
    for (const base of bases) {
      const parsed = new URL(base);
      const prefix = parsed.pathname.replace(/\/$/, "") + "/";
      if (url.origin === parsed.origin && url.pathname.startsWith(prefix)) return normalizeStorageKey(decodeURIComponent(url.pathname.slice(prefix.length)));
    }
    if (ENV.r2AccountId && ENV.r2BucketName) {
      if (url.hostname === `${ENV.r2BucketName}.${ENV.r2AccountId}.r2.cloudflarestorage.com`) return normalizeStorageKey(decodeURIComponent(url.pathname.slice(1)));
      if (url.hostname === `${ENV.r2AccountId}.r2.cloudflarestorage.com` && url.pathname.startsWith(`/${ENV.r2BucketName}/`)) return normalizeStorageKey(decodeURIComponent(url.pathname.slice(ENV.r2BucketName.length + 2)));
    }
  } catch { /* External or malformed URL: never delete it. */ }
  return null;
}

export function collectStorageKeys(values: unknown): string[] {
  const keys = new Set<string>();
  const walk = (value: unknown, depth: number) => {
    if (depth > 20) return;
    if (typeof value === "string") {
      const key = storageKeyFromUrl(value);
      if (key) keys.add(key);
    } else if (Array.isArray(value)) value.forEach(item => walk(item, depth + 1));
    else if (value && typeof value === "object") Object.values(value).forEach(item => walk(item, depth + 1));
  };
  walk(values, 0);
  return [...keys];
}

async function database() {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new Error("Media registry unavailable.");
  return db;
}

/** Register before upload; a deletion racing the upload can then revoke it. */
export async function registerMediaAsset(rawKey: string, userId?: number): Promise<void> {
  const key = normalizeStorageKey(rawKey);
  const db = await database();
  const result = userId === undefined
    ? await db.execute(sql`INSERT INTO "mediaAssets" (key) VALUES (${key})
        ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
        WHERE "mediaAssets"."ownerUserId" IS NULL AND "mediaAssets"."revokedAt" IS NULL RETURNING key`)
    : await db.execute(sql`INSERT INTO "mediaAssets" (key, "ownerUserId")
        SELECT ${key}, id FROM users WHERE id = ${userId} AND "loginMethod" IS DISTINCT FROM 'deleted' FOR SHARE
        ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
        WHERE "mediaAssets"."ownerUserId" = EXCLUDED."ownerUserId" AND "mediaAssets"."revokedAt" IS NULL RETURNING key`);
  if (((result as any).rows ?? result).length !== 1) throw new Error("This media upload is no longer allowed.");
}

export async function isMediaRevoked(rawKey: string): Promise<boolean> {
  const key = normalizeStorageKey(rawKey);
  const db = await database();
  const [asset] = await db.select({ revokedAt: mediaAssets.revokedAt, ownerDeleted: sql<boolean>`${users.loginMethod} = 'deleted'` })
    .from(mediaAssets).leftJoin(users, eq(users.id, mediaAssets.ownerUserId)).where(eq(mediaAssets.key, key)).limit(1);
  return !!asset && (!!asset.revokedAt || asset.ownerDeleted === true);
}

/** Queries are inserted into the caller's atomic account/content deletion batch. */
export function mediaRevocationQueries(db: Awaited<ReturnType<typeof database>>, keys: string[], reason: string, ownerId?: number) {
  if (keys.length === 0) return [];
  const now = new Date();
  // Existing ownership wins: an old foreign image embedded in a project must
  // not let account deletion revoke another creator's registered object.
  return [db.insert(mediaAssets).values([...new Set(keys)].map(key => ({
    key: normalizeStorageKey(key), ownerUserId: ownerId ?? null, revokedAt: now, deleteReason: reason,
  }))).onConflictDoUpdate({ target: mediaAssets.key,
    set: { revokedAt: now, deletedAt: null, deleteReason: reason },
    ...(ownerId === undefined ? {} : { setWhere: or(eq(mediaAssets.ownerUserId, ownerId), isNull(mediaAssets.ownerUserId)) }),
  })];
}

export async function revokeMediaUrls(values: unknown, reason: string): Promise<void> {
  const db = await database();
  const queries = mediaRevocationQueries(db, collectStorageKeys(values), reason);
  if (queries.length) await db.batch(queries as any);
}

/** Idempotent object deletion; failures stay in the durable registry for cron. */
export async function purgeRevokedMedia(limit = 50, ownerId?: number) {
  const db = await database();
  const pending = await db.select({ key: mediaAssets.key }).from(mediaAssets)
    .leftJoin(users, eq(users.id, mediaAssets.ownerUserId))
    .where(and(isNull(mediaAssets.deletedAt),
      or(isNotNull(mediaAssets.revokedAt), eq(users.loginMethod, "deleted")),
      ownerId === undefined ? undefined : eq(mediaAssets.ownerUserId, ownerId)))
    .limit(Math.max(1, Math.min(limit, 100)));
  const { storageDelete } = await import("../storage");
  let deleted = 0;
  let failed = 0;
  for (const { key } of pending) {
    // Make the route deny access before attempting an external delete.
    const [claim] = await db.update(mediaAssets).set({ revokedAt: sql`COALESCE(${mediaAssets.revokedAt}, now())`,
      deleteAttempts: sql`${mediaAssets.deleteAttempts} + 1`, lastDeleteAttemptAt: new Date() })
      .where(eq(mediaAssets.key, key)).returning({ attempt: mediaAssets.deleteAttempts });
    if (!claim) continue;
    try {
      await storageDelete(key);
      await db.update(mediaAssets).set({ deletedAt: new Date() })
        .where(and(eq(mediaAssets.key, key), eq(mediaAssets.deleteAttempts, claim.attempt)));
      deleted++;
    } catch {
      failed++;
      console.warn("[media-cleanup] Object deletion will be retried.");
    }
  }
  return { deleted, failed };
}

/** If deletion won during a slow PUT, do not return or retain the late object. */
export async function confirmMediaUpload(key: string): Promise<void> {
  if (!(await isMediaRevoked(key))) return;
  const db = await database();
  await db.update(mediaAssets).set({ revokedAt: new Date(), deletedAt: null,
    deleteAttempts: sql`${mediaAssets.deleteAttempts} + 1`, deleteReason: "upload-after-deletion" }).where(eq(mediaAssets.key, key));
  await purgeRevokedMedia(100).catch(() => undefined);
  throw new Error("This media upload was cancelled because the account or content was deleted.");
}
