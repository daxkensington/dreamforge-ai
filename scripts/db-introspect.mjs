// Read-only database introspection for ops/reconciliation.
// Usage: node scripts/db-introspect.mjs <envFile>
// Loads DATABASE_URL from the given env file (never prints the URL or credentials).
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const envFile = process.argv[2];
if (!envFile) {
  console.error("usage: node scripts/db-introspect.mjs <envFile>");
  process.exit(1);
}
config({ path: envFile });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`DATABASE_URL is not set in ${envFile}`);
  process.exit(1);
}

let host = "unknown";
try {
  host = new URL(url).hostname;
} catch {
  console.error("DATABASE_URL is not a valid URL");
  process.exit(1);
}

const sql = neon(url);

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name`;
const tableNames = tables.map((t) => t.table_name);

const colCounts = await sql`
  SELECT table_name, COUNT(*)::int AS cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
  GROUP BY table_name
  ORDER BY table_name`;
const colMap = Object.fromEntries(colCounts.map((c) => [c.table_name, c.cols]));

const indexes = await sql`
  SELECT indexname FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY indexname`;
const indexNames = indexes.map((i) => i.indexname);

const userCols = await sql`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
  ORDER BY ordinal_position`;

// Lightweight content fingerprint (no secrets, no PII beyond public gallery data).
let galleryCount = 0;
let sampleTitles = [];
try {
  const g = await sql`SELECT COUNT(*)::int AS n FROM "galleryItems"`;
  galleryCount = g[0].n;
  const s = await sql`
    SELECT title FROM "galleryItems"
    WHERE title IS NOT NULL AND title <> ''
    ORDER BY id LIMIT 5`;
  sampleTitles = s.map((r) => r.title);
} catch {
  galleryCount = -1;
}

console.log(JSON.stringify({
  envFile,
  host,
  tableCount: tableNames.length,
  tables: tableNames,
  colCounts: colMap,
  indexCount: indexNames.length,
  indexes: indexNames,
  usersColumns: userCols.map((c) => c.column_name),
  galleryCount,
  sampleTitles,
}, null, 2));
