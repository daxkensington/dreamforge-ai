import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";

const mockedDb = vi.hoisted(() => ({ execute: vi.fn(), batch: vi.fn() }));
vi.mock("../db", () => ({ getDb: async () => mockedDb }));
import { allocatePaidSubscriptionInvoice, hasPaidSubscriptionInvoiceAllocation, type PaidSubscriptionInvoiceMapping } from "./subscriptionBilling";
import { currentSubscriptionOrder } from "./subscriptionSelection";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) {
  const target = new URL(testUrl);
  if (target.hostname !== "127.0.0.1" || target.port !== "55439" || target.pathname !== "/dreamforge_billing_qa" || target.username !== "dreamforge_qa") throw new Error("Subscription SQL tests require the owned loopback fixture.");
}
const suite = testUrl ? describe : describe.skip;
suite("paid invoice allocation and subscription history on PostgreSQL", () => {
  const url = testUrl ?? "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa";
  const admin = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  const db = postgres(url, { max: 12, prepare: false, connection: { application_name: "dreamforge_invoice_qa", options: "-c search_path=subscription_invoice_qa" }, onnotice: () => {} });
  const dialect = new PgDialect();
  const execute = async (query: SQL) => { const compiled = dialect.sqlToQuery(query); return db.unsafe(compiled.sql, compiled.params as any[]); };
  const deferred = (query: SQL) => ({ fixtureQuery: query, then: (resolve: any, reject: any) => execute(query).then(resolve, reject) });
  const executeBatch = async (queries: { fixtureQuery: SQL }[]) => db.begin(async tx => {
    const result: unknown[] = [];
    for (const query of queries) {
      const compiled = dialect.sqlToQuery(query.fixtureQuery);
      result.push(await tx.unsafe(compiled.sql, compiled.params as any[]));
    }
    return result;
  });
  const start = new Date(Math.floor(Date.now() / 1000) * 1000 - 60_000);
  const end = new Date(start.getTime() + 86_400_000);
  const mapping: PaidSubscriptionInvoiceMapping = { invoiceId: "in_qa", subscriptionId: "sub_qa", subscriptionItemId: "si_qa", priceId: "price_qa", periodStart: start, periodEnd: end };
  async function financialState() {
    const [wallet] = await db`SELECT balance, "bonusCredits", "monthlyAllocation" FROM "creditBalances" WHERE "userId" = 1`;
    const [ledger] = await db`SELECT count(*) AS n FROM "creditTransactions"`;
    const [receipts] = await db`SELECT count(*) AS n FROM "webhookEvents"`;
    return { wallet, ledger: Number(ledger.n), receipts: Number(receipts.n) };
  }
  async function ordered() {
    return execute(sql`SELECT "userSubscriptions".id, "userSubscriptions"."stripeSubscriptionId" FROM "userSubscriptions" WHERE "userSubscriptions"."userId" = 1 ORDER BY ${sql.join(currentSubscriptionOrder(), sql`, `)}`);
  }

  beforeAll(async () => {
    await admin.unsafe("CREATE SCHEMA subscription_invoice_qa").simple();
    await db.unsafe(`
      CREATE TYPE "subStatus" AS ENUM ('active', 'canceled', 'past_due', 'trialing', 'incomplete');
      CREATE TYPE "txType" AS ENUM ('purchase', 'usage', 'bonus', 'refund', 'subscription', 'reward', 'referral', 'dispute');
      CREATE TYPE "webhookStatus" AS ENUM ('pending', 'processed', 'failed', 'ignored');
      CREATE TABLE users (id serial PRIMARY KEY);
      CREATE TABLE "subscriptionPlans" (id serial PRIMARY KEY, name varchar(64) UNIQUE NOT NULL, "monthlyCredits" integer NOT NULL);
      CREATE TABLE "userSubscriptions" (id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), "planId" integer NOT NULL,
        "stripeSubscriptionId" varchar(128) UNIQUE, "subStatus" "subStatus" NOT NULL DEFAULT 'active',
        "currentPeriodStart" timestamp, "currentPeriodEnd" timestamp, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now());
      CREATE TABLE "creditBalances" (id serial PRIMARY KEY, "userId" integer UNIQUE NOT NULL, balance integer NOT NULL,
        "bonusCredits" integer NOT NULL DEFAULT 0, "monthlyAllocation" integer NOT NULL DEFAULT 0, "lastResetAt" timestamp);
      CREATE TABLE "creditTransactions" (id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), amount integer NOT NULL,
        "txType" "txType" NOT NULL, description varchar(512), "txMetadata" jsonb);
      CREATE TABLE "webhookEvents" (id serial PRIMARY KEY, "eventId" varchar(256) UNIQUE NOT NULL, "eventType" varchar(128) NOT NULL,
        "webhookStatus" "webhookStatus" NOT NULL DEFAULT 'processed', summary text);
      CREATE TABLE invoice_test_fault (mode text);
      INSERT INTO invoice_test_fault VALUES ('none');
      CREATE FUNCTION invoice_test_ledger_fault() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF EXISTS (SELECT 1 FROM invoice_test_fault WHERE mode = 'ledger') THEN RAISE EXCEPTION 'Fixture ledger rejected'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER invoice_test_ledger_failure BEFORE INSERT ON "creditTransactions" FOR EACH ROW EXECUTE FUNCTION invoice_test_ledger_fault();
      CREATE FUNCTION invoice_test_receipt_fault() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF EXISTS (SELECT 1 FROM invoice_test_fault WHERE mode = 'invoice' AND NEW."eventType" = 'internal.subscription.invoice_allocation'
          OR mode = 'period' AND NEW."eventType" = 'internal.subscription.period_allocation') THEN RAISE EXCEPTION 'Fixture receipt rejected'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER invoice_test_receipt_failure BEFORE INSERT ON "webhookEvents" FOR EACH ROW EXECUTE FUNCTION invoice_test_receipt_fault();
    `).simple();
  }, 30_000);
  beforeEach(async () => {
    mockedDb.execute.mockReset().mockImplementation(deferred);
    mockedDb.batch.mockReset().mockImplementation(executeBatch);
    await db.unsafe('TRUNCATE "webhookEvents", "creditTransactions", "userSubscriptions", "creditBalances", "subscriptionPlans", users RESTART IDENTITY CASCADE').simple();
    await db`UPDATE invoice_test_fault SET mode = 'none'`;
    await db`INSERT INTO users (id) VALUES (1), (2)`;
    await db`INSERT INTO "subscriptionPlans" (id, name, "monthlyCredits") VALUES (1, 'pro', 10000), (2, 'free', 0), (3, 'creator', 3000), (4, 'business', 100000)`;
    await db`INSERT INTO "creditBalances" ("userId", balance, "bonusCredits") VALUES (1, 7, 50)`;
    await db`INSERT INTO "userSubscriptions" ("userId", "planId", "stripeSubscriptionId", "subStatus", "currentPeriodStart", "currentPeriodEnd", "createdAt") VALUES (1, 1, 'sub_qa', 'active', ${start}, ${end}, now() - interval '1 day')`;
  });
  afterAll(async () => { await db.end(); await admin.unsafe("DROP SCHEMA IF EXISTS subscription_invoice_qa CASCADE").simple(); await admin.end(); });

  it("allocates one invoice exactly once under real simultaneous callers", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => allocatePaidSubscriptionInvoice(mapping)));
    expect(results.filter(result => result === "allocated")).toHaveLength(1);
    expect(results.filter(result => result === "duplicate")).toHaveLength(9);
    expect(await financialState()).toEqual({ wallet: { balance: 10050, bonusCredits: 0, monthlyAllocation: 10000 }, ledger: 1, receipts: 2 });
  });

  it("holds a second distinct invoice for the same period without another reset", async () => {
    await allocatePaidSubscriptionInvoice(mapping);
    await db`UPDATE "creditBalances" SET balance = 9000 WHERE "userId" = 1`;
    await expect(allocatePaidSubscriptionInvoice({ ...mapping, invoiceId: "in_second" })).rejects.toThrow(/reconcile/);
    expect(await financialState()).toEqual({ wallet: { balance: 9000, bonusCredits: 0, monthlyAllocation: 10000 }, ledger: 1, receipts: 2 });
  });

  it("allows only one of two distinct concurrent invoices for the same period", async () => {
    const results = await Promise.allSettled([allocatePaidSubscriptionInvoice(mapping), allocatePaidSubscriptionInvoice({ ...mapping, invoiceId: "in_second" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await financialState()).ledger).toBe(1);
    expect((await financialState()).receipts).toBe(2);
  });

  it.each(["ledger", "period", "invoice"])("rolls back wallet, ledger and receipts when the %s write fails", async mode => {
    await db`UPDATE invoice_test_fault SET mode = ${mode}`;
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow(/Fixture/);
    expect(await financialState()).toEqual({ wallet: { balance: 7, bonusCredits: 50, monthlyAllocation: 0 }, ledger: 0, receipts: 0 });
  });

  it("recovers an already committed invoice after a lost allocation acknowledgment", async () => {
    let lost = true;
    mockedDb.batch.mockImplementation(async (queries: { fixtureQuery: SQL }[]) => {
      const result = await executeBatch(queries);
      if (lost) { lost = false; throw new Error("Lost allocation acknowledgment"); }
      return result;
    });
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow("Lost allocation acknowledgment");
    expect(await allocatePaidSubscriptionInvoice(mapping)).toBe("duplicate");
    expect((await financialState()).ledger).toBe(1);
    expect((await financialState()).receipts).toBe(2);
  });

  it("returns an exact known invoice receipt after its service interval has expired", async () => {
    await allocatePaidSubscriptionInvoice(mapping);
    const historic = { ...mapping, periodStart: new Date(start.getTime() - 172800000), periodEnd: new Date(start.getTime() - 86400000) };
    await db`UPDATE "userSubscriptions" SET "currentPeriodStart" = ${historic.periodStart}, "currentPeriodEnd" = ${historic.periodEnd} WHERE "stripeSubscriptionId" = 'sub_qa'`;
    await db`UPDATE "creditTransactions" SET "txMetadata" = "txMetadata" || jsonb_build_object('periodStart', ${historic.periodStart.toISOString()}::text, 'periodEnd', ${historic.periodEnd.toISOString()}::text)`;
    await db`UPDATE "webhookEvents" SET "eventId" = ${`subscription-period:${mapping.subscriptionId}:${historic.periodStart.getTime() / 1000}:${historic.periodEnd.getTime() / 1000}`} WHERE "eventType" = 'internal.subscription.period_allocation'`;
    expect(historic.periodEnd.getTime()).toBeLessThan(Date.now());
    expect(await hasPaidSubscriptionInvoiceAllocation(historic)).toBe(true);
    expect(await allocatePaidSubscriptionInvoice(historic)).toBe("duplicate");
    expect((await financialState()).ledger).toBe(1);
  });

  it.each(["subscriptionId", "subscriptionItemId", "priceId"] as const)("binds existing invoice receipts to their exact %s", async field => {
    await allocatePaidSubscriptionInvoice(mapping);
    const changed = { ...mapping, [field]: field === "priceId" ? "price_other" : field === "subscriptionItemId" ? "si_other" : "sub_other" };
    expect(await hasPaidSubscriptionInvoiceAllocation(changed)).toBe(false);
    await expect(allocatePaidSubscriptionInvoice(changed)).rejects.toThrow();
    expect((await financialState()).ledger).toBe(1);
  });

  it("holds new stale or mismatched service intervals without financial writes", async () => {
    const expired = { ...mapping, periodStart: new Date(start.getTime() - 172800000), periodEnd: new Date(start.getTime() - 86400000) };
    await db`UPDATE "userSubscriptions" SET "currentPeriodStart" = ${expired.periodStart}, "currentPeriodEnd" = ${expired.periodEnd}`;
    await expect(allocatePaidSubscriptionInvoice(expired)).rejects.toThrow(/current verified/);
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow(/current verified/);
    expect(await financialState()).toEqual({ wallet: { balance: 7, bonusCredits: 50, monthlyAllocation: 0 }, ledger: 0, receipts: 0 });
  });

  it("holds missing account, plan or wallet instead of writing a processed receipt", async () => {
    await db`DELETE FROM "creditBalances"`;
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow(/saved plan and wallet/);
    const [ledger] = await db`SELECT count(*) AS n FROM "creditTransactions"`;
    const [receipts] = await db`SELECT count(*) AS n FROM "webhookEvents"`;
    expect(Number(ledger.n)).toBe(0); expect(Number(receipts.n)).toBe(0);
  });

  it("preserves older eligible paid history over newer incomplete or free rows", async () => {
    await db`INSERT INTO "userSubscriptions" ("userId", "planId", "stripeSubscriptionId", "subStatus", "currentPeriodStart", "currentPeriodEnd") VALUES (1, 1, 'sub_incomplete', 'incomplete', ${start}, ${end}), (1, 2, 'sub_free', 'active', ${start}, ${end})`;
    expect((await ordered())[0].stripeSubscriptionId).toBe("sub_qa");
  });

  it.each(["active", "canceled"])("holds an old %s subscription invoice after a current Business allocation", async oldStatus => {
    await db`UPDATE "userSubscriptions" SET "subStatus" = ${oldStatus}::"subStatus" WHERE "stripeSubscriptionId" = 'sub_qa'`;
    await db`INSERT INTO "userSubscriptions" ("userId", "planId", "stripeSubscriptionId", "subStatus", "currentPeriodStart", "currentPeriodEnd") VALUES (1, 4, 'sub_business', 'active', ${start}, ${end})`;
    const current = { ...mapping, invoiceId: "in_business", subscriptionId: "sub_business", subscriptionItemId: "si_business", priceId: "price_business" };
    expect(await allocatePaidSubscriptionInvoice(current)).toBe("allocated");
    await db`UPDATE "creditBalances" SET balance = 99000 WHERE "userId" = 1`;
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow(/reconcile/);
    expect(await financialState()).toEqual({ wallet: { balance: 99000, bonusCredits: 0, monthlyAllocation: 100000 }, ledger: 1, receipts: 2 });
  });

  it("checks current history in a fresh snapshot after waiting on the wallet lock", async () => {
    const held = await db.reserve();
    try {
      await held.unsafe("BEGIN");
      await held.unsafe('SELECT id FROM "creditBalances" WHERE "userId" = 1 FOR UPDATE');
      const oldInvoice = allocatePaidSubscriptionInvoice(mapping).then(value => ({ value }), error => ({ error }));
      let waiting = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const [activity] = await admin`SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'dreamforge_invoice_qa' AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE OF cb%'`;
        if (Number(activity.n) > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(true);
      await db`INSERT INTO "userSubscriptions" ("userId", "planId", "stripeSubscriptionId", "subStatus", "currentPeriodStart", "currentPeriodEnd") VALUES (1, 4, 'sub_business', 'active', ${start}, ${end})`;
      const current = { ...mapping, invoiceId: "in_business", subscriptionId: "sub_business", subscriptionItemId: "si_business", priceId: "price_business" };
      const newInvoice = allocatePaidSubscriptionInvoice(current);
      await held.unsafe("COMMIT");
      const oldResult = await oldInvoice;
      expect("error" in oldResult).toBe(true);
      expect(await newInvoice).toBe("allocated");
      expect(await financialState()).toEqual({ wallet: { balance: 100050, bonusCredits: 0, monthlyAllocation: 100000 }, ledger: 1, receipts: 2 });
    } finally {
      await held.unsafe("ROLLBACK");
      held.release();
    }
  }, 15_000);

  it("holds an invoice whose service period expires while waiting for the wallet lock", async () => {
    const shortPeriod = { ...mapping, periodStart: new Date(Date.now() - 60_000), periodEnd: new Date(Date.now() + 5_000) };
    await db`UPDATE "userSubscriptions" SET "currentPeriodStart" = ${shortPeriod.periodStart}, "currentPeriodEnd" = ${shortPeriod.periodEnd} WHERE "stripeSubscriptionId" = 'sub_qa'`;
    const held = await db.reserve();
    try {
      await held.unsafe("BEGIN");
      await held.unsafe('SELECT id FROM "creditBalances" WHERE "userId" = 1 FOR UPDATE');
      const allocation = allocatePaidSubscriptionInvoice(shortPeriod).then(value => ({ value }), error => ({ error }));
      let waiting = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        const [activity] = await admin`SELECT count(*) AS n FROM pg_stat_activity WHERE application_name = 'dreamforge_invoice_qa' AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE OF cb%'`;
        if (Number(activity.n) > 0) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      expect(waiting).toBe(true);
      expect(Date.now()).toBeLessThan(shortPeriod.periodEnd.getTime());
      await new Promise(resolve => setTimeout(resolve, Math.max(0, shortPeriod.periodEnd.getTime() - Date.now()) + 50));
      await held.unsafe("COMMIT");
      const outcome = await allocation;
      expect("error" in outcome).toBe(true);
      if ("error" in outcome) expect(outcome.error).toMatchObject({ message: expect.stringMatching(/reconcile/) });
      expect(await financialState()).toEqual({ wallet: { balance: 7, bonusCredits: 50, monthlyAllocation: 0 }, ledger: 0, receipts: 0 });
    } finally {
      await held.unsafe("ROLLBACK");
      held.release();
    }
  }, 15_000);

  it("excludes expired, future and canceled periods from paid-history priority", async () => {
    await db`UPDATE "userSubscriptions" SET "subStatus" = 'canceled' WHERE "stripeSubscriptionId" = 'sub_qa'`;
    await db`INSERT INTO "userSubscriptions" ("userId", "planId", "stripeSubscriptionId", "subStatus", "currentPeriodStart", "currentPeriodEnd", "createdAt") VALUES
      (1, 3, 'sub_current', 'trialing', ${start}, ${end}, now() - interval '2 days'),
      (1, 1, 'sub_expired', 'active', now() - interval '2 days', now() - interval '1 day', now()),
      (1, 1, 'sub_future', 'active', now() + interval '1 day', now() + interval '2 days', now())`;
    expect((await ordered())[0].stripeSubscriptionId).toBe("sub_current");
  });

  it("breaks equally eligible history ties deterministically by creation time and id", async () => {
    await db`INSERT INTO "userSubscriptions" ("userId", "planId", "stripeSubscriptionId", "subStatus", "currentPeriodStart", "currentPeriodEnd", "createdAt") VALUES
      (1, 3, 'sub_tie_a', 'active', ${start}, ${end}, now()), (1, 3, 'sub_tie_b', 'active', ${start}, ${end}, now())`;
    const orderedRows = await ordered();
    expect(orderedRows[0].stripeSubscriptionId).toBe("sub_tie_b");
    expect(orderedRows[1].stripeSubscriptionId).toBe("sub_tie_a");
  });
});
