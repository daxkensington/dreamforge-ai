import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import sharp from "sharp";
import { getDb } from "../db";
import { storageGetObjectBounded, storagePut } from "../storage";
import { walletRows } from "./walletAccounting";
import { videoContainerType } from "./videoGateway";
import { purgeRevokedMedia } from "./mediaLifecycle";

export const MEDIA_CHUNK_SIZE = 3 * 1024 * 1024;
const MIME: Record<string, { kind: "image" | "video" | "audio"; extension: string; max: number }> = {
  "image/png": { kind: "image", extension: "png", max: 10 * 1024 * 1024 },
  "image/jpeg": { kind: "image", extension: "jpg", max: 10 * 1024 * 1024 },
  "image/webp": { kind: "image", extension: "webp", max: 10 * 1024 * 1024 },
  "image/avif": { kind: "image", extension: "avif", max: 10 * 1024 * 1024 },
  "video/mp4": { kind: "video", extension: "mp4", max: 25 * 1024 * 1024 },
  "video/webm": { kind: "video", extension: "webm", max: 25 * 1024 * 1024 },
  "audio/mpeg": { kind: "audio", extension: "mp3", max: 20 * 1024 * 1024 },
  "audio/wav": { kind: "audio", extension: "wav", max: 20 * 1024 * 1024 },
  "audio/x-wav": { kind: "audio", extension: "wav", max: 20 * 1024 * 1024 },
  "audio/ogg": { kind: "audio", extension: "ogg", max: 20 * 1024 * 1024 },
};
export const mediaUploadInput = z.object({
  fileName: z.string().min(1).max(256), contentType: z.string().max(128), size: z.number().int().positive().max(25 * 1024 * 1024),
  purpose: z.enum(["timeline", "training", "animation"]),
});
async function database() { const db = await getDb(); if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Media storage is unavailable." }); return db; }
function valid(input: z.infer<typeof mediaUploadInput>) {
  const type = MIME[input.contentType];
  if (!type || input.size > type.max || (input.purpose !== "timeline" && type.kind !== "image")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a supported image (10 MB), video (25 MB), or audio file (20 MB). Training and animation accept images only." });
  }
  return type;
}
const stageKey = (upload: any, part: number) => `media-staging/${upload.userId}/${upload.id}/${part}`;
async function read(userId: number, uploadId: string) {
  const db = await database();
  const row = walletRows(await db.execute(sql`SELECT m.* FROM "mediaUploads" m JOIN users u ON u.id = m."userId"
    WHERE m.id = ${uploadId}::uuid AND m."userId" = ${userId} AND u."loginMethod" IS DISTINCT FROM 'deleted'`))[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found." });
  return row;
}
export async function createMediaUpload(userId: number, input: z.infer<typeof mediaUploadInput>) {
  const type = valid(input);
  const db = await database();
  const id = randomUUID();
  const key = `uploads/${userId}/${id}.${type.extension}`;
  const partCount = Math.ceil(input.size / MEDIA_CHUNK_SIZE);
  const results = await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(sql`SELECT pg_advisory_xact_lock(72819, ${userId})`),
    db.execute(sql`INSERT INTO "mediaUploads" (id, "userId", key, "fileName", "contentType", size, purpose, "partCount", "expiresAt")
      SELECT ${id}::uuid, ${userId}, ${key}, ${input.fileName}, ${input.contentType}, ${input.size}, ${input.purpose}, ${partCount}, now() + interval '1 hour'
      WHERE (SELECT count(*) FROM "mediaUploads" WHERE "userId" = ${userId} AND state IN ('open','assembling') AND "expiresAt" > now()) < 4
        AND (SELECT COALESCE(sum(size),0) FROM "mediaUploads" WHERE "userId" = ${userId} AND state IN ('open','assembling') AND "expiresAt" > now()) + ${input.size} <= 62914560
      RETURNING id`),
  ] as any);
  if (!walletRows(results[2]).length) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Finish your current uploads before starting another." });
  return { uploadId: id, key, chunkSize: MEDIA_CHUNK_SIZE, partCount, contentType: input.contentType, size: input.size };
}
export async function putMediaUploadPart(userId: number, uploadId: string, part: number, bytes: Buffer) {
  const upload = await read(userId, uploadId);
  if (!Number.isInteger(part) || part < 0 || part >= upload.partCount) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid upload part." });
  const expected = Math.min(MEDIA_CHUNK_SIZE, upload.size - part * MEDIA_CHUNK_SIZE);
  if (bytes.length !== expected) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload part has the wrong size." });
  const digest = createHash("sha256").update(bytes).digest("hex");
  const db = await database();
  const claimed = walletRows(await db.execute(sql`UPDATE "mediaUploads" SET parts = parts || jsonb_build_object(${String(part)}::text, ${digest}::text)
    WHERE id = ${uploadId}::uuid AND "userId" = ${userId} AND state = 'open' AND "expiresAt" > now()
      AND (parts->>${String(part)} IS NULL OR parts->>${String(part)} = ${digest}) RETURNING id`));
  if (!claimed.length) throw new TRPCError({ code: "CONFLICT", message: "This upload expired or its contents changed. Start a new upload." });
  await storagePut(stageKey(upload, part), bytes, "application/octet-stream", { isPrivate: true });
  return { accepted: true };
}
async function verifyBytes(bytes: Buffer, contentType: string) {
  const type = MIME[contentType];
  if (type.kind === "image") {
    const info = await sharp(bytes, { limitInputPixels: 40_000_000, animated: false }).metadata();
    const expected = contentType === "image/jpeg" ? "jpeg" : contentType === "image/avif" ? "heif" : contentType.split("/")[1];
    if (!info.width || !info.height || info.format !== expected || (contentType === "image/avif" && info.compression !== "av1")) throw new Error("Image content does not match its type.");
  } else if (contentType === "video/mp4") {
    if (videoContainerType(bytes) !== "video/mp4") throw new Error("Video content does not match MP4.");
  } else if (contentType === "video/webm") {
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) || !bytes.subarray(0, 4096).includes(Buffer.from("webm"))) throw new Error("Invalid WebM file.");
  } else if (contentType.endsWith("wav")) {
    if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") throw new Error("Invalid WAV file.");
  } else if (contentType === "audio/ogg") {
    if (bytes.toString("ascii", 0, 4) !== "OggS") throw new Error("Invalid Ogg file.");
  } else if (!(bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0))) throw new Error("Invalid MP3 file.");
}
function result(upload: any) { return { key: upload.key as string, url: `/api/media/${upload.key}`, contentType: upload.contentType as string, size: Number(upload.size) }; }
export async function completeMediaUpload(userId: number, uploadId: string) {
  const initial = await read(userId, uploadId);
  if (initial.state === "completed") { await revokeParts(initial).catch(() => undefined); return result(initial); }
  const db = await database();
  const token = randomUUID();
  const [upload] = walletRows(await db.execute(sql`UPDATE "mediaUploads" SET state = 'assembling', "leaseToken" = ${token}::uuid, "leaseUntil" = now() + interval '5 minutes'
    WHERE id = ${uploadId}::uuid AND "userId" = ${userId} AND "expiresAt" > now()
      AND (state = 'open' OR (state = 'assembling' AND "leaseUntil" < now()))
      AND (SELECT count(*) FROM jsonb_object_keys(parts)) = "partCount" RETURNING *`));
  if (!upload) throw new TRPCError({ code: "CONFLICT", message: "Upload is incomplete or is already finishing. Retry completion shortly." });
  try {
    const chunks: Buffer[] = [];
    for (let i = 0; i < upload.partCount; i++) {
      const part = await storageGetObjectBounded(stageKey(upload, i), MEDIA_CHUNK_SIZE);
      if (!part) throw new Error("An upload part is missing. Retry uploading the file.");
      const bytes = Buffer.from(part.bytes);
      if (createHash("sha256").update(bytes).digest("hex") !== upload.parts[String(i)]) throw new Error("Upload integrity check failed.");
      chunks.push(bytes);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== upload.size) throw new Error("Upload size does not match.");
    await verifyBytes(bytes, upload.contentType);
    await storagePut(upload.key, bytes, upload.contentType, { isPrivate: true });
    const done = walletRows(await db.execute(sql`UPDATE "mediaUploads" SET state = 'completed', "leaseToken" = NULL, "leaseUntil" = NULL
      WHERE id = ${uploadId}::uuid AND "userId" = ${userId} AND state = 'assembling' AND "leaseToken" = ${token}::uuid RETURNING id`));
    if (!done.length) throw new Error("Upload completion was cancelled.");
    await revokeParts(upload);
    return result(upload);
  } catch (error) {
    const current = await read(userId, uploadId).catch(() => null);
    if (current?.state === "completed") { await revokeParts(current).catch(() => undefined); return result(current); }
    await db.execute(sql`UPDATE "mediaUploads" SET state = 'open', "leaseToken" = NULL, "leaseUntil" = NULL
      WHERE id = ${uploadId}::uuid AND "userId" = ${userId} AND "leaseToken" = ${token}::uuid`).catch(() => undefined);
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Upload failed. Please try again." });
  }
}
async function revokeParts(upload: any) {
  const db = await database();
  await db.execute(sql`UPDATE "mediaAssets" SET "revokedAt" = COALESCE("revokedAt",now()), "deletedAt" = NULL, "deleteReason" = 'upload-parts-complete'
    WHERE "ownerUserId" = ${upload.userId} AND key LIKE ${`media-staging/${upload.userId}/${upload.id}/%`}`);
  await purgeRevokedMedia(10, upload.userId).catch(() => undefined);
}
export async function cleanupExpiredMediaUploads() {
  const db = await database();
  const expired = walletRows(await db.execute(sql`UPDATE "mediaUploads" SET state = 'failed', "leaseToken" = NULL, "leaseUntil" = NULL
    WHERE id IN (SELECT id FROM "mediaUploads" WHERE state IN ('open','assembling','failed') AND "expiresAt" < now() ORDER BY "expiresAt" LIMIT 100)
      AND EXISTS (SELECT 1 FROM users WHERE id = "mediaUploads"."userId" AND "loginMethod" IS DISTINCT FROM 'deleted') RETURNING *`));
  for (const upload of expired) {
    // Tombstone even keys whose PUT has not registered yet. A delayed part or
    // final-object upload must not appear after its expired session is gone.
    const keys = [upload.key, ...Array.from({ length: upload.partCount }, (_, part) => stageKey(upload, part))];
    await db.execute(sql`INSERT INTO "mediaAssets" (key, "ownerUserId", "isPrivate", "revokedAt", "deleteReason")
      SELECT value, ${upload.userId}, true, now(), 'upload-expired' FROM jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET "revokedAt" = COALESCE("mediaAssets"."revokedAt", now()),
        "deletedAt" = CASE WHEN "mediaAssets"."revokedAt" IS NULL THEN NULL ELSE "mediaAssets"."deletedAt" END,
        "deleteReason" = 'upload-expired' WHERE "mediaAssets"."ownerUserId" = EXCLUDED."ownerUserId"`);
    // Revocations, not an object-store response, are the durable completion
    // marker. Failed object deletions remain in mediaAssets for later cron.
    await db.execute(sql`DELETE FROM "mediaUploads" WHERE id = ${upload.id}::uuid AND "userId" = ${upload.userId} AND state = 'failed'`);
    await purgeRevokedMedia(10, upload.userId).catch(() => undefined);
  }
  return expired.length;
}
