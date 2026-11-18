import postgres from "postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { acceptProjectShareTokenWithDb } from "./db";

const url = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (url) {
  const t = new URL(url);
  if (t.hostname !== "127.0.0.1" || t.port !== "55439" || t.pathname !== "/dreamforge_billing_qa" || t.username !== "dreamforge_qa") throw new Error("Owned loopback fixture required.");
}
const suite = url ? describe : describe.skip;
suite("share token claims on isolated PostgreSQL", () => {
  const admin = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
  const pg = postgres(url!, { max: 20, prepare: false, connection: { options: "-c search_path=share_token_qa" }, onnotice: () => {} });
  const dialect = new PgDialect();
  const db = {
    execute: (statement: any) => statement,
    batch: (statements: any[]) => pg.begin(async (tx) => {
      const results = [];
      for (const statement of statements) {
        const q = dialect.sqlToQuery(statement);
        results.push(await tx.unsafe(q.sql, q.params as any[]));
      }
      return results;
    }),
  } as any;
  beforeAll(async () => {
    await admin.unsafe(`CREATE SCHEMA share_token_qa;
      CREATE TYPE share_token_qa."collabRole" AS ENUM ('viewer', 'editor');
      CREATE TYPE share_token_qa."sharePermission" AS ENUM ('viewer', 'editor');
      CREATE TABLE share_token_qa."projectShareTokens" (id serial PRIMARY KEY, "projectId" int NOT NULL, token text UNIQUE NOT NULL, "sharePermission" share_token_qa."sharePermission" NOT NULL, "createdBy" int NOT NULL, "expiresAt" timestamp, "maxUses" int, "useCount" int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true);
      CREATE TABLE share_token_qa."projectCollaborators" (id serial PRIMARY KEY, "projectId" int NOT NULL, "userId" int NOT NULL, "collabRole" share_token_qa."collabRole" NOT NULL, "invitedBy" int NOT NULL);`).simple();
  });
  beforeEach(async () => { await pg.unsafe('TRUNCATE "projectShareTokens", "projectCollaborators" RESTART IDENTITY'); });
  afterAll(async () => { await pg.end(); await admin.unsafe("DROP SCHEMA IF EXISTS share_token_qa CASCADE"); await admin.end(); });

  it("admits only one of many concurrent claims of a single-use link", async () => {
    await pg`INSERT INTO "projectShareTokens" ("projectId", token, "sharePermission", "createdBy", "maxUses") VALUES (10, 'one', 'editor', 1, 1)`;
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => acceptProjectShareTokenWithDb(db, "one", i + 2)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await pg`SELECT "useCount" FROM "projectShareTokens"`)[0].useCount).toBe(1);
    const members = await pg`SELECT "collabRole" FROM "projectCollaborators"`;
    expect(members).toHaveLength(1);
    expect(members[0].collabRole).toBe("editor");
  });
  it("rejects revoked, expired and exhausted links without membership changes", async () => {
    await pg`INSERT INTO "projectShareTokens" ("projectId", token, "sharePermission", "createdBy", active, "expiresAt", "maxUses", "useCount") VALUES (10, 'revoked', 'viewer', 1, false, null, null, 0), (10, 'expired', 'viewer', 1, true, now() - interval '1 second', null, 0), (10, 'used', 'viewer', 1, true, null, 1, 1)`;
    for (const token of ["revoked", "expired", "used"]) expect(await acceptProjectShareTokenWithDb(db, token, 5)).toBeUndefined();
    expect(await pg`SELECT * FROM "projectCollaborators"`).toHaveLength(0);
  });
  it("serializes different tokens for one member and never downgrades an editor", async () => {
    await pg`INSERT INTO "projectShareTokens" ("projectId", token, "sharePermission", "createdBy", "maxUses") VALUES (10, 'view', 'viewer', 1, 1), (10, 'edit', 'editor', 1, 1)`;
    const results = await Promise.all([acceptProjectShareTokenWithDb(db, "view", 5), acceptProjectShareTokenWithDb(db, "edit", 5)]);
    expect(results.filter(Boolean)).toHaveLength(2);
    const members = await pg`SELECT "collabRole" FROM "projectCollaborators" WHERE "projectId"=10 AND "userId"=5`;
    expect(members).toHaveLength(1);
    expect(members[0].collabRole).toBe("editor");
  });
  it("updates an existing collaborator and rolls back a claim if membership insertion fails", async () => {
    await pg`INSERT INTO "projectShareTokens" ("projectId", token, "sharePermission", "createdBy", "maxUses") VALUES (10, 'change', 'editor', 1, 1), (20, 'failure', 'viewer', 1, 1)`;
    await pg`INSERT INTO "projectCollaborators" ("projectId", "userId", "collabRole", "invitedBy") VALUES (10, 5, 'viewer', 1)`;
    expect(await acceptProjectShareTokenWithDb(db, "change", 5)).toMatchObject({ action: "updated", permission: "editor" });
    expect((await pg`SELECT "collabRole" FROM "projectCollaborators" WHERE "userId"=5`)[0].collabRole).toBe("editor");
    await pg.unsafe('ALTER TABLE "projectCollaborators" ADD CONSTRAINT fixture_fail CHECK ("projectId" <> 20)');
    await expect(acceptProjectShareTokenWithDb(db, "failure", 6)).rejects.toThrow();
    expect((await pg`SELECT "useCount" FROM "projectShareTokens" WHERE token = 'failure'`)[0].useCount).toBe(0);
    await pg.unsafe('ALTER TABLE "projectCollaborators" DROP CONSTRAINT fixture_fail');
  });
});
