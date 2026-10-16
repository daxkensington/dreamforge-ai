import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const stripeMocks = vi.hoisted(() => ({
  transfersCreate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    transfers = { create: stripeMocks.transfersCreate };
    checkout = { sessions: { create: vi.fn() } };
    accounts = { create: vi.fn() };
    accountLinks = { create: vi.fn() };
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Keep the real dbMarketplace exports available (spread), but stub the payout
// orchestration points so router tests can simulate races and Stripe failures.
const payoutMocks = vi.hoisted(() => ({
  getSellerProfile: vi.fn(),
  reservePayout: vi.fn(),
  releasePayout: vi.fn(),
  createPayout: vi.fn(),
  setPayoutStatus: vi.fn(),
}));

vi.mock("./dbMarketplace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./dbMarketplace")>();
  return { ...actual, ...payoutMocks };
});

import { getDb } from "./db";
import { marketplaceRouter } from "./routers/marketplace";

let realDbMarketplace!: typeof import("./dbMarketplace");

beforeAll(async () => {
  realDbMarketplace = await vi.importActual<typeof import("./dbMarketplace")>("./dbMarketplace");
});

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

const user = {
  id: 7,
  openId: "seller-7",
  name: "Seller",
  email: "seller@dreamforge.ai",
  role: "user" as const,
  createdAt: new Date(),
};

const caller = marketplaceRouter.createCaller({
  user,
  session: null,
  ip: "127.0.0.1",
  req: { headers: { origin: "http://localhost:3000" } },
} as any);

const profile = {
  id: 5,
  userId: 7,
  displayName: "Seller",
  stripeConnectId: "acct_1",
  payoutBalance: 20000, // $200.00
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  payoutMocks.getSellerProfile.mockResolvedValue(profile);
  payoutMocks.reservePayout.mockResolvedValue(19500);
  payoutMocks.createPayout.mockResolvedValue({ id: 42 });
  payoutMocks.setPayoutStatus.mockResolvedValue(undefined);
  stripeMocks.transfersCreate.mockResolvedValue({ id: "tr_1" });
});

// ─── P1.10 — payout double-pay race ─────────────────────────────────────────

describe("marketplace.requestPayout (P1.10)", () => {
  it("reserves funds, writes a pending row, transfers, then marks paid — in that order", async () => {
    const result = await caller.requestPayout({ amount: 500 });

    expect(result).toEqual({ success: true, payoutId: 42, transferId: "tr_1" });

    // Conditional balance reservation happens BEFORE any Stripe transfer.
    expect(payoutMocks.reservePayout).toHaveBeenCalledWith(5, 500);
    expect(payoutMocks.reservePayout.mock.invocationCallOrder[0]).toBeLessThan(
      stripeMocks.transfersCreate.mock.invocationCallOrder[0]
    );
    // Pending ledger row before the transfer; settled after.
    expect(payoutMocks.createPayout).toHaveBeenCalledWith(5, 500);
    expect(payoutMocks.createPayout.mock.invocationCallOrder[0]).toBeLessThan(
      stripeMocks.transfersCreate.mock.invocationCallOrder[0]
    );
    expect(payoutMocks.setPayoutStatus).toHaveBeenCalledWith(42, "paid", "tr_1");
    expect(payoutMocks.setPayoutStatus.mock.invocationCallOrder[0]).toBeGreaterThan(
      stripeMocks.transfersCreate.mock.invocationCallOrder[0]
    );
    expect(stripeMocks.transfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, currency: "usd", destination: "acct_1" })
    );
  });

  it("pre-check rejects with the existing insufficient-balance message without reserving or transferring", async () => {
    payoutMocks.getSellerProfile.mockResolvedValue({ ...profile, payoutBalance: 400 });

    await expect(caller.requestPayout({ amount: 500 })).rejects.toThrow(
      "Insufficient balance. Available: $4.00, requested: $5.00"
    );
    expect(payoutMocks.reservePayout).not.toHaveBeenCalled();
    expect(stripeMocks.transfersCreate).not.toHaveBeenCalled();
  });

  it("losing the conditional update throws before any transfer (concurrent requests transfer once)", async () => {
    // Simulate two simultaneous requests against one $200 balance: the
    // reservation succeeds once and fails once — only one may reach Stripe.
    payoutMocks.reservePayout
      .mockResolvedValueOnce(19500)
      .mockRejectedValueOnce(new Error("Insufficient balance for payout of 500"));

    const [first, second] = await Promise.allSettled([
      caller.requestPayout({ amount: 500 }),
      caller.requestPayout({ amount: 500 }),
    ]);

    const fulfilled = [first, second].filter((r) => r.status === "fulfilled");
    const rejected = [first, second].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("Insufficient balance");
    expect(stripeMocks.transfersCreate).toHaveBeenCalledTimes(1);
  });

  it("transfer failure marks the row failed and restores the reserved balance", async () => {
    stripeMocks.transfersCreate.mockRejectedValue(new Error("stripe down"));

    await expect(caller.requestPayout({ amount: 500 })).rejects.toThrow("Payout failed: stripe down");

    expect(payoutMocks.setPayoutStatus).toHaveBeenCalledWith(42, "failed");
    expect(payoutMocks.releasePayout).toHaveBeenCalledWith(5, 500);
    expect(payoutMocks.releasePayout.mock.invocationCallOrder[0]).toBeGreaterThan(
      payoutMocks.setPayoutStatus.mock.invocationCallOrder[0]
    );
  });

  it("ledger insert failure releases the reservation and never transfers", async () => {
    payoutMocks.createPayout.mockRejectedValue(new Error("db write failed"));

    await expect(caller.requestPayout({ amount: 500 })).rejects.toThrow("db write failed");

    expect(payoutMocks.releasePayout).toHaveBeenCalledWith(5, 500);
    expect(stripeMocks.transfersCreate).not.toHaveBeenCalled();
  });

  it("keeps existing guards: missing profile and missing Connect account", async () => {
    payoutMocks.getSellerProfile.mockResolvedValueOnce(null);
    await expect(caller.requestPayout({ amount: 500 })).rejects.toThrow(
      "Seller profile not found. Set up your seller account first."
    );

    payoutMocks.getSellerProfile.mockResolvedValueOnce({ ...profile, stripeConnectId: null });
    await expect(caller.requestPayout({ amount: 500 })).rejects.toThrow(
      "Stripe Connect account not set up. Complete seller onboarding first."
    );

    expect(stripeMocks.transfersCreate).not.toHaveBeenCalled();
  });
});

// ─── db layer — conditional reservation and ledger writes ───────────────────

/** Best-effort flattening of drizzle SQL fragments (queryChunks-based build). */
function sqlText(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(sqlText).join("");
  if (x.queryChunks) return x.queryChunks.map(sqlText).join("");
  if (typeof x.value === "string") return x.value; // StringChunk
  if (Array.isArray(x.value)) return x.value.join(""); // StringChunk (newer drizzle)
  if (x.name) return String(x.name); // column ref
  return "";
}

function makePayoutDb({ updateReturning = [] as any[] } = {}) {
  const captured = {
    updates: [] as { set: any; where: any }[],
    inserts: [] as { values: any }[],
  };
  const updateChain: any = {
    set: vi.fn(function (s: any) {
      captured.updates.push({ set: s });
      return updateChain;
    }),
    where: vi.fn(function (w: any) {
      captured.updates[captured.updates.length - 1].where = w;
      return updateChain;
    }),
    returning: vi.fn(() => Promise.resolve(updateReturning)),
  };
  const insertChain: any = {
    values: vi.fn(function (v: any) {
      captured.inserts.push({ values: v });
      return insertChain;
    }),
    returning: vi.fn(() => Promise.resolve([{ id: 42 }])),
  };
  const db: any = {
    update: vi.fn(() => updateChain),
    insert: vi.fn(() => insertChain),
  };
  return { db, captured };
}

describe("dbMarketplace payout helpers", () => {
  it("reservePayout atomically decrements with a balance guard and returns the new balance", async () => {
    const { db, captured } = makePayoutDb({ updateReturning: [{ payoutBalance: 19500 }] });
    (getDb as any).mockResolvedValue(db);

    const newBalance = await realDbMarketplace.reservePayout(5, 500);

    expect(newBalance).toBe(19500);
    // The WHERE must include the >= guard — this is the race protection.
    const whereText = sqlText(captured.updates[0].where);
    expect(whereText).toContain(">=");
    expect(whereText).toContain("payoutBalance");
    expect(sqlText(captured.updates[0].set.payoutBalance)).toContain("-");
  });

  it("reservePayout throws when the conditional update matches no row", async () => {
    const { db } = makePayoutDb({ updateReturning: [] });
    (getDb as any).mockResolvedValue(db);

    await expect(realDbMarketplace.reservePayout(5, 500)).rejects.toThrow(
      "Insufficient balance for payout of 500"
    );
  });

  it("releasePayout issues a compensating increment", async () => {
    const { db, captured } = makePayoutDb();
    (getDb as any).mockResolvedValue(db);

    await realDbMarketplace.releasePayout(5, 500);

    expect(sqlText(captured.updates[0].set.payoutBalance)).toContain("+");
  });

  it("setPayoutStatus records paid with a transfer id, failed without one", async () => {
    const { db, captured } = makePayoutDb();
    (getDb as any).mockResolvedValue(db);

    await realDbMarketplace.setPayoutStatus(42, "paid", "tr_1");
    expect(captured.updates[0].set).toEqual({ status: "paid", stripeTransferId: "tr_1" });

    await realDbMarketplace.setPayoutStatus(42, "failed");
    expect(captured.updates[1].set).toEqual({ status: "failed" });
  });

  it("createPayout writes the ledger row but no longer decrements the balance", async () => {
    const { db, captured } = makePayoutDb();
    (getDb as any).mockResolvedValue(db);

    await realDbMarketplace.createPayout(5, 500);
    expect(captured.inserts[0].values).toMatchObject({ sellerId: 5, amount: 500, status: "pending" });
    expect(captured.inserts[0].values.stripeTransferId).toBeNull();

    await realDbMarketplace.createPayout(5, 500, "tr_1");
    expect(captured.inserts[1].values).toMatchObject({ status: "paid", stripeTransferId: "tr_1" });

    // Balance movement is reservePayout's job now — no plain decrement here.
    expect(captured.updates).toHaveLength(0);
  });
});
