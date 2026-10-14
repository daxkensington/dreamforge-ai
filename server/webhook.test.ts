import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName } from "drizzle-orm";
const subscriptionsRetrieve = vi.hoisted(() => vi.fn());
vi.mock("stripe", () => ({ default: class StripeMock { subscriptions = { retrieve: subscriptionsRetrieve }; } }));
vi.mock("./_core/subscriptionBilling", () => ({
  allocatePaidSubscriptionInvoice: vi.fn(async () => "allocated"),
  hasPaidSubscriptionInvoiceAllocation: vi.fn(async () => false),
}));

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
import { activateSubscription, handleSubscriptionUpdated, handleMonthlyReset } from "./routers/pricing";
import { allocatePaidSubscriptionInvoice, hasPaidSubscriptionInvoiceAllocation } from "./_core/subscriptionBilling";

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
    process.env.STRIPE_SECRET_KEY = "sk_test_mocked_webhook_only";
    subscriptionsRetrieve.mockReset();
    vi.mocked(hasPaidSubscriptionInvoiceAllocation).mockReset().mockResolvedValue(false);
  });

  describe("verified subscription invoice allocation", () => {
    const start = Math.floor(Date.now() / 1000) - 86_400;
    const end = start + 30 * 86_400;
    const activeSubscription = {
      id: "sub_ordered", status: "active", cancel_at_period_end: true,
      metadata: { user_id: "7", plan_id: "2", plan_name: "pro" },
      items: { data: [{ id: "si_ordered", price: { id: "price_pro" }, current_period_start: start, current_period_end: end }] },
    };
    const paidInvoice = {
      id: "in_ordered", status: "paid", amount_paid: 0, billing_reason: "subscription_create",
      parent: { subscription_details: { subscription: "sub_ordered" } },
      lines: { has_more: false, data: [{
        parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_ordered", subscription_item: "si_ordered", proration: false } },
        pricing: { price_details: { price: "price_pro" } }, period: { start, end },
      }] },
    };

    it("persists incomplete creation without granting credits or inventing a period", async () => {
      subscriptionsRetrieve.mockResolvedValue({ ...activeSubscription, status: "incomplete", items: { data: [] } });
      const { db } = makeDb();
      await processStripeEvent(makeEvent("evt_incomplete_creation", "customer.subscription.created", { id: "sub_ordered" }), db);
      expect(activateSubscription).toHaveBeenCalledExactlyOnceWith(7, 2, "sub_ordered", null, null, "incomplete", true);
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
      expect(handleMonthlyReset).not.toHaveBeenCalled();
      expect(addCredits).not.toHaveBeenCalled();
    });

    it("updates verified active state but waits for a paid invoice before allocating", async () => {
      subscriptionsRetrieve.mockResolvedValue(activeSubscription);
      const { db } = makeDb();
      await processStripeEvent(makeEvent("evt_active_update", "customer.subscription.updated", { id: "sub_ordered", status: "incomplete" }), db);
      expect(handleSubscriptionUpdated).toHaveBeenCalledWith("sub_ordered", "pro", "active", expect.any(Date), expect.any(Date), true);
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
    });

    it.each(["invoice.paid", "invoice.payment_succeeded"])("allocates a paid zero-value initial invoice through %s using current exact subscription mapping", async type => {
      subscriptionsRetrieve.mockResolvedValue(activeSubscription);
      const { db } = makeDb();
      await processStripeEvent(makeEvent(`evt_${type}`, type, paidInvoice), db);
      expect(subscriptionsRetrieve).toHaveBeenCalledExactlyOnceWith("sub_ordered");
      expect(activateSubscription).toHaveBeenCalledWith(7, 2, "sub_ordered", expect.any(Date), expect.any(Date), "active", true);
      expect(allocatePaidSubscriptionInvoice).toHaveBeenCalledExactlyOnceWith({ invoiceId: "in_ordered", subscriptionId: "sub_ordered", subscriptionItemId: "si_ordered", priceId: "price_pro", periodStart: new Date(start * 1000), periodEnd: new Date(end * 1000) });
      expect(handleMonthlyReset).not.toHaveBeenCalled();
    });

    it("handles a paid cycle invoice before creation and reconciles delayed creation to freshest provider state", async () => {
      subscriptionsRetrieve.mockResolvedValue(activeSubscription);
      const { db } = makeDb();
      await processStripeEvent(makeEvent("evt_paid_first", "invoice.paid", { ...paidInvoice, billing_reason: "subscription_cycle" }), db);
      await processStripeEvent(makeEvent("evt_created_late", "customer.subscription.created", { ...activeSubscription, status: "incomplete" }), db);
      expect(activateSubscription).toHaveBeenCalledTimes(2);
      expect(vi.mocked(activateSubscription).mock.calls.every(call => call[5] === "active")).toBe(true);
      expect(allocatePaidSubscriptionInvoice).toHaveBeenCalledTimes(1);
    });

    it("uses real legacy trial bounds without extending them to a billing period", async () => {
      subscriptionsRetrieve.mockResolvedValue({ ...activeSubscription, status: "trialing", trial_start: 1_790_208_000, trial_end: 1_790_812_800 });
      const { db } = makeDb();
      await processStripeEvent(makeEvent("evt_trial", "customer.subscription.created", { id: "sub_ordered" }), db);
      expect(activateSubscription).toHaveBeenCalledWith(7, 2, "sub_ordered", new Date(1_790_208_000_000), new Date(1_790_812_800_000), "trialing", true);
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
    });

    it("fails for reconciliation rather than granting thirty guessed days when an active period is absent", async () => {
      subscriptionsRetrieve.mockResolvedValue({ ...activeSubscription, items: { data: [] } });
      const { db, calls } = makeDb();
      await expect(processStripeEvent(makeEvent("evt_no_period", "customer.subscription.created", { id: "sub_ordered" }), db)).rejects.toThrow(/reconcile Stripe period data/i);
      expect(activateSubscription).not.toHaveBeenCalled();
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
      expect(calls.updates).toEqual(expect.arrayContaining([expect.objectContaining({ table: "webhookEvents", set: expect.objectContaining({ status: "failed" }) })]));
    });

    it("never allocates an unpaid or unrelated invoice", async () => {
      const { db } = makeDb();
      await processStripeEvent(makeEvent("evt_open_invoice", "invoice.paid", { ...paidInvoice, status: "open" }), db);
      await processStripeEvent(makeEvent("evt_proration_invoice", "invoice.paid", { ...paidInvoice, billing_reason: "subscription_update" }), db);
      expect(subscriptionsRetrieve).not.toHaveBeenCalled();
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
    });

    it("rejects retrieval with a different subscription identity", async () => {
      subscriptionsRetrieve.mockResolvedValue({ ...activeSubscription, id: "sub_other" });
      const { db } = makeDb();
      await expect(processStripeEvent(makeEvent("evt_wrong_sub", "invoice.paid", paidInvoice), db)).rejects.toThrow(/different subscription/i);
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
    });

    it.each(["missing", "ambiguous", "old"])("holds %s invoice service periods without touching credits", async kind => {
      subscriptionsRetrieve.mockResolvedValue(activeSubscription);
      const invoice = kind === "missing" ? { ...paidInvoice, lines: { data: [] } }
        : kind === "ambiguous" ? { ...paidInvoice, lines: { ...paidInvoice.lines, has_more: true } }
        : { ...paidInvoice, lines: { data: [{ ...paidInvoice.lines.data[0], period: { start: start - 86_400, end: end - 86_400 } }] } };
      await expect(processStripeEvent(makeEvent(`evt_${kind}_period`, "invoice.paid", invoice), makeDb().db)).rejects.toThrow(/reconcile/i);
      expect(activateSubscription).not.toHaveBeenCalled();
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
    });

    it("replays an already allocated invoice without renewed provider or period checks", async () => {
      vi.mocked(hasPaidSubscriptionInvoiceAllocation).mockResolvedValueOnce(true);
      await processStripeEvent(makeEvent("evt_paid_duplicate", "invoice.paid", paidInvoice), makeDb().db);
      expect(subscriptionsRetrieve).not.toHaveBeenCalled();
      expect(allocatePaidSubscriptionInvoice).not.toHaveBeenCalled();
    });

    it("allows an atomic paid-invoice failure to reclaim its failed event while keeping successful/pending duplicates blocked", async () => {
      subscriptionsRetrieve.mockResolvedValue(activeSubscription);
      const { db, calls } = makeDb({ claimRows: [] });
      await processStripeEvent(makeEvent("evt_retry_paid", "invoice.paid", paidInvoice), db);
      expect(calls.updates[0].set).toMatchObject({ status: "pending" });
      expect(allocatePaidSubscriptionInvoice).toHaveBeenCalledTimes(1);
      vi.clearAllMocks();
      const duplicateDb = makeDb({ claimRows: [], updateReturningRows: () => [] }).db;
      await expect(processStripeEvent(makeEvent("evt_processed_paid", "invoice.paid", paidInvoice), duplicateDb)).resolves.toBe("duplicate");
      expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    });
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

    it("charge.dispute.closed restores exactly what the dispute clawed when won", async () => {
      const { db, calls } = makeDb({
        selectRows: (table, idx) => {
          if (table !== "creditTransactions") return [];
          // 0: purchase lookup, 1: this dispute's clawback rows, 2: counter read
          if (idx === 0) return [PURCHASE];
          if (idx === 1) return [{ amount: -100 }];
          return [{ clawedBackCredits: 100 }];
        },
      });

      const result = await processStripeEvent(
        makeEvent("evt_dp_closed_won", "charge.dispute.closed", {
          id: "dp_1",
          status: "won",
          payment_intent: "pi_1",
          charge: { id: "ch_1" },
        }),
        db
      );

      expect(result).toBe("processed");
      expect(balanceDeltaOf(calls)).toBe(100);
      const counterUpdate = calls.updates.find((u) => u.table === "creditTransactions")!;
      expect(counterUpdate.set.clawedBackCredits).toBe(0);
      const restoreTx = calls.inserts.find((i) => i.table === "creditTransactions")!;
      expect(restoreTx.values.amount).toBe(100);
      expect(restoreTx.values.type).toBe("dispute");
      expect(createNotification).toHaveBeenCalledWith(
        42,
        "payment",
        "Dispute Resolved in Your Favor",
        expect.any(String),
        expect.objectContaining({ disputeId: "dp_1", creditsRestored: 100 })
      );
    });

    it("charge.dispute.closed is a no-op when won but the dispute never clawed anything", async () => {
      const { db, calls } = makeDb({
        selectRows: (table, idx) => {
          if (table !== "creditTransactions") return [];
          if (idx === 0) return [PURCHASE];
          return []; // no clawback ledger rows for this dispute
        },
      });

      const result = await processStripeEvent(
        makeEvent("evt_dp_closed_nowon", "charge.dispute.closed", {
          id: "dp_1",
          status: "won",
          payment_intent: "pi_1",
          charge: { id: "ch_1" },
        }),
        db
      );

      expect(result).toBe("ignored");
      expect(calls.updates.some((u) => u.table === "creditBalances")).toBe(false);
      expect(
        calls.inserts.some((i) => i.table === "creditTransactions")
      ).toBe(false);
      expect(createNotification).not.toHaveBeenCalled();
    });

    it("charge.dispute.closed is a no-op when the dispute is lost", async () => {
      const { db, calls } = makeDb({
        selectRows: (table, idx) => {
          if (table !== "creditTransactions") return [];
          if (idx === 0) return [PURCHASE];
          return [{ amount: -100 }];
        },
      });

      const result = await processStripeEvent(
        makeEvent("evt_dp_closed_lost", "charge.dispute.closed", {
          id: "dp_1",
          status: "lost",
          payment_intent: "pi_1",
          charge: { id: "ch_1" },
        }),
        db
      );

      expect(result).toBe("ignored");
      expect(calls.updates.every((u) => u.table === "webhookEvents")).toBe(true);
      expect(
        calls.inserts.every((i) => i.table === "webhookEvents")
      ).toBe(true);
      expect(createNotification).not.toHaveBeenCalled();
    });
  });
});
