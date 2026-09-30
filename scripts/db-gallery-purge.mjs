// Backs up then removes gallery items by id (plus their likes/comments).
// Usage: node scripts/db-gallery-purge.mjs <envFile> <id1> [id2 ...]
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";

const [, , envFile, ...ids] = process.argv;
if (!envFile || ids.length === 0) {
  console.error("usage: node scripts/db-gallery-purge.mjs <envFile> <id1> [id2 ...]");
  process.exit(1);
}
config({ path: envFile });
const url = process.env.DATABASE_URL;
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }

const sql = neon(url);
// Coerced to integers above — safe to embed as literal SQL values.
const idList = ids.map((v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`invalid id: ${v}`);
    process.exit(1);
  }
  return n;
});
const inClause = idList.join(",");
const q = (text) => sql([text]);

const items = await q(`SELECT * FROM "galleryItems" WHERE id IN (${inClause})`);
if (items.length !== idList.length) {
  console.error(`expected ${idList.length} items, found ${items.length} — aborting`);
  process.exit(1);
}
const likes = await q(`SELECT * FROM "galleryLikes" WHERE "galleryItemId" IN (${inClause})`);
const comments = await q(`SELECT * FROM "galleryComments" WHERE "galleryItemId" IN (${inClause})`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `C:/Users/ianwe/tmp/gallery-purge-backup-${stamp}.json`;
writeFileSync(backupPath, JSON.stringify({ items, likes, comments }, null, 2));
console.log(`backup written: ${backupPath} (${items.length} items, ${likes.length} likes, ${comments.length} comments)`);

await q(`DELETE FROM "galleryLikes" WHERE "galleryItemId" IN (${inClause})`);
await q(`DELETE FROM "galleryComments" WHERE "galleryItemId" IN (${inClause})`);
const del = await q(`DELETE FROM "galleryItems" WHERE id IN (${inClause}) RETURNING id`);
console.log(`PURGE_OK deleted ${del.length} gallery items: ${del.map((r) => r.id).join(", ")}`);
