import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
const fixture = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (fixture) { const url = new URL(fixture); if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/dreamforge_billing_qa" || url.username !== "dreamforge_qa") throw new Error("Migration rehearsal requires the owned local PostgreSQL fixture"); }
(fixture ? describe : describe.skip)("actual journal 0000–0018 incremental PostgreSQL migration rehearsal", () => {
  it("upgrades a database already at17 to18 using the real Drizzle migration runner", async () => {
    const admin = postgres(fixture!, { max: 1, onnotice: () => {} });
    const databaseName = `dreamforge_tools_migration_security_qa_${process.pid}`;
    const target = new URL(fixture!); target.pathname = `/${databaseName}`;
    let created = false, pg: ReturnType<typeof postgres> | undefined, directory: string | undefined;
    try {
      await admin.unsafe(`CREATE DATABASE "${databaseName}"`); created = true;
      pg = postgres(target.toString(), { max: 1, onnotice: () => {} });
      const root = new URL("../drizzle/", import.meta.url), journal = JSON.parse(await readFile(new URL("meta/_journal.json", root), "utf8"));
      const timestamps = journal.entries.map((entry: any) => entry.when);
      expect(timestamps.every((value: number, index: number) => index === 0 || value > timestamps[index - 1])).toBe(true);
      directory = await mkdtemp(join(tmpdir(), "dreamforge-tools-migration-")); await mkdir(join(directory, "meta"));
      const through17 = { ...journal, entries: journal.entries.filter((entry: any) => entry.idx <= 17) };
      await writeFile(join(directory, "meta", "_journal.json"), JSON.stringify(through17));
      for (const entry of through17.entries) await copyFile(new URL(`${entry.tag}.sql`, root), join(directory, `${entry.tag}.sql`));
      const db = drizzle(pg); await migrate(db, { migrationsFolder: directory });
      expect((await pg`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`)[0].count).toBe(18);
      await migrate(db, { migrationsFolder: fileURLToPath(root) });
      expect((await pg`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`)[0].count).toBe(19);
      await migrate(db, { migrationsFolder: fileURLToPath(root) });
      expect((await pg`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`)[0].count).toBe(19);
      expect((await pg`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='videoProjectType'`).some(row => row.enumlabel === "timeline")).toBe(true);
      await pg`INSERT INTO users(id,"openId","loginMethod") VALUES (1001,'fixture-migration-owner','google'),(1002,'fixture-migration-deleted','deleted')`;
      await pg`INSERT INTO "videoProjects"("userId",type,title,data) VALUES (1001,'timeline','Real migrated timeline','{"timeline":{"revision":1,"document":{"schemaVersion":1,"tracks":[],"clips":[]}}}'::jsonb)`;
      await expect(pg`INSERT INTO "mediaUploads"(id,"userId",key,"fileName","contentType",size,purpose,"partCount","expiresAt") VALUES ('00000000-0000-4000-8000-000000000001',1002,'uploads/1002/deleted.png','deleted.png','image/png',1,'timeline',1,now()+interval '1 hour')`).rejects.toMatchObject({ code: "23514" });
      await expect(pg`INSERT INTO "mediaUploads"(id,"userId",key,"fileName","contentType",size,purpose,"partCount","expiresAt") VALUES ('00000000-0000-4000-8000-000000000002',1001,'uploads/1001/too-large.mp4','large.mp4','video/mp4',26214401,'timeline',9,now()+interval '1 hour')`).rejects.toMatchObject({ code: "23514" });
      expect((await pg`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='mediaAssets'`).some(row => row.column_name === "isPrivate")).toBe(true);
      expect((await pg`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='trainingJobs'`).some(row => row.column_name === "purchasedCreditsDebited")).toBe(true);
    } finally {
      await pg?.end(); if (created) await admin.unsafe(`DROP DATABASE "${databaseName}"`); await admin.end();
      if (directory) {
        const path = resolve(directory);
        if (dirname(path) !== resolve(tmpdir()) || !basename(path).startsWith("dreamforge-tools-migration-")) throw new Error("Unexpected migration temporary directory");
        await rm(path, { recursive: true, force: true });
      }
    }
  }, 60000);
});
