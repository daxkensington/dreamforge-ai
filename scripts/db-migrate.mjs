// Applies drizzle migrations to the database from the given env file.
// Wraps drizzle-kit (which supports multi-statement migrations; the neon-http
// driver does not). All repo migrations use IF NOT EXISTS, so re-running is safe.
// Usage: node scripts/db-migrate.mjs <envFile>
import { config } from "dotenv";
import { execSync } from "node:child_process";

const envFile = process.argv[2];
if (!envFile) {
  console.error("usage: node scripts/db-migrate.mjs <envFile>");
  process.exit(1);
}
const loaded = config({ path: envFile });
if (!process.env.DATABASE_URL) {
  console.error(`DATABASE_URL is not set in ${envFile}`);
  process.exit(1);
}
console.log(`loaded env from ${envFile} — running drizzle-kit migrate...`);
execSync("npx drizzle-kit migrate", { stdio: "inherit", env: process.env });
console.log("MIGRATE_OK");
