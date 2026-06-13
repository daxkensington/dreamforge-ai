import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const env = JSON.parse(readFileSync(join(process.env.TEMP, "dfx-keys2.json"), "utf8"));
const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 1 });
const ddl = readFileSync(join(process.cwd(), "drizzle", "0007_uncensored_tier.sql"), "utf8");

// Execute each statement separately (postgres.js .unsafe runs one at a time well
// enough for idempotent IF NOT EXISTS DDL).
for (const stmt of ddl.split(";").map((s) => s.trim()).filter(Boolean)) {
  await sql.unsafe(stmt);
  console.log("OK:", stmt.split("\n")[0].slice(0, 70));
}

// Verify
const cols = await sql`select column_name from information_schema.columns where table_name = 'users' and column_name in ('uncensoredUntil','ageConfirmedAt')`;
const tbl = await sql`select to_regclass('public."cryptoInvoices"') as exists`;
console.log("\nusers columns added:", cols.map((c) => c.column_name).join(", "));
console.log("cryptoInvoices table:", tbl[0].exists);

await sql.end();
