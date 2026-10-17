import { readFile } from "node:fs/promises";
import postgres from "postgres";
import sharp from "sharp";
import { drizzle } from "drizzle-orm/neon-http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: null as any, put: vi.fn(), get: vi.fn(), purge: vi.fn() }));
vi.mock("../db", () => ({ getDb: async () => mocks.db }));
vi.mock("../storage", () => ({ storagePut: mocks.put, storageGetObjectBounded: mocks.get }));
vi.mock("./mediaLifecycle", () => ({ purgeRevokedMedia: mocks.purge }));
import { cleanupExpiredMediaUploads, completeMediaUpload, createMediaUpload, MEDIA_CHUNK_SIZE, putMediaUploadPart } from "./mediaUpload";
const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) { const url = new URL(testUrl); if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/dreamforge_billing_qa" || url.username !== "dreamforge_qa") throw new Error("Upload tests require the owned local fixture"); }
const suite = testUrl ? describe : describe.skip;
suite("owned chunked media upload on PostgreSQL with local object-store fixture", () => {
  const objects = new Map<string, Buffer>();
  const pg = postgres(testUrl ?? "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa", { max: 16, prepare: false, onnotice: () => {}, connection: { search_path: "media_upload_tools_qa" }, types: { neonJson: { to: 3802, from: [114, 3802], serialize: value => typeof value === "string" ? value : JSON.stringify(value), parse: JSON.parse } } });
  async function wire(tx: any, item: any) { const rows = await tx.unsafe(item.text, item.params), fields = (rows.columns ?? []).map((column: any) => ({ name: column.name, dataTypeID: column.type })); return { rows: item.options?.arrayMode ? rows.map((row: any) => fields.map((field: any) => row[field.name])) : [...rows], fields, rowCount: rows.count }; }
  function query(text: string, params: any[] = [], options: any = {}) { const item: any = { text, params, options, then: (resolve: any, reject: any) => wire(pg, item).then(resolve, reject) }; return item; }
  beforeAll(async () => {
    await pg.unsafe('CREATE SCHEMA media_upload_tools_qa');
    await pg.unsafe(`CREATE TYPE "videoProjectType" AS ENUM ('storyboard'); CREATE TABLE users (id integer PRIMARY KEY,"loginMethod" text);
      CREATE TABLE "mediaAssets" (key text PRIMARY KEY,"ownerUserId" integer,"isPrivate" boolean NOT NULL DEFAULT true,"revokedAt" timestamp,"deletedAt" timestamp,"deleteReason" text);`).simple();
    const migration16 = await readFile(new URL("../../drizzle/0016_media_revocation.sql", import.meta.url), "utf8");
    const ownerFence = migration16.split("--> statement-breakpoint").find(statement => statement.includes("CREATE FUNCTION dreamforge_active_content_owner()"));
    if (!ownerFence) throw new Error("Active-owner migration function missing"); await pg.unsafe(ownerFence).simple();
    const migration18 = await readFile(new URL("../../drizzle/0018_timeline_media_uploads.sql", import.meta.url), "utf8");
    for (const statement of migration18.split("--> statement-breakpoint")) await pg.unsafe(statement).simple();
    Object.assign(query, { query, transaction: (items: any[]) => pg.begin(async tx => { const results = []; for (const item of items) results.push(await wire(tx, item)); return results; }) });
    mocks.db = drizzle(query as any);
  });
  beforeEach(async () => {
    await pg.unsafe('TRUNCATE "mediaUploads","mediaAssets",users CASCADE'); await pg`INSERT INTO users VALUES (1,'google'),(2,'google'),(3,'deleted')`;
    objects.clear(); mocks.purge.mockReset().mockResolvedValue({ deleted: 0, failed: 0 });
    mocks.put.mockReset().mockImplementation(async (key: string, bytes: Buffer, _type: string, options: any) => {
      expect(options).toEqual({ isPrivate: true }); objects.set(key, Buffer.from(bytes));
      await pg`INSERT INTO "mediaAssets" (key,"ownerUserId") VALUES (${key},${Number(key.split('/')[1])}) ON CONFLICT(key) DO NOTHING`;
      return { key, url: "/fixture-only" };
    });
    mocks.get.mockReset().mockImplementation(async (key: string, max: number) => { const bytes = objects.get(key); if (!bytes) return null; if (bytes.length > max) throw new Error("Oversized fixture object"); return { bytes, contentType: "application/octet-stream" }; });
  });
  afterAll(async () => { await pg.unsafe("DROP SCHEMA media_upload_tools_qa CASCADE"); await pg.end(); });
  const image = () => sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).png().toBuffer();
  async function staged() { const bytes = await image(), upload = await createMediaUpload(1, { fileName: "fixture.png", contentType: "image/png", size: bytes.length, purpose: "timeline" }); await putMediaUploadPart(1, upload.uploadId, 0, bytes); return { bytes, upload }; }
  it("accepts bounded typed media and restricts training to images and active owners", async () => {
    for (const input of [ { contentType: "application/javascript", size: 1, purpose: "timeline" }, { contentType: "image/png", size: 10 * 1024 * 1024 + 1, purpose: "timeline" }, { contentType: "audio/wav", size: 20 * 1024 * 1024 + 1, purpose: "timeline" }, { contentType: "video/mp4", size: 25 * 1024 * 1024 + 1, purpose: "timeline" }, { contentType: "video/mp4", size: 1, purpose: "training" } ] as const) {
      await expect(createMediaUpload(1, { fileName: "fixture", ...input })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(createMediaUpload(3, { fileName: "deleted.png", contentType: "image/png", size: 20, purpose: "training" })).rejects.toThrow();
  });
  it("accepts actual AVIF bytes for private animation uploads", async () => {
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).avif().toBuffer();
    const upload = await createMediaUpload(1, { fileName: "fixture.avif", contentType: "image/avif", size: bytes.length, purpose: "animation" });
    await putMediaUploadPart(1, upload.uploadId, 0, bytes);
    expect(await completeMediaUpload(1, upload.uploadId)).toMatchObject({ key: upload.key, contentType: "image/avif" });
  });
  it("caps concurrent upload reservations by byte quota under the real advisory transaction lock", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => createMediaUpload(1, { fileName: "fixture.mp4", contentType: "video/mp4", size: 25 * 1024 * 1024, purpose: "timeline" })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(2);
    expect((await pg`SELECT count(*) AS count,sum(size) AS size FROM "mediaUploads"`)[0]).toMatchObject({ count: "2", size: String(50 * 1024 * 1024) });
  });
  it("rejects foreign access, invalid part sizes/indices and changed retries before storing bytes", async () => {
    const { upload, bytes } = await staged();
    await expect(putMediaUploadPart(2, upload.uploadId, 0, bytes)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(completeMediaUpload(2, upload.uploadId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(putMediaUploadPart(1, upload.uploadId, 1, bytes)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(putMediaUploadPart(1, upload.uploadId, 0, bytes.subarray(1))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(putMediaUploadPart(1, upload.uploadId, 0, Buffer.alloc(bytes.length))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(putMediaUploadPart(1, upload.uploadId, 0, bytes)).resolves.toEqual({ accepted: true });
  });
  it("assembles exactly one private final object with integrity checks and replayable completion", async () => {
    const { upload, bytes } = await staged();
    const settled = await Promise.allSettled([completeMediaUpload(1, upload.uploadId),completeMediaUpload(1, upload.uploadId)]);
    expect(settled.some(result => result.status === "fulfilled")).toBe(true);
    const result = await completeMediaUpload(1, upload.uploadId);
    expect(result).toMatchObject({ url: `/api/media/${upload.key}`, contentType: "image/png", size: bytes.length });
    expect(objects.get(upload.key)).toEqual(bytes);
    expect(mocks.put.mock.calls.filter(call => call[0] === upload.key)).toHaveLength(1);
    expect((await pg`SELECT "revokedAt" FROM "mediaAssets" WHERE key LIKE 'media-staging/%'`)[0].revokedAt).toBeTruthy();
  });
  it("does not publish missing/tampered or wrongly declared media and permits a clean retry", async () => {
    const { upload, bytes } = await staged(), key = `media-staging/1/${upload.uploadId}/0`;
    objects.set(key, Buffer.alloc(bytes.length));
    await expect(completeMediaUpload(1, upload.uploadId)).rejects.toThrow("integrity"); expect(objects.has(upload.key)).toBe(false);
    objects.set(key, bytes); await expect(completeMediaUpload(1, upload.uploadId)).resolves.toHaveProperty("url");
    const invalid = await createMediaUpload(1, { fileName: "fake.wav", contentType: "audio/wav", size: bytes.length, purpose: "timeline" });
    await putMediaUploadPart(1, invalid.uploadId, 0, bytes); await expect(completeMediaUpload(1, invalid.uploadId)).rejects.toThrow("Invalid WAV"); expect(objects.has(invalid.key)).toBe(false);
    const incomplete = await createMediaUpload(1, { fileName: "incomplete.mp4", contentType: "video/mp4", size: MEDIA_CHUNK_SIZE + 1, purpose: "timeline" });
    await expect(completeMediaUpload(1, incomplete.uploadId)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("durably revokes expired staged objects even when physical cleanup is unavailable", async () => {
    const { upload } = await staged(); mocks.purge.mockRejectedValue(new Error("Fixture storage outage"));
    await pg`UPDATE "mediaUploads" SET "expiresAt"=now()-interval '1 minute' WHERE id=${upload.uploadId}::uuid`;
    expect(await cleanupExpiredMediaUploads()).toBe(1);
    expect(await pg`SELECT * FROM "mediaUploads"`).toHaveLength(0);
    const assets = await pg`SELECT key,"revokedAt","deleteReason" FROM "mediaAssets"`;
    expect(assets).toHaveLength(2); expect(assets.every(asset => asset.revokedAt && asset.deleteReason === "upload-expired")).toBe(true);
    expect(assets.map(asset => asset.key)).toContain(upload.key);
    expect(await cleanupExpiredMediaUploads()).toBe(0);
    await expect(putMediaUploadPart(1, upload.uploadId, 0, await image())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("tombstones every not-yet-written key and advances beyond the oldest expired batch", async () => {
    // Old failed rows deliberately exceed the per-sweep limit. No bytes exist
    // yet: this models a late PUT racing the expiration sweep.
    await pg.unsafe(`INSERT INTO "mediaUploads" (id,"userId",key,"fileName","contentType",size,purpose,"partCount","expiresAt",state)
      SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,1,'uploads/1/expired-'||i||'.mp4','fixture.mp4','video/mp4',3145729,'timeline',2,now()-interval '1 hour','failed' FROM generate_series(1,101) i`);
    expect(await cleanupExpiredMediaUploads()).toBe(100); expect(await cleanupExpiredMediaUploads()).toBe(1); expect(await cleanupExpiredMediaUploads()).toBe(0);
    expect((await pg`SELECT count(*) FROM "mediaAssets" WHERE "revokedAt" IS NOT NULL`)[0].count).toBe("303");
    expect(await pg`SELECT * FROM "mediaUploads"`).toHaveLength(0);
  });
});
