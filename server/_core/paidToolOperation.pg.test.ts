import postgres from "postgres";
import { drizzle } from "drizzle-orm/neon-http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: null as any, balance: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../db", () => ({ getDb: async () => mocks.db }));
vi.mock("../stripe", () => ({ getOrCreateBalance: mocks.balance }));
import { getPaidToolOperation, KnownPaidToolFailure, runPaidToolOperation } from "./paidToolOperation";
const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) { const url = new URL(testUrl); if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/dreamforge_billing_qa" || url.username !== "dreamforge_qa") throw new Error("Paid-tool tests require the owned local fixture"); }
const suite = testUrl ? describe : describe.skip;
suite("paid draft operation PostgreSQL settlement and replay", () => {
  const pg = postgres(testUrl ?? "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa", { max: 16, prepare: false, onnotice: () => {}, connection: { search_path: "paid_tools_qa" }, types: { neonJson: { to: 3802, from: [114, 3802], serialize: value => typeof value === "string" ? value : JSON.stringify(value), parse: JSON.parse } } });
  function query(text: string, params: any[] = [], options: any = {}) {
    return { then: (resolve: any, reject: any) => pg.unsafe(text, params).then(rows => { const columns = rows.columns.map((column: any) => ({ name: column.name, dataTypeID: column.type })); return { rows: options.arrayMode ? rows.map(row => columns.map(c => row[c.name])) : [...rows], fields: columns, rowCount: rows.count }; }).then(resolve, reject) };
  }
  const input = { userId: 1, kind: "presentation", requestId: "71516365-2ec0-42ee-a182-36302b0b2822", credits: 80, description: "Presentation draft", payload: { topic: "Fixture", slides: 3 } };
  beforeAll(async () => {
    await pg.unsafe("CREATE SCHEMA paid_tools_qa");
    await pg.unsafe(`CREATE TABLE users (id integer PRIMARY KEY,"loginMethod" text);
      CREATE TABLE "creditBalances" (id serial PRIMARY KEY,"userId" integer UNIQUE,balance integer NOT NULL,"bonusCredits" integer NOT NULL,"walletAccountingVersion" integer NOT NULL,"lifetimeSpent" integer NOT NULL DEFAULT 0,"updatedAt" timestamp DEFAULT now());
      CREATE TABLE "generationBatchRequests" (id serial PRIMARY KEY,"userId" integer NOT NULL,"requestId" text NOT NULL,"payloadHash" text NOT NULL,"executionToken" uuid NOT NULL,"quotedCredits" integer NOT NULL,"purchasedCreditsDebited" integer NOT NULL DEFAULT 0,state text NOT NULL,result jsonb,"errorCode" text,"updatedAt" timestamp DEFAULT now(),UNIQUE("userId","requestId"));
      CREATE TABLE "creditTransactions" (id serial PRIMARY KEY,"userId" integer NOT NULL,amount integer NOT NULL,"txType" text,description text,"txMetadata" jsonb);`).simple();
    Object.assign(query, { query }); mocks.db = drizzle(query as any);
  });
  beforeEach(async () => { await pg.unsafe('TRUNCATE users,"creditBalances","generationBatchRequests","creditTransactions" RESTART IDENTITY'); await pg`INSERT INTO users VALUES (1,'google'),(2,'google')`; await pg`INSERT INTO "creditBalances" ("userId",balance,"bonusCredits","walletAccountingVersion") VALUES (1,100,40,1)`; });
  afterAll(async () => { await pg.unsafe("DROP SCHEMA paid_tools_qa CASCADE"); await pg.end(); });
  it("executes and debits exactly once across concurrent retries, preserving purchased-credit attribution", async () => {
    const execute = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 40)); return { slides: [{ title: "Real fixture output" }] }; });
    const results = await Promise.all(Array.from({ length: 12 }, () => runPaidToolOperation(input, execute)));
    expect(execute).toHaveBeenCalledOnce(); expect(results.some(result => result.status === "completed")).toBe(true);
    expect(await getPaidToolOperation(1, input.kind, input.requestId)).toMatchObject({ status: "completed", creditCost: 80, result: { slides: [{ title: "Real fixture output" }] } });
    const [wallet] = await pg`SELECT * FROM "creditBalances" WHERE "userId"=1`; expect(wallet).toMatchObject({ balance: 20, bonusCredits: 20, lifetimeSpent: 80 });
    const transactions = await pg`SELECT * FROM "creditTransactions"`; expect(transactions).toHaveLength(1); expect(transactions[0]).toMatchObject({ amount: -80, txMetadata: { purchasedCreditsDebited: 20 } });
    expect(await runPaidToolOperation({ ...input, payload: { slides: 3, topic: "Fixture" } }, execute)).toMatchObject({ status: "completed" }); expect(execute).toHaveBeenCalledOnce();
    await expect(runPaidToolOperation({ ...input, payload: { topic: "Changed" } }, execute)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("refunds confirmed failure once, restoring the exact purchased portion and durable receipt", async () => {
    const execute = vi.fn(async () => { throw new KnownPaidToolFailure("Provider rejected this fixture request"); });
    expect(await runPaidToolOperation(input, execute)).toMatchObject({ status: "failed", refundedCredits: 80 });
    await Promise.all(Array.from({ length: 8 }, () => getPaidToolOperation(1, input.kind, input.requestId)));
    expect(await runPaidToolOperation(input, execute)).toMatchObject({ status: "failed", refundedCredits: 80 }); expect(execute).toHaveBeenCalledOnce();
    expect((await pg`SELECT * FROM "creditBalances"`)[0]).toMatchObject({ balance: 100, bonusCredits: 40, lifetimeSpent: 0 });
    expect((await pg`SELECT amount FROM "creditTransactions" ORDER BY id`).map(row => row.amount)).toEqual([-80,80]);
  });
  it("retains ambiguous transport outcomes for reconciliation without refund or second provider invocation", async () => {
    const execute = vi.fn(async () => { throw new Error("Fixture transport timed out after submission"); });
    expect(await runPaidToolOperation(input, execute)).toMatchObject({ status: "pending", reconciliationRequired: true });
    expect(await runPaidToolOperation(input, execute)).toMatchObject({ status: "pending", reconciliationRequired: true }); expect(execute).toHaveBeenCalledOnce();
    expect((await pg`SELECT balance FROM "creditBalances"`)[0].balance).toBe(20); expect(await pg`SELECT * FROM "creditTransactions"`).toHaveLength(1);
  });
  it("does not invoke the provider without credits or expose another user's result", async () => {
    const execute = vi.fn(async () => "must not run");
    expect(await runPaidToolOperation({ ...input, credits: 101 }, execute)).toMatchObject({ status: "failed", refundedCredits: 0 }); expect(execute).not.toHaveBeenCalled();
    expect(await getPaidToolOperation(2, input.kind, input.requestId)).toBeNull();
    await pg`UPDATE users SET "loginMethod"='deleted' WHERE id=1`; expect(await getPaidToolOperation(1, input.kind, input.requestId)).toBeNull();
  });
  it("recovers a known failure whose refund acknowledgment was lost without issuing a second refund", async () => {
    await runPaidToolOperation(input, async () => "settled");
    // Owned fixture models a durable known outcome left by a failed refund
    // acknowledgment; status polling is the production recovery path.
    await pg`UPDATE "generationBatchRequests" SET state='submitting',"errorCode"='confirmed-tool-failure',result='{"status":"failed","error":"Known rejection"}'::jsonb`;
    const results = await Promise.all(Array.from({ length: 10 }, () => getPaidToolOperation(1, input.kind, input.requestId)));
    expect(results.every(result => result?.status === "failed")).toBe(true);
    expect((await pg`SELECT * FROM "creditBalances"`)[0]).toMatchObject({ balance: 100, bonusCredits: 40, lifetimeSpent: 0 });
    expect(await pg`SELECT * FROM "creditTransactions" WHERE "txType"='refund'`).toHaveLength(1);
  });
});
