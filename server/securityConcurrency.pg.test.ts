import postgres from "postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  retrieve: vi.fn(),
  sessions: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./stripe", () => ({
  getStripeClient: () => ({
    paymentIntents: { retrieve: mocks.retrieve },
    checkout: { sessions: { list: mocks.sessions } },
  }),
}));
import { enforceRateLimit } from "./rate-limit";
import {
  createPayout,
  recordPurchase,
  releasePayout,
  setPayoutStatus,
} from "./dbMarketplace";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) {
  const target = new URL(testUrl);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55439" ||
    target.pathname !== "/dreamforge_billing_qa" ||
    target.username !== "dreamforge_qa"
  ) {
    throw new Error(
      "Security tests require the isolated loopback billing fixture."
    );
  }
}
const suite = testUrl ? describe : describe.skip;
suite("security boundaries on isolated PostgreSQL", () => {
  const pg = postgres(
    testUrl ??
      "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa",
    {
      max: 16,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: "security_fix_qa" },
    }
  );
  const dialect = new PgDialect();
  const execute = async (tx: any, statement: any) => {
    const q = dialect.sqlToQuery(statement);
    return tx.unsafe(q.sql, q.params);
  };
  const db = {
    execute: (statement: any) => statement,
    batch: (statements: any[]) =>
      pg.begin(async tx => {
        const results: any[] = [];
        for (const statement of statements)
          results.push(await execute(tx, statement));
        return results;
      }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async (condition: any) => {
          // setPayoutStatus uses the ordinary Drizzle UPDATE builder.
          const { drizzle } = await import("drizzle-orm/neon-http");
          const q = drizzle
            .mock()
            .update(table)
            .set(values)
            .where(condition)
            .toSQL();
          return pg.unsafe(q.sql, q.params as any[]);
        },
      }),
    }),
  };
  beforeAll(async () => {
    await pg
      .unsafe(
        `CREATE SCHEMA security_fix_qa;
      CREATE TABLE security_fix_qa.rate_limit_hits (id serial PRIMARY KEY, key text NOT NULL, ts timestamp NOT NULL DEFAULT now());
      CREATE TABLE security_fix_qa."marketplaceListings" (id serial PRIMARY KEY, "sellerId" int NOT NULL, downloads int NOT NULL DEFAULT 0);
      CREATE TABLE security_fix_qa."sellerProfiles" (id serial PRIMARY KEY, "userId" int UNIQUE NOT NULL, "payoutBalance" int NOT NULL DEFAULT 0, "totalEarnings" int NOT NULL DEFAULT 0, "totalSales" int NOT NULL DEFAULT 0);
      CREATE TABLE security_fix_qa."marketplacePurchases" (id serial PRIMARY KEY, "buyerId" int, "listingId" int, price int, "platformFee" int, "sellerPayout" int, "stripePaymentId" text);
      CREATE TABLE security_fix_qa."sellerPayouts" (id serial PRIMARY KEY, "sellerId" int, amount int, "payoutStatus" text, "stripeTransferId" text);`
      )
      .simple();
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(db);
    await pg.unsafe(
      'TRUNCATE rate_limit_hits, "marketplaceListings", "sellerProfiles", "marketplacePurchases", "sellerPayouts" RESTART IDENTITY'
    );
    await pg`INSERT INTO "marketplaceListings" (id, "sellerId") VALUES (41, 7)`;
    await pg`INSERT INTO "sellerProfiles" (id, "userId", "payoutBalance") VALUES (5, 7, 10000)`;
  });
  afterAll(async () => {
    await pg.unsafe("DROP SCHEMA IF EXISTS security_fix_qa CASCADE");
    await pg.end();
  });

  it("admits exactly the configured cap under concurrent requests and releases locks", async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 24 }, () => enforceRateLimit("same-ip", 3, 3600000))
    );
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(3);
    expect(
      (await pg`SELECT count(*)::int AS hits FROM rate_limit_hits`)[0].hits
    ).toBe(3);
    await enforceRateLimit("another-ip", 1, 3600000);
    await pg`UPDATE rate_limit_hits SET ts = now() - interval '2 hours'`;
    await enforceRateLimit("same-ip", 3, 3600000);
  });

  it("legacy credit-funded balances cannot be withdrawn and remain historically unchanged", async () => {
    await pg`INSERT INTO "marketplacePurchases" ("buyerId", "listingId", price, "sellerPayout") VALUES (8, 41, 12500, 10000)`;
    await expect(createPayout(5, 500)).rejects.toThrow(/cash-backed/);
    expect(
      (
        await pg`SELECT "payoutBalance" AS balance FROM "sellerProfiles" WHERE id=5`
      )[0].balance
    ).toBe(10000);
    expect(
      (await pg`SELECT count(*)::int AS n FROM "sellerPayouts"`)[0].n
    ).toBe(0);
  });

  it("concurrent payouts reserve only cash earnings minus pending/paid payouts", async () => {
    await pg`INSERT INTO "marketplacePurchases" ("buyerId", "listingId", price, "sellerPayout", "stripePaymentId") VALUES (8, 41, 625, 500, 'pi_cash')`;
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => createPayout(5, 500))
    );
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const [pending] = await pg`SELECT * FROM "sellerPayouts"`;
    expect(pending.amount).toBe(500);
    expect(
      (
        await pg`SELECT "payoutBalance" AS balance FROM "sellerProfiles" WHERE id=5`
      )[0].balance
    ).toBe(9500);
    await releasePayout(5, 500, pending.id);
    await releasePayout(5, 500, pending.id);
    expect(
      (
        await pg`SELECT "payoutBalance" AS balance FROM "sellerProfiles" WHERE id=5`
      )[0].balance
    ).toBe(10000);
    const retry = await createPayout(5, 500);
    await setPayoutStatus(retry.id, "paid", "tr_fixture");
    await expect(createPayout(5, 500)).rejects.toThrow(/cash-backed/);
  });

  it("a repeated paid receipt accrues seller earnings exactly once under concurrency", async () => {
    mocks.retrieve.mockResolvedValue({
      id: "pi_fixture",
      status: "succeeded",
      currency: "usd",
      amount_received: 5000,
    });
    mocks.sessions.mockResolvedValue({
      data: [
        {
          mode: "payment",
          status: "complete",
          payment_status: "paid",
          currency: "usd",
          amount_total: 5000,
          client_reference_id: "8",
          metadata: {
            type: "marketplace_purchase",
            buyer_id: "8",
            listing_id: "41",
          },
        },
      ],
    });
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () =>
        recordPurchase({
          buyerId: 8,
          listingId: 41,
          price: 5000,
          stripePaymentId: "pi_fixture",
        })
      )
    );
    expect(new Set(outcomes.map(x => x.id)).size).toBe(1);
    expect(
      (await pg`SELECT count(*)::int AS n FROM "marketplacePurchases"`)[0].n
    ).toBe(1);
    expect(
      (
        await pg`SELECT "payoutBalance" AS balance FROM "sellerProfiles" WHERE id=5`
      )[0].balance
    ).toBe(14000);
    expect(
      (await pg`SELECT downloads FROM "marketplaceListings" WHERE id=41`)[0]
        .downloads
    ).toBe(1);
  });
});
