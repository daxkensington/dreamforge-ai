import { vi, describe, it, expect, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Stripe SDK — instances expose the hoisted fns the router calls.
const stripeMocks = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  customersCreate: vi.fn(),
  productsCreate: vi.fn(),
  pricesList: vi.fn(),
  pricesCreate: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsUpdate: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class StripeMock {
    checkout = { sessions: { create: stripeMocks.checkoutSessionsCreate } };
    customers = { create: stripeMocks.customersCreate };
    products = { create: stripeMocks.productsCreate };
    prices = { list: stripeMocks.pricesList, create: stripeMocks.pricesCreate };
    subscriptions = {
      retrieve: stripeMocks.subscriptionsRetrieve,
      update: stripeMocks.subscriptionsUpdate,
    };
  },
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

// Partial mock: keep the real addCredits / createCheckoutSession /
// sanitizeRedirectOrigin under test; only stub the balance lookup.
vi.mock("./stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe")>();
  return {
    ...actual,
    getOrCreateBalance: vi.fn(),
  };
});

import { getDb } from "./db";
import { addCredits, createCheckoutSession, getOrCreateBalance, sanitizeRedirectOrigin, CREDIT_PACKAGES } from "./stripe";
import { pricingRouter, handleMonthlyReset, handleSubscriptionUpdated } from "./routers/pricing";
import { SUBSCRIPTION_PLANS, CREDIT_PACKS } from "../shared/creditCosts";

// ─── Fixtures / helpers ─────────────────────────────────────────────────────

const user = {
  id: 1,
  openId: "user-1",
  name: "Test User",
  email: "test@dreamforge.ai",
  role: "user" as const,
  createdAt: new Date(),
};

function makeCtx(origin = "http://localhost:3000") {
  return {
    user,
    session: null,
    ip: "127.0.0.1",
    req: { headers: { origin } },
  } as any;
}

const caller = pricingRouter.createCaller(makeCtx());

/** Chainable drizzle mock. Captures set/where/values; resolves queued rows. */
function makeDb(opts: { selectQueue?: any[][]; updateReturningQueue?: any[][] } = {}) {
  const captured = {
    sets: [] as any[],
    wheres: [] as any[],
    values: [] as any[],
    updateCount: 0,
    insertCount: 0,
  };
  const db: any = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => {
      const c: any = {};
      c.from = vi.fn(() => c);
      c.where = vi.fn(() => c);
      c.orderBy = vi.fn(() => c);
      c.offset = vi.fn(() => c);
      c.limit = vi.fn(() => Promise.resolve(opts.selectQueue?.shift() ?? []));
      return c;
    }),
    update: vi.fn(() => {
      captured.updateCount++;
      const c: any = {};
      c.set = vi.fn((s: any) => {
        captured.sets.push(s);
        return c;
      });
      c.where = vi.fn((w: any) => {
        captured.wheres.push(w);
        return c;
      });
      c.returning = vi.fn(() => Promise.resolve(opts.updateReturningQueue?.shift() ?? []));
      return c;
    }),
    insert: vi.fn(() => {
      captured.insertCount++;
      const c: any = {};
      c.values = vi.fn((v: any) => {
        captured.values.push(v);
        return c;
      });
      c.returning = vi.fn(() => Promise.resolve([{ id: 1 }]));
      c.onConflictDoUpdate = vi.fn(() => Promise.resolve());
      return c;
    }),
  };
  return { db, captured };
}

/** Best-effort flattening of drizzle SQL fragments (queryChunks-based build). */
function sqlText(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(sqlText).join("");
  if (x.queryChunks) return x.queryChunks.map(sqlText).join("");
  if (typeof x.value === "string") return x.value; // StringChunk
  if (Array.isArray(x.value)) return x.value.join("");
  if (x.name) return String(x.name); // column ref
  return "";
}

function installDb(db: any) {
  (getDb as any).mockResolvedValue(db);
}

const planRow = (name: string) => {
  const shared = SUBSCRIPTION_PLANS.find((p) => p.name === name)!;
  return {
    id: 2,
    name: shared.name,
    displayName: shared.displayName,
    price: shared.price,
    monthlyCredits: shared.monthlyCredits,
    stripeProductId: `prod_${name}`,
    stripePriceId: `price_${name}_month`,
    isActive: true,
  };
};

const balanceRow = {
  id: 1,
  userId: 1,
  balance: 800,
  bonusCredits: 300,
  monthlyAllocation: 3000,
  lifetimeSpent: 0,
  stripeCustomerId: "cus_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = "sk_test_123";
  process.env.APP_URL = "https://app.dreamforge.ai";
  stripeMocks.pricesList.mockResolvedValue({
    data: [
      { id: "price_creator_month", recurring: { interval: "month" }, unit_amount: 900, currency: "usd" },
      { id: "price_creator_year", recurring: { interval: "year" }, unit_amount: 8600, currency: "usd" },
    ],
  });
  vi.mocked(getOrCreateBalance).mockResolvedValue(balanceRow as any);
});

// ─── P0.2 — pack-credit carryover ───────────────────────────────────────────

describe("addCredits bonus tracking (P0.2)", () => {
  it("increments bonusCredits for a purchased pack (stripe session id present)", async () => {
    const { db, captured } = makeDb({ selectQueue: [[balanceRow], [balanceRow]] });
    installDb(db);

    await addCredits(1, 500, "Purchased pack-500 pack (500 credits)", "cs_test_1", "pi_test_1");

    const setArg = captured.sets[captured.sets.length - 1];
    expect(setArg).toHaveProperty("balance");
    expect(setArg).toHaveProperty("bonusCredits");
    // Both are SQL increments of 500.
    expect(sqlText(setArg.balance)).toContain("+");
    expect(sqlText(setArg.bonusCredits)).toContain("+");
    // Ledger row still written as a purchase.
    expect(captured.values[0]).toMatchObject({ amount: 500, type: "purchase" });
  });

  it("does NOT increment bonusCredits for referral/signup-style grants", async () => {
    const { db, captured } = makeDb({ selectQueue: [[balanceRow], [balanceRow]] });
    installDb(db);

    await addCredits(1, 15, "Referral bonus — a friend joined via your link");

    const setArg = captured.sets[captured.sets.length - 1];
    expect(setArg).toHaveProperty("balance");
    expect(setArg).not.toHaveProperty("bonusCredits");
  });

  it("honours the explicit bonus option override", async () => {
    const { db, captured } = makeDb({ selectQueue: [[balanceRow], [balanceRow]] });
    installDb(db);

    await addCredits(1, 15, "Manual grant", undefined, undefined, { bonus: true });
    expect(captured.sets[captured.sets.length - 1]).toHaveProperty("bonusCredits");

    await addCredits(1, 15, "Not a bonus", "cs_x", "pi_x", { bonus: false });
    expect(captured.sets[captured.sets.length - 1]).not.toHaveProperty("bonusCredits");
  });
});

describe("handleMonthlyReset (P0.2)", () => {
  it("folds bonusCredits into balance and then zeroes the counter", async () => {
    const plan = planRow("pro");
    const { db, captured } = makeDb({
      selectQueue: [
        [{ id: 9, userId: 1, planId: 2, stripeSubscriptionId: "sub_1" }],
        [plan],
      ],
    });
    installDb(db);
    vi.mocked(getOrCreateBalance).mockResolvedValue({ ...balanceRow, bonusCredits: 750 } as any);

    await handleMonthlyReset("sub_1");

    const setArg = captured.sets[captured.sets.length - 1];
    // Balance rebuilt as plan credits + bonusCredits…
    expect(sqlText(setArg.balance)).toContain("bonusCredits");
    expect(sqlText(setArg.balance)).toContain(String(plan.monthlyCredits));
    // …and the counter is zeroed so the same credits aren't re-added next reset.
    expect(setArg.bonusCredits).toBe(0);
    expect(setArg.monthlyAllocation).toBe(plan.monthlyCredits);
    // Transaction recorded for the full reset amount.
    expect(captured.values[0]).toMatchObject({
      userId: 1,
      amount: plan.monthlyCredits,
      type: "subscription",
    });
  });
});

// ─── P0.6a — Meta Purchase attribution ──────────────────────────────────────

describe("checkout success_url attribution (P0.6a)", () => {
  it("pricing.subscribe (month) embeds value/currency/credits and the session placeholder", async () => {
    const plan = planRow("creator");
    const { db } = makeDb({ selectQueue: [[{ id: 1 }], [plan], []] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    await caller.subscribe({
      planName: "creator",
      billingInterval: "month",
      origin: "http://localhost:3000",
    });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    const shared = SUBSCRIPTION_PLANS.find((p) => p.name === "creator")!;
    const expectedValue = (shared.price / 100).toFixed(2);
    expect(params.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(params.success_url).toContain(`value=${expectedValue}`);
    expect(params.success_url).toContain("currency=usd");
    expect(params.success_url).toContain(`credits=${shared.monthlyCredits}`);
    expect(params.success_url).toContain("/pricing?success=true");
    // cancel_url carries no attribution params.
    expect(params.cancel_url).toBe("http://localhost:3000/pricing?canceled=true");
  });

  it("pricing.subscribe (year) uses the yearly price for value", async () => {
    const plan = planRow("creator");
    const { db } = makeDb({ selectQueue: [[{ id: 1 }], [plan], []] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    await caller.subscribe({
      planName: "creator",
      billingInterval: "year",
      origin: "http://localhost:3000",
    });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    const shared = SUBSCRIPTION_PLANS.find((p) => p.name === "creator")!;
    expect(params.success_url).toContain(`value=${(shared.yearlyPrice / 100).toFixed(2)}`);
    expect(params.success_url).toContain(`credits=${shared.monthlyCredits}`);
  });

  it("pricing.purchaseCredits embeds pack value/credits against the real CREDIT_PACKS", async () => {
    const { db } = makeDb();
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    const pack = CREDIT_PACKS[0];
    await caller.purchaseCredits({ packId: pack.id, origin: "http://localhost:3000" });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    expect(params.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(params.success_url).toContain(`value=${(pack.price / 100).toFixed(2)}`);
    expect(params.success_url).toContain("currency=usd");
    expect(params.success_url).toContain(`credits=${pack.credits}`);
    expect(params.success_url).toContain("/pricing?credit_success=true");
  });

  it("credits.createCheckoutSession embeds value/currency/credits and the placeholder", async () => {
    const { db } = makeDb({ selectQueue: [[balanceRow], [balanceRow]] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    const pkg = CREDIT_PACKAGES.find((p) => p.id === "creator")!;
    await createCheckoutSession(1, "test@dreamforge.ai", "Test User", "creator", "http://localhost:3000");

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    expect(params.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(params.success_url).toContain(`value=${(pkg.price / 100).toFixed(2)}`);
    expect(params.success_url).toContain("currency=usd");
    expect(params.success_url).toContain(`credits=${pkg.credits}`);
  });
});

// ─── P1.9 — open redirect + session-id leak ─────────────────────────────────

describe("origin sanitization (P1.9)", () => {
  it("falls back to APP_URL when the client origin is not allowlisted", async () => {
    const plan = planRow("creator");
    const { db } = makeDb({ selectQueue: [[{ id: 1 }], [plan], []] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    await caller.subscribe({
      planName: "creator",
      billingInterval: "month",
      origin: "https://evil.example",
    });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    // Purchase is not rejected — the redirect target is sanitized instead.
    expect(params.success_url).toMatch(/^https:\/\/app\.dreamforge\.ai\/pricing\?success=true/);
    expect(params.success_url).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toMatch(/^https:\/\/app\.dreamforge\.ai\/pricing\?canceled=true/);
  });

  it("falls back to the canonical production origin when APP_URL is unset", async () => {
    delete process.env.APP_URL;
    const { db } = makeDb({ selectQueue: [[balanceRow], [balanceRow]] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    await createCheckoutSession(1, "test@dreamforge.ai", "Test User", "creator", "https://evil.example");

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    expect(params.success_url).toMatch(/^https:\/\/dreamforgex\.ai\/credits\?success=true/);
    expect(params.cancel_url).toMatch(/^https:\/\/dreamforgex\.ai\/credits\?canceled=true/);
  });

  it("allows the APP_URL host itself", async () => {
    const plan = planRow("creator");
    const { db } = makeDb({ selectQueue: [[{ id: 1 }], [plan], []] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    await caller.subscribe({
      planName: "creator",
      billingInterval: "month",
      origin: "https://app.dreamforge.ai",
    });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    expect(params.success_url).toMatch(/^https:\/\/app\.dreamforge\.ai\/pricing\?success=true/);
  });

  it("allows the request's own origin from ctx", async () => {
    const plan = planRow("creator");
    const { db } = makeDb({ selectQueue: [[{ id: 1 }], [plan], []] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    const ctxCaller = pricingRouter.createCaller(makeCtx("https://preview.dreamforge.ai"));
    await ctxCaller.subscribe({
      planName: "creator",
      billingInterval: "month",
      origin: "https://preview.dreamforge.ai",
    });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    expect(params.success_url).toMatch(/^https:\/\/preview\.dreamforge\.ai\/pricing\?success=true/);
  });

  it("allows localhost:3000 outside production", async () => {
    const plan = planRow("creator");
    const { db } = makeDb({ selectQueue: [[{ id: 1 }], [plan], []] });
    installDb(db);
    stripeMocks.checkoutSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/s" });

    await caller.subscribe({
      planName: "creator",
      billingInterval: "month",
      origin: "http://localhost:3000",
    });

    const params = stripeMocks.checkoutSessionsCreate.mock.calls[0][0];
    expect(params.success_url).toMatch(/^http:\/\/localhost:3000\/pricing\?success=true/);
  });

  it("rejects localhost in production (NODE_ENV=production)", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(sanitizeRedirectOrigin("http://localhost:3000")).toBe("https://app.dreamforge.ai");
      expect(sanitizeRedirectOrigin("https://app.dreamforge.ai")).toBe("https://app.dreamforge.ai");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

// ─── P1.9 follow-ups — status default + metadata merge ──────────────────────

describe("handleSubscriptionUpdated status mapping", () => {
  it("maps unknown Stripe statuses to canceled, not active", async () => {
    const { db, captured } = makeDb({
      selectQueue: [
        [{ id: 9, userId: 1, planId: 2, stripeSubscriptionId: "sub_1" }],
        [{ id: 1 }],
        [planRow("pro")],
      ],
    });
    installDb(db);

    await handleSubscriptionUpdated("sub_1", "pro", "unpaid", new Date(), new Date());

    expect(captured.sets[0].status).toBe("canceled");
  });

  it("still maps known statuses correctly", async () => {
    const { db, captured } = makeDb({
      selectQueue: [
        [{ id: 9, userId: 1, planId: 2, stripeSubscriptionId: "sub_1" }],
        [{ id: 1 }],
        [planRow("pro")],
      ],
    });
    installDb(db);

    await handleSubscriptionUpdated("sub_1", "pro", "past_due", new Date(), new Date());

    expect(captured.sets[0].status).toBe("past_due");
  });
});

describe("changePlan metadata", () => {
  it("merges metadata, preserving user_id that subscription.deleted depends on", async () => {
    const studio = { ...planRow("studio"), id: 3, stripePriceId: "price_studio_month" };
    const { db } = makeDb({
      selectQueue: [
        [{ id: 9, userId: 1, planId: 2, stripeSubscriptionId: "sub_1" }],
        [{ id: 1 }],
        [studio],
      ],
    });
    installDb(db);
    stripeMocks.subscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ id: "si_1" }] },
      metadata: {
        user_id: "1",
        plan_id: "2",
        plan_name: "creator",
        billing_interval: "month",
      },
    });
    stripeMocks.subscriptionsUpdate.mockResolvedValue({});

    const result = await caller.changePlan({ newPlanName: "studio" });

    expect(result).toEqual({ success: true, action: "plan_changed", newPlan: "studio" });
    const updateArgs = stripeMocks.subscriptionsUpdate.mock.calls[0][1];
    expect(updateArgs.metadata).toEqual({
      user_id: "1", // preserved — customer.subscription.deleted reads this
      plan_id: "3", // updated
      plan_name: "studio", // updated
      billing_interval: "month", // preserved
    });
  });
});
