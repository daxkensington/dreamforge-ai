import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";

// The webhook handler receives a drizzle db instance from the route; these
// mocks stand in for the server modules it imports (same convention as
// phase15/phase18 tests).

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./stripe", () => ({
  addCredits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./routersPhase15", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./dbMarketplace", () => ({
  hasPurchased: vi.fn(),
  recordPurchase: vi.fn(),
}));

vi.mock("./routers/pricing", () => ({
  activateSubscription: vi.fn(),
  handleSubscriptionUpdated: vi.fn(),
  handleSubscriptionDeleted: vi.fn(),
  handleMonthlyReset: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { processStripeEvent } from "../app/api/webhooks/stripe/handler";
import { addCredits } from "./stripe";
import { createNotification } from "./routersPhase15";

// ─── Fluent drizzle mock ──────────────────────────────────────────────────
// Chains every drizzle call the webhook handler makes and records the values
// passed to .values() / .set() so tests can assert on them. Table names are
// resolved with the real getTableName so behavior can be keyed per table.

interface DbBehavior {
  // rows returned by the claim insert's .returning() (webhookEvents)
  claimRows?: any[];
  // rows returned by successive .limit()/.then() selects per table
  selectRows?: (table: string, callIndex: number) => any[];
  // rows returned by successive .returning() calls per table (default: [{id:1}])
  updateReturningRows?: (table: string, callIndex: number) => any[];
}

function makeDb(behavior: DbBehavior = {}) {
  const calls = {
    inserts: [] as { table: string; values: any }[],
    updates: [] as { table: string; set: any }[],
    selects: [] as { table: string }[],
  };
  const selectCounts: Record<string, number> = {};
  const updateReturningCounts: Record<string, number> = {};

  const db: any = {};

  db.select = vi.fn((..._cols: any[]) => ({
    from: vi.fn((table: any) => {
      const name = getTableName(table);
      calls.selects.push({ table: name });
      const chain: any = {};
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        const idx = (selectCounts[name] = (selectCounts[name] ?? 0) + 1) - 1;
        return Promise.resolve(behavior.selectRows?.(name, idx) ?? []);
      });
      // awaited without .limit()
      chain.then = (resolve: any) => {
        const idx = (selectCounts[name] = (selectCounts[name] ?? 0) + 1) - 1;
        resolve(behavior.selectRows?.(name, idx) ?? []);
      };
      return chain;
    }),
  }));

  db.insert = vi.fn((table: any) => {
    const name = getTableName(table);
    const chain: any = {};
    chain.values = vi.fn((values: any) => {
      calls.inserts.push({ table: name, values });
      return chain;
    });
    chain.onConflictDoNothing = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockResolvedValue(behavior.claimRows ?? [{ id: 1 }]);
    chain.then = (resolve: any) => resolve({ inserted: name });
    return chain;
  });

  db.update = vi.fn((table: any) => {
    const name = getTableName(table);
    const chain: any = {};
    chain.set = vi.fn((set: any) => {
      calls.updates.push({ table: name, set });
      return chain;
    });
    chain.where = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockImplementation(() => {
      const idx = (updateReturningCounts[name] = (updateReturningCounts[name] ?? 0) + 1) - 1;
      return Promise.resolve(behavior.updateReturningRows?.(name, idx) ?? [{ id: 1 }]);
    });
    chain.then = (resolve: any) => resolve({ updated: name });
    return chain;
  });

  return { db, calls };
}

const makeEvent = (id: string, type: string, object: any): any => ({
  id,
  type,
  data: { object },
});

const PURCHASE = {
  id: 7,
  userId: 42,
  amount: 100,
  type: "purchase",
  clawedBackCredits: 0,
  stripePaymentIntentId: "pi_1",
};

const checkoutEvent = (id: string, sessionId: string) =>
  makeEvent(id, "checkout.session.completed", {
    id: sessionId,
    payment_intent: "pi_new",
    metadata: { user_id: "7", credits: "100", package_id: "starter" },
  });

const refundEvent = (id: string, amountRefunded: number) =>
  makeEvent(id, "charge.refunded", {
    id: "ch_1",
    amount: 10000,
    amount_refunded: amountRefunded,
    payment_intent: "pi_1",
  });

const balanceDeltaOf = (calls: ReturnType<typeof makeDb>["calls"]) => {
  const balanceUpdate = calls.updates.find((u) => u.table === "creditBalances");
  expect(balanceUpdate).toBeDefined();
  // drizzle sql`` wrapper: bound values live as primitives in queryChunks
  const nums = (balanceUpdate!.set.balance as any).queryChunks.filter(
    (c: any) => typeof c === "number"
  );
  expect(nums.length).toBeGreaterThan(0);
  return nums[0] as number;
};

describe("Stripe webhook — processStripeEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Atomic idempotency claim ──────────────────────────────────────
  describe("atomic idempotency claim", () => {
    it("returns 'duplicate' and does not process when the claim insert hits the unique conflict", async () => {
      const { db, calls } = makeDb({ claimRows: [] });

      const result = await processStripeEvent(
        checkoutEvent("evt_dup", "cs_dup"),
        db
      );

      expect(result).toBe("duplicate");
      // claimed with a 'pending' row up front
      expect(calls.inserts[0].table).toBe("webhookEvents");
      expect(calls.inserts[0].values).toMatchObject({
        eventId: "evt_dup",
        status: "pending",
      });
      // never reached the credit-grant path
      expect(addCredits).not.toHaveBeenCalled();
      expect(calls.selects).toHaveLength(0);
    });

    it("grants credits on first delivery of checkout.session.completed", async () => {
      const { db, calls } = makeDb({
        // guard lookup finds no existing purchase for this session
        selectRows: () => [],
      });

      const result = await processStripeEvent(
        checkoutEvent("evt_co_1", "cs_new"),
        db
      );

      expect(result).toBe("processed");
      expect(addCredits).toHaveBeenCalledTimes(1);
      expect(addCredits).toHaveBeenCalledWith(
        7,
        100,
        "Purchased starter pack (100 credits)",
        "cs_new",
        "pi_new"
      );
      expect(createNotification).toHaveBeenCalledWith(
        7,
        "payment",
        "Payment Successful",
        expect.any(String),
        expect.objectContaining({ credits: 100, sessionId: "cs_new" })
      );
      const logUpdate = calls.updates.filter((u) => u.table === "webhookEvents").pop()!;
      expect(logUpdate.set.status).toBe("processed");
    });

    it("blocks re-grant when a creditTransactions row already exists for the stripeSessionId", async () => {
      const { db, calls } = makeDb({
        // guard lookup finds an earlier purchase transaction for this session
        selectRows: () => [{ id: 55 }],
      });

      const result = await processStripeEvent(
        checkoutEvent("evt_co_2", "cs_existing"),
        db
      );

      expect(result).toBe("processed");
      expect(addCredits).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
      const logUpdate = calls.updates.filter((u) => u.table === "webhookEvents").pop()!;
      expect(logUpdate.set.summary).toContain("already granted");
    });
  });

  // ─── 2. Refund clawback deltas ────────────────────────────────────────
  describe("charge.refunded clawback", () => {
    it("claws only the delta for a single partial refund", async () => {
      const { db, calls } = makeDb({
        // 1st select: purchase lookup; 2nd select: claw loop re-read
        selectRows: () => [PURCHASE],
      });

      const result = await processStripeEvent(refundEvent("evt_ref_1", 5000), db);

      expect(result).toBe("processed");
      // counter moved to the cumulative target
      const counterUpdate = calls.updates.find((u) => u.table === "creditTransactions")!;
      expect(counterUpdate.set.clawedBackCredits).toBe(50);
      // balance debited exactly the delta
      expect(balanceDeltaOf(calls)).toBe(50);
      // audit transaction recorded
      const clawTx = calls.inserts.find((i) => i.table === "creditTransactions")!;
      expect(clawTx.values.amount).toBe(-50);
      expect(clawTx.values.type).toBe("refund");
      expect(createNotification).toHaveBeenCalledWith(
        42,
        "payment",
        "Refund Processed",
        expect.any(String),
        expect.objectContaining({ creditsRemoved: 50 })
      );
    });

    it("claws exactly 100% across two staged partial refunds (50% then 100%), not 150%", async () => {
      // First refund: 50% of the charge refunded → 50 credits
      const first = makeDb({ selectRows: () => [PURCHASE] });
      const firstResult = await processStripeEvent(
        refundEvent("evt_ref_50", 5000),
        first.db
      );
      expect(firstResult).toBe("processed");
      expect(balanceDeltaOf(first.calls)).toBe(50);

      // Second refund event: amount_refunded is now CUMULATIVE at 100%.
      // The purchase row remembers 50 already clawed.
      const second = makeDb({
        selectRows: () => [{ ...PURCHASE, clawedBackCredits: 50 }],
      });
      const secondResult = await processStripeEvent(
        refundEvent("evt_ref_100", 10000),
        second.db
      );
      expect(secondResult).toBe("processed");
      expect(balanceDeltaOf(second.calls)).toBe(50); // NOT another 100

      const counterUpdate = second.calls.updates.find(
        (u) => u.table === "creditTransactions"
      )!;
      expect(counterUpdate.set.clawedBackCredits).toBe(100);

      // total clawed across both events: 50 + 50 = 100
      const total = balanceDeltaOf(first.calls) + balanceDeltaOf(second.calls);
      expect(total).toBe(100);
    });

    it("recomputes instead of double-clawing when a concurrent event wins the counter race", async () => {
      const { db, calls } = makeDb({
        selectRows: (_table, idx) => {
          // idx 0: purchase lookup (clawed 0)
          // idx 1: claw loop attempt 1 sees clawed 0
          // idx 2: claw loop attempt 2 re-reads after losing the race: clawed 50
          if (idx === 2) return [{ ...PURCHASE, clawedBackCredits: 50 }];
          return [PURCHASE];
        },
        updateReturningRows: (table, idx) => {
          // first counter update loses the optimistic race
          if (table === "creditTransactions" && idx === 0) return [];
          return [{ id: 7 }];
        },
      });

      const result = await processStripeEvent(refundEvent("evt_ref_race", 10000), db);

      expect(result).toBe("processed");
      // recomputed delta: 100 expected - 50 clawed by the winner = 50
      expect(balanceDeltaOf(calls)).toBe(50);
      const counterUpdate = calls.updates.find((u) => u.table === "creditTransactions")!;
      expect(counterUpdate.set.clawedBackCredits).toBe(100);
    });

    it("does not claw again when a refund event arrives after the purchase is fully clawed", async () => {
      const { db, calls } = makeDb({
        selectRows: () => [{ ...PURCHASE, clawedBackCredits: 100 }],
      });

      const result = await processStripeEvent(refundEvent("evt_ref_late", 10000), db);

      expect(result).toBe("ignored");
      expect(calls.updates.some((u) => u.table === "creditBalances")).toBe(false);
      expect(
        calls.inserts.some((i) => i.table === "creditTransactions")
      ).toBe(false);
      expect(createNotification).not.toHaveBeenCalled();
    });
  });

  // ─── 3. Disputes ──────────────────────────────────────────────────────
  describe("charge.dispute", () => {
    const disputeCreatedEvent = () =>
      makeEvent("evt_dp_1", "charge.dispute.created", {
        id: "dp_1",
        amount: 10000,
        reason: "fraudulent",
        payment_intent: "pi_1",
        charge: { id: "ch_1", amount: 10000 },
      });

    it("charge.dispute.created claws the disputed amount and notifies the user", async () => {
      const { db, calls } = makeDb({ selectRows: () => [PURCHASE] });

      const result = await processStripeEvent(disputeCreatedEvent(), db);

      expect(result).toBe("processed");
      expect(balanceDeltaOf(calls)).toBe(100);
      const counterUpdate = calls.updates.find((u) => u.table === "creditTransactions")!;
      expect(counterUpdate.set.clawedBackCredits).toBe(100);
      const clawTx = calls.inserts.find((i) => i.table === "creditTransactions")!;
      expect(clawTx.values.amount).toBe(-100);
      expect(clawTx.values.type).toBe("dispute");
      expect(createNotification).toHaveBeenCalledWith(
        42,
        "payment",
        "Payment Disputed",
        expect.any(String),
        expect.objectContaining({ disputeId: "dp_1", creditsRemoved: 100 })
      );
    });

    it("charge.dispute.closed is a no-op for both won and lost outcomes", async () => {
      for (const status of ["won", "lost"]) {
        const { db, calls } = makeDb();

        const result = await processStripeEvent(
          makeEvent(`evt_dp_closed_${status}`, "charge.dispute.closed", {
            id: "dp_1",
            status,
          }),
          db
        );

        expect(result).toBe("ignored");
        expect(calls.updates.every((u) => u.table === "webhookEvents")).toBe(true);
        expect(
          calls.inserts.every((i) => i.table === "webhookEvents")
        ).toBe(true);
      }
    });
  });
});
