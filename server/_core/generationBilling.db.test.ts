import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// These production dependencies are unreachable in this fixture, even if a shell has DATABASE_URL.
vi.mock("../db", () => ({ getDb: vi.fn() }));
vi.mock("../stripe", () => ({ getOrCreateBalance: vi.fn() }));
import { createGenerationBillingStore, type GenerationRequestIdentity, type GenerationRequestOwner } from "./generationBilling";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) {
  const target = new URL(testUrl);
  if (target.hostname !== "127.0.0.1" || target.port !== "55439" || target.pathname !== "/dreamforge_billing_qa" || target.username !== "dreamforge_qa") {
    throw new Error("Billing database tests require the isolated loopback fixture on port 55439.");
  }
}
const databaseSuite = testUrl ? describe : describe.skip;
databaseSuite("generation billing on isolated PostgreSQL", () => {
  const db = postgres(testUrl ?? "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa", { max: 12, prepare: false, onnotice: () => {} });
  const dialect = new PgDialect();
  const initializeBalance = vi.fn(async (_userId: number) => {});
  const execute = async (query: SQL) => {
    const compiled = dialect.sqlToQuery(query);
    return db.unsafe(compiled.sql, compiled.params as any[]);
  };
  const store = createGenerationBillingStore({ execute, initializeBalance });
  const identity = (userId = 1, requestId = randomUUID(), payloadHash = "a".repeat(64)): GenerationRequestIdentity => ({ userId, requestId, payloadHash });
  async function own(input = identity(), credits = 15) {
    const result = await store.claimGenerationRequest({ ...input, credits });
    expect(result.kind).toBe("owned");
    if (result.kind !== "owned") throw new Error(`Expected owned claim, received ${result.kind}`);
    return result;
  }
  async function generation(owner: GenerationRequestOwner, userId = owner.userId) {
    const [row] = await db`INSERT INTO generations ("userId", status, metadata) VALUES (${userId}, 'generating', ${db.json({ billingRequestId: owner.requestId })}) RETURNING id`;
    return Number(row.id);
  }
  async function wallet(userId = 1) {
    const [row] = await db`SELECT balance, "lifetimeSpent" FROM "creditBalances" WHERE "userId" = ${userId}`;
    return { balance: Number(row.balance), spent: Number(row.lifetimeSpent) };
  }
  async function ledger(type: string, userId = 1) {
    const [row] = await db`SELECT count(*) AS n FROM "creditTransactions" WHERE "userId" = ${userId} AND "txType"::text = ${type}`;
    return Number(row.n);
  }
  async function old(owner: GenerationRequestOwner) {
    await db`UPDATE "generationRequests" SET "updatedAt" = now() - interval '30 minutes' WHERE id = ${owner.id}`;
  }

  beforeAll(async () => {
    // Only the dedicated empty fixture database is used. Existing tables are real PostgreSQL
    // constraints with the same column types consumed by the production statements.
    await db.unsafe(`
      CREATE TABLE users (id serial PRIMARY KEY, "loginMethod" text);
      CREATE TYPE "generationStatus" AS ENUM ('pending', 'generating', 'completed', 'failed');
      CREATE TYPE "txType" AS ENUM ('purchase', 'usage', 'bonus', 'refund', 'subscription', 'reward', 'referral', 'dispute');
      CREATE TABLE generations (id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id),
        status "generationStatus" DEFAULT 'pending' NOT NULL, "imageUrl" text, "thumbnailUrl" text, "errorMessage" text,
        metadata jsonb, "updatedAt" timestamp DEFAULT now() NOT NULL);
      CREATE TABLE "creditBalances" (id serial PRIMARY KEY, "userId" integer UNIQUE NOT NULL,
        balance integer DEFAULT 50 NOT NULL, "bonusCredits" integer DEFAULT 0 NOT NULL, "walletAccountingVersion" integer DEFAULT 1 NOT NULL,
        "lifetimeSpent" integer DEFAULT 0 NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL);
      CREATE TABLE "creditTransactions" (id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id),
        amount integer NOT NULL, "txType" "txType" NOT NULL, description varchar(512), "txMetadata" jsonb);
    `).simple();
    const migration = await readFile(new URL("../../drizzle/0014_generation_requests.sql", import.meta.url), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) await db.unsafe(statement).simple();
    await db.unsafe(`
      CREATE TABLE billing_test_fault (mode text);
      INSERT INTO billing_test_fault VALUES ('none');
      CREATE FUNCTION billing_test_ledger_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM billing_test_fault WHERE mode = NEW."txType"::text) THEN
          RAISE EXCEPTION 'Fixture ledger write rejected';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER billing_test_ledger_failure BEFORE INSERT ON "creditTransactions" FOR EACH ROW EXECUTE FUNCTION billing_test_ledger_fault();
      CREATE FUNCTION billing_test_generation_fault() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status = 'completed' AND EXISTS (SELECT 1 FROM billing_test_fault WHERE mode = 'complete') THEN
          RAISE EXCEPTION 'Fixture generation completion rejected';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER billing_test_generation_failure BEFORE UPDATE ON generations FOR EACH ROW EXECUTE FUNCTION billing_test_generation_fault();
    `).simple();
  }, 30_000);
  beforeEach(async () => {
    initializeBalance.mockClear();
    await db.unsafe('TRUNCATE "generationRequests", "creditTransactions", generations, "creditBalances", users RESTART IDENTITY CASCADE').simple();
    await db`UPDATE billing_test_fault SET mode = 'none'`;
    await db`INSERT INTO users (id) VALUES (1), (2)`;
    await db`INSERT INTO "creditBalances" ("userId", balance) VALUES (1, 75), (2, 75)`;
  });
  afterAll(async () => {
    await db.unsafe('DROP TABLE IF EXISTS "generationRequests", "creditTransactions", generations, "creditBalances", users, billing_test_fault CASCADE; DROP TYPE IF EXISTS "generationStatus", "txType" CASCADE; DROP FUNCTION IF EXISTS billing_test_ledger_fault(), billing_test_generation_fault() CASCADE').simple();
    await db.end();
  });

  it("allows only one concurrent claim and one provider-entry CAS", async () => {
    const input = identity();
    const claims = await Promise.all(Array.from({ length: 10 }, () => store.claimGenerationRequest({ ...input, credits: 15 })));
    const owned = claims.filter(claim => claim.kind === "owned");
    expect(owned).toHaveLength(1);
    expect(claims.filter(claim => claim.kind === "replay")).toHaveLength(9);
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await ledger("usage")).toBe(1);
    if (owned[0].kind !== "owned") throw new Error("Missing owner");
    const id = await generation(owned[0].owner);
    const entries = await Promise.all(Array.from({ length: 10 }, () => store.beginGenerationRequest(owned[0].owner, id)));
    expect(entries.filter(entry => entry.kind === "begun")).toHaveLength(1);
  });

  it("prevents overspending across different simultaneous requests", async () => {
    const claims = await Promise.all(Array.from({ length: 6 }, () => store.claimGenerationRequest({ ...identity(), credits: 50 })));
    expect(claims.filter(claim => claim.kind === "owned")).toHaveLength(1);
    expect(claims.filter(claim => claim.kind === "replay" && claim.request.state === "rejected")).toHaveLength(5);
    expect(await wallet()).toEqual({ balance: 25, spent: 50 });
    expect(await ledger("usage")).toBe(1);
  });

  it("binds one user UUID to its hash and isolates the same UUID in another user", async () => {
    const first = await own();
    expect((await store.claimGenerationRequest({ ...first.owner, payloadHash: "b".repeat(64), credits: 1 })).kind).toBe("conflict");
    const second = await store.claimGenerationRequest({ ...identity(2, first.owner.requestId), credits: 20 });
    expect(second.kind).toBe("owned");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await wallet(2)).toEqual({ balance: 55, spent: 20 });
    expect(await ledger("usage")).toBe(1);
  });

  it("retains a rejected outcome after top-up rather than retrying the generation", async () => {
    const input = identity();
    const rejected = await store.claimGenerationRequest({ ...input, credits: 100 });
    expect(rejected.kind).toBe("replay");
    if (rejected.kind !== "replay") throw new Error("Missing rejection");
    expect(rejected.request.state).toBe("rejected");
    expect(rejected.request.result).toMatchObject({ status: "failed", needed: 100, creditCost: 0 });
    await db`UPDATE "creditBalances" SET balance = 150 WHERE "userId" = 1`;
    const replay = await store.claimGenerationRequest({ ...input, credits: 100 });
    expect(replay).toEqual(rejected);
    expect(await wallet()).toEqual({ balance: 150, spent: 0 });
    expect(await ledger("usage")).toBe(0);
  });

  it("rolls back the wallet and unique claim when the debit ledger insert fails", async () => {
    await db`UPDATE billing_test_fault SET mode = 'usage'`;
    const input = identity();
    expect((await store.claimGenerationRequest({ ...input, credits: 15 })).kind).toBe("uncertain");
    expect(await store.readGenerationRequest(input)).toBeNull();
    expect(await wallet()).toEqual({ balance: 75, spent: 0 });
    expect(await ledger("usage")).toBe(0);
  });

  it("never grants execution when the successful claim acknowledgment is lost", async () => {
    let lose = true;
    const uncertainStore = createGenerationBillingStore({ initializeBalance, execute: async query => {
      const result = await execute(query);
      if (lose && dialect.sqlToQuery(query).sql.includes("generation-billing:claim")) { lose = false; throw new Error("Lost database acknowledgment"); }
      return result;
    } });
    const input = identity();
    const result = await uncertainStore.claimGenerationRequest({ ...input, credits: 15 });
    expect(result.kind).toBe("replay");
    expect((await store.claimGenerationRequest({ ...input, credits: 15 })).kind).toBe("replay");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await ledger("usage")).toBe(1);
  });

  it("verifies generation owner and request marker before provider entry", async () => {
    const claim = await own();
    const foreign = await generation(claim.owner, 2);
    expect((await store.beginGenerationRequest(claim.owner, foreign)).kind).toBe("replay");
    const [wrong] = await db`INSERT INTO generations ("userId", status, metadata) VALUES (1, 'generating', ${db.json({ billingRequestId: randomUUID() })}) RETURNING id`;
    expect((await store.beginGenerationRequest(claim.owner, Number(wrong.id))).kind).toBe("replay");
    expect((await store.readGenerationRequest(claim.owner))?.state).toBe("reserved");
  });

  it("does not authorize another entry after a lost begin acknowledgment", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    let lose = true;
    const uncertainStore = createGenerationBillingStore({ initializeBalance, execute: async query => {
      const result = await execute(query);
      if (lose && dialect.sqlToQuery(query).sql.includes("generation-billing:begin")) { lose = false; throw new Error("Lost database acknowledgment"); }
      return result;
    } });
    const result = await uncertainStore.beginGenerationRequest(claim.owner, id);
    expect(result.kind).toBe("replay");
    expect((await store.beginGenerationRequest(claim.owner, id)).kind).toBe("replay");
    expect((await store.readGenerationRequest(claim.owner))?.state).toBe("rendering");
  });

  it("atomically persists output and exact completed replay, never permitting a refund afterward", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    const result = { id, requestId: claim.owner.requestId, status: "completed", imageUrl: "https://cdn.example/image.png", mediaType: "image", creditCost: 15, newAchievements: [] };
    const complete = await store.completeGenerationRequest(claim.owner, { result, imageUrl: result.imageUrl, metadata: { billingRequestId: claim.owner.requestId, actualModel: "test-model" } });
    expect(complete.kind).toBe("completed");
    if (complete.kind !== "completed") throw new Error("Completion failed");
    expect(complete.request.result).toEqual(result);
    const [row] = await db`SELECT status, "imageUrl", metadata FROM generations WHERE id = ${id}`;
    expect(row).toMatchObject({ status: "completed", imageUrl: result.imageUrl, metadata: { actualModel: "test-model" } });
    const replay = await store.claimGenerationRequest({ ...claim.owner, credits: 200 });
    expect(replay.kind).toBe("replay");
    if (replay.kind !== "replay") throw new Error("Missing replay");
    expect(replay.request.result).toEqual(result);
    expect(JSON.stringify(replay)).not.toContain(claim.owner.executionToken);
    expect((await store.failGenerationRequestAndRefund(claim.owner, { confirmedFailure: true, errorCode: "late_error", errorMessage: "Do not refund" })).kind).toBe("replay");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await ledger("refund")).toBe(0);
  });

  it("rolls back request completion when generation persistence fails", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    await db`UPDATE billing_test_fault SET mode = 'complete'`;
    const complete = await store.completeGenerationRequest(claim.owner, { imageUrl: "https://cdn.example/image.png", result: { id, status: "completed" } });
    expect(complete.kind).toBe("replay");
    expect((await store.readGenerationRequest(claim.owner))?.state).toBe("rendering");
    const [row] = await db`SELECT status, "imageUrl" FROM generations WHERE id = ${id}`;
    expect(row).toEqual({ status: "generating", imageUrl: null });
  });

  it("cannot resurrect an output after the generation metadata is scrubbed", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    await db`UPDATE generations SET metadata = '{"deleted":true}'::jsonb WHERE id = ${id}`;
    expect((await store.completeGenerationRequest(claim.owner, { imageUrl: "https://cdn.example/late.png", result: { id, status: "completed" } })).kind).toBe("replay");
    const [row] = await db`SELECT "imageUrl", metadata FROM generations WHERE id = ${id}`;
    expect(row).toEqual({ imageUrl: null, metadata: { deleted: true } });
    expect((await store.readGenerationRequest(claim.owner))?.result).toBeNull();
  });

  it("keeps account deletion blocking late completion and refunds before metadata scrub", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    await store.markGenerationReconciliation(claim.owner, { errorCode: "account-deleted" });
    await store.markGenerationReconciliation(claim.owner, { errorCode: "late_provider_error" });
    expect((await store.readGenerationRequest(claim.owner))?.errorCode).toBe("account-deleted");
    expect((await store.completeGenerationRequest(claim.owner, { imageUrl: "https://cdn.example/late.png", result: { id, status: "completed" } })).kind).toBe("replay");
    expect((await store.failGenerationRequestAndRefund(claim.owner, { confirmedFailure: true, errorCode: "setup_failed", errorMessage: "Late original caller" })).kind).toBe("replay");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await ledger("refund")).toBe(0);
    const [row] = await db`SELECT "imageUrl" FROM generations WHERE id = ${id}`;
    expect(row.imageUrl).toBeNull();
  });

  it("recovers an immutable completed result after commit acknowledgment loss", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    let lose = true;
    const uncertainStore = createGenerationBillingStore({ initializeBalance, execute: async query => {
      const result = await execute(query);
      if (lose && dialect.sqlToQuery(query).sql.includes("generation-billing:complete")) { lose = false; throw new Error("Lost database acknowledgment"); }
      return result;
    } });
    const result = { id, status: "completed", imageUrl: "https://cdn.example/image.png", requestId: claim.owner.requestId };
    const outcome = await uncertainStore.completeGenerationRequest(claim.owner, { imageUrl: result.imageUrl, result });
    expect(outcome.kind).toBe("completed");
    if (outcome.kind !== "completed") throw new Error("Missing completion");
    expect(outcome.request.result).toEqual(result);
    expect(await ledger("usage")).toBe(1);
  });

  it("settles a confirmed failure exactly once under concurrent refund retries", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    const input = { confirmedFailure: true as const, errorCode: "confirmed_failure", errorMessage: "Provider confirmed failure" };
    const failures = await Promise.all(Array.from({ length: 10 }, () => store.failGenerationRequestAndRefund(claim.owner, input)));
    expect(failures.every(result => result.kind === "refunded")).toBe(true);
    expect(await wallet()).toEqual({ balance: 75, spent: 0 });
    expect(await ledger("refund")).toBe(1);
    const [row] = await db`SELECT status FROM generations WHERE id = ${id}`;
    expect(row.status).toBe("failed");
    const replay = await store.claimGenerationRequest({ ...claim.owner, credits: 15 });
    expect(replay.kind).toBe("replay");
    if (replay.kind !== "replay") throw new Error("Missing failure replay");
    expect(replay.request.result).toMatchObject({ id, status: "failed", refundedCredits: 15 });
  });

  it("rolls back a refund and generation failure when the refund ledger write fails", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await store.beginGenerationRequest(claim.owner, id);
    await db`UPDATE billing_test_fault SET mode = 'refund'`;
    const input = { confirmedFailure: true as const, errorCode: "confirmed_failure", errorMessage: "Provider confirmed failure" };
    expect((await store.failGenerationRequestAndRefund(claim.owner, input)).kind).toBe("replay");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect((await store.readGenerationRequest(claim.owner))?.state).toBe("rendering");
    const [row] = await db`SELECT status FROM generations WHERE id = ${id}`;
    expect(row.status).toBe("generating");
    expect(await ledger("refund")).toBe(0);
    await db`UPDATE billing_test_fault SET mode = 'none'`;
    expect((await store.failGenerationRequestAndRefund(claim.owner, input)).kind).toBe("refunded");
    expect(await wallet()).toEqual({ balance: 75, spent: 0 });
    expect(await ledger("refund")).toBe(1);
  });

  it("resolves exactly one unacknowledged orphan by user and billing UUID without touching another user", async () => {
    const claim = await own();
    const ownId = await generation(claim.owner);
    const foreignId = await generation(claim.owner, 2);
    const outcome = await store.failGenerationRequestAndRefund(claim.owner, { confirmedFailure: true, errorCode: "setup_failed", errorMessage: "Rendering never began" });
    expect(outcome.kind).toBe("refunded");
    expect((await store.readGenerationRequest(claim.owner))?.generationId).toBe(ownId);
    const state = await db`SELECT id, status FROM generations ORDER BY id`;
    expect(state).toEqual([{ id: ownId, status: "failed" }, { id: foreignId, status: "generating" }]);
  });

  it("holds ambiguous orphan links for review without refunds or generation changes", async () => {
    const claim = await own();
    await generation(claim.owner);
    await generation(claim.owner);
    const outcome = await store.failGenerationRequestAndRefund(claim.owner, { confirmedFailure: true, errorCode: "setup_failed", errorMessage: "Unknown insert outcome" });
    expect(outcome.kind).toBe("replay");
    expect((await store.readGenerationRequest(claim.owner))?.state).toBe("reconciliation");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await ledger("refund")).toBe(0);
    const state = await db`SELECT status FROM generations`;
    expect(state.every(row => row.status === "generating")).toBe(true);
  });

  it("sweeps old reservations once but only marks begun renders for reconciliation", async () => {
    const reserved = await own();
    const orphanId = await generation(reserved.owner);
    const rendering = await own(identity(), 20);
    const renderId = await generation(rendering.owner);
    await store.beginGenerationRequest(rendering.owner, renderId);
    await old(reserved.owner); await old(rendering.owner);
    const sweep = await store.sweepStaleGenerationRequests({ olderThanMinutes: 15, limit: 200 });
    expect(sweep).toEqual({ kind: "swept", refunded: 1, reconciliation: 1 });
    expect(await wallet()).toEqual({ balance: 55, spent: 20 });
    expect(await ledger("refund")).toBe(1);
    const statuses = await db`SELECT id, status FROM generations ORDER BY id`;
    expect(statuses).toEqual([{ id: orphanId, status: "failed" }, { id: renderId, status: "generating" }]);
    expect(await store.sweepStaleGenerationRequests({ olderThanMinutes: 15, limit: 200 })).toEqual({ kind: "swept", refunded: 0, reconciliation: 0 });
    const result = { id: renderId, status: "completed", imageUrl: "https://cdn.example/late.png" };
    expect((await store.completeGenerationRequest(rendering.owner, { imageUrl: result.imageUrl, result })).kind).toBe("completed");
  });

  it("prevents the sweeper and provider-entry CAS from both winning", async () => {
    const claim = await own();
    const id = await generation(claim.owner);
    await old(claim.owner);
    const [begin, sweep] = await Promise.all([store.beginGenerationRequest(claim.owner, id), store.sweepStaleGenerationRequests({ olderThanMinutes: 15, limit: 200 })]);
    const current = await store.readGenerationRequest(claim.owner);
    if (begin.kind === "begun") {
      expect(current?.state).toBe("rendering");
      expect(await ledger("refund")).toBe(0);
    } else {
      expect(current?.state).toBe("refunded");
      expect(await ledger("refund")).toBe(1);
    }
    expect(sweep.kind).toBe("swept");
  });

  it("leaves stale claim financial state unchanged if batch refund ledger insertion fails", async () => {
    const claim = await own();
    await old(claim.owner);
    await db`UPDATE billing_test_fault SET mode = 'refund'`;
    expect(await store.sweepStaleGenerationRequests({ olderThanMinutes: 15, limit: 200 })).toEqual({ kind: "uncertain" });
    expect((await store.readGenerationRequest(claim.owner))?.state).toBe("reserved");
    expect(await wallet()).toEqual({ balance: 60, spent: 15 });
    expect(await ledger("refund")).toBe(0);
  });

  it("validates identities and positive quotes before any initialization or write", async () => {
    await expect(store.claimGenerationRequest({ ...identity(), credits: -1 })).rejects.toThrow("quote");
    await expect(store.claimGenerationRequest({ ...identity(), requestId: "not-a-uuid", credits: 5 })).rejects.toThrow("identity");
    expect(initializeBalance).not.toHaveBeenCalled();
    expect(await wallet()).toEqual({ balance: 75, spent: 0 });
  });
});
