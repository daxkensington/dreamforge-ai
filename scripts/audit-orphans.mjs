// Read-only orphan audit for the 0013 foreign keys (NOT VALID).
// Usage: node scripts/audit-orphans.mjs <envFile>
// Loads DATABASE_URL from the given env file (never prints the URL or credentials).
// For each relationship in migration 0013, counts child rows whose parent is
// missing. Run BEFORE validating the constraints (VALIDATE CONSTRAINT scans
// the table and fails if orphans remain). SELECT-only — safe against prod.
import { config } from "dotenv";
import postgres from "postgres";

const envFile = process.argv[2];
if (!envFile) {
  console.error("usage: node scripts/audit-orphans.mjs <envFile>");
  process.exit(1);
}
config({ path: envFile });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`DATABASE_URL is not set in ${envFile}`);
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

// Must mirror drizzle/0013_foreign_keys_not_valid.sql exactly.
const RELATIONSHIPS = [
  { child: "creditTransactions", col: "userId", parent: "users", pk: "id", name: "fk_credit_transactions_user" },
  { child: "generations", col: "userId", parent: "users", pk: "id", name: "fk_generations_user" },
  { child: "audioGenerations", col: "userId", parent: "users", pk: "id", name: "fk_audio_generations_user" },
  { child: "userSubscriptions", col: "userId", parent: "users", pk: "id", name: "fk_user_subscriptions_user" },
  { child: "videoProjects", col: "userId", parent: "users", pk: "id", name: "fk_video_projects_user" },
  { child: "galleryItems", col: "generationId", parent: "generations", pk: "id", name: "fk_gallery_items_generation" },
];

console.log("Orphan audit — child rows whose parent is missing (must be 0 before VALIDATE):\n");
let total = 0;
// Identifiers come only from the RELATIONSHIPS constants above (never user
// input), so interpolating them into the query text is safe.
for (const r of RELATIONSHIPS) {
  const rows = await sql.unsafe(
    `SELECT count(*)::int AS orphans
     FROM "${r.child}" c
     LEFT JOIN "${r.parent}" p ON p."${r.pk}" = c."${r.col}"
     WHERE p."${r.pk}" IS NULL`
  );
  const n = rows[0]?.orphans ?? 0;
  total += n;
  console.log(`${n.toString().padStart(8)}  ${r.child}.${r.col} -> ${r.parent}.${r.pk}  (${r.name})`);
}
console.log(`\n${total === 0 ? "OK — no orphans; constraints can be validated." : `${total} orphan row(s) total — clean these up, then VALIDATE each constraint.`}`);

await sql.end();
process.exit(0);
