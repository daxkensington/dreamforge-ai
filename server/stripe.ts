import Stripe from "stripe";
import { getDb } from "./db";
import { creditBalances, creditTransactions } from "../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { CREDIT_PACKS, TOOL_CREDIT_COSTS, creditPackCheckoutMetadata, resolveCreditPack, type CreditPackId } from "../shared/creditCosts";
import { TIERS } from "../shared/tiers";
import { debitWallet, grantWalletCredits, refundWallet } from "./_core/walletAccounting";
import { refreshPaidSubscriptionAllowance } from "./_core/subscriptionBilling";

// ─── Stripe Client (lazy init to avoid crash if key is missing) ────────────
let _stripeClient: Stripe | null = null;
export function getStripeClient(): Stripe {
  if (!_stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripeClient = new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripeClient;
}

// ─── Credit Packages ────────────────────────────────────────────────────────
// The /credits page sells the SAME one-time packs as /pricing, /uncensored and
// llms.txt. Credits and prices come from CREDIT_PACKS; this adds only the copy
// the /credits cards show. It used to be its own table, and sold a fifth of
// the credits for the same four prices (see LEGACY_CREDIT_PACKAGES).
const PACKAGE_COPY: Record<CreditPackId, { name: string; description: string; popular: boolean }> = {
  "pack-500": { name: "Starter Pack", description: "Perfect for trying out DreamForgeX", popular: false },
  "pack-2500": { name: "Creator Pack", description: "Best value for regular creators", popular: true },
  "pack-7500": { name: "Studio Pack", description: "For professional studios and teams", popular: false },
  "pack-25000": { name: "Ultimate Pack", description: "Maximum credits for large-scale production", popular: false },
};

export const CREDIT_PACKAGES = CREDIT_PACKS.map((pack) => ({
  id: pack.id,
  credits: pack.credits,
  price: pack.price,
  priceDisplay: `$${(pack.price / 100).toFixed(2)}`,
  perCredit: pack.perCredit,
  ...PACKAGE_COPY[pack.id],
}));

// ─── Credit Costs per Tool ──────────────────────────────────────────────────
// Re-exported from shared/creditCosts.ts so server + client can't drift.
// For model-based generations (text-to-image, text-to-video), the actual cost
// depends on the MODEL selected (see MODEL_CREDIT_COSTS in shared/creditCosts.ts).
export const CREDIT_COSTS: Record<string, number> = TOOL_CREDIT_COSTS;

// ─── Daily free credits ─────────────────────────────────────────────────────
/** What the free tier is entitled to each day — the number /pricing advertises. */
export const DAILY_FREE_CREDITS = TIERS.free.dailyCreditsForFree;

/**
 * Top a free user back up to their daily allowance.
 *
 * `dailyCreditsForFree: 50` had been declared in shared/tiers.ts and advertised
 * on /pricing as "50 credits / day (~1,500/mo)" since launch, but nothing ever
 * read it and no reset job existed: `lastResetAt` was NULL on all 73 balances,
 * so a free account got 50 credits ONCE — about ten images — and then hit a
 * permanent wall. The users who hit it were, by definition, the engaged ones.
 *
 * Done as a lazy top-up at the balance choke point rather than a cron: it needs
 * no schedule, costs nothing for dormant accounts, and a returning user is
 * current the moment they ask — no waiting for the next tick.
 *
 * One idempotent statement, so concurrent requests can't double-grant:
 *   - GREATEST(...) tops UP to the allowance and never takes credits away, so
 *     purchased packs, winback bonuses and pass credits above it are preserved.
 *   - The date comparison is done entirely in SQL and pinned to UTC on both
 *     sides. `lastResetAt` is a naive `timestamp`, and comparing one of those
 *     against a JS Date reads it in the caller's zone — which would hand a
 *     second grant to anyone west of UTC.
 *   - Paid subscribers are excluded: they draw on monthlyAllocation instead.
 */
async function applyDailyFreeCredits(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (DAILY_FREE_CREDITS <= 0) return;

  await db.execute(sql`
    UPDATE "creditBalances" cb
       SET balance = GREATEST(cb.balance, ${DAILY_FREE_CREDITS}),
           "lastResetAt" = (now() AT TIME ZONE 'UTC')
     WHERE cb."userId" = ${userId}
       AND (
         cb."lastResetAt" IS NULL
         OR cb."lastResetAt" < date_trunc('day', now() AT TIME ZONE 'UTC')
       )
       AND NOT EXISTS (
         SELECT 1 FROM "userSubscriptions" us JOIN "subscriptionPlans" sp ON sp.id = us."planId"
          WHERE us."userId" = cb."userId"
            AND sp.name IN ('creator', 'pro', 'studio', 'business', 'agency', 'enterprise')
            AND us."subStatus" IN ('active', 'trialing')
            AND us."currentPeriodStart" IS NOT NULL
            AND us."currentPeriodEnd" IS NOT NULL
            AND us."currentPeriodStart" <= (now() AT TIME ZONE 'UTC')
            AND us."currentPeriodEnd" > (now() AT TIME ZONE 'UTC')
       )
  `);
}

// ─── DB Helpers ─────────────────────────────────────────────────────────────
export async function getOrCreateBalance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    // Refill before anyone reads or spends this balance.
    if (existing[0].walletAccountingVersion === 1 && existing[0].monthlyAllocation > 0) {
      await refreshPaidSubscriptionAllowance(userId);
    }
    await applyDailyFreeCredits(userId);
    const refreshed = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);
    return refreshed[0] ?? existing[0];
  }

  await db.insert(creditBalances).values({
    userId,
    balance: DAILY_FREE_CREDITS,
    walletAccountingVersion: 1,
    lastResetAt: sql`(now() AT TIME ZONE 'UTC')` as any,
  }).onConflictDoNothing({ target: creditBalances.userId });
  const created = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);
  return created[0];
}

export async function deductCredits(
  userId: number,
  amount: number,
  description: string,
  type: "usage" | "purchase" | "bonus" | "refund" | "subscription" | "reward" | "referral" = "usage",
  metadata?: Record<string, any>
) {
  const balance = await getOrCreateBalance(userId);
  const result = await debitWallet(userId, amount, description, type, metadata);
  return result.success ? result : { ...result, balance: balance.balance };
}

export async function addCredits(
  userId: number, amount: number, description: string, stripeSessionId?: string,
  stripePaymentIntentId?: string, options?: { bonus?: boolean }
) {
  await getOrCreateBalance(userId);
  return grantWalletCredits({ userId, amount, description, sessionId: stripeSessionId, paymentIntentId: stripePaymentIntentId,
    purchased: options?.bonus ?? Boolean(stripeSessionId || stripePaymentIntentId) });
}

export async function refundCredits(
  userId: number, amount: number, reason: string,
  options?: { purchasedCredits?: number; operationKey?: string }
) {
  await getOrCreateBalance(userId);
  return refundWallet(userId, amount, reason, options);
}

export async function getCreditHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(sql`${creditTransactions.createdAt} DESC`)
    .limit(limit);
}

// ─── Checkout Session ───────────────────────────────────────────────────────

/**
 * Validate a client-supplied redirect origin against an allowlist before it is
 * interpolated into Stripe success/cancel URLs (open redirect + session-id
 * leak). Never rejects the purchase — a mismatch falls back to APP_URL's
 * origin, or the canonical production origin when APP_URL is unset.
 *
 * Allowed hosts: APP_URL's host (if set), the request's own Origin/Host
 * (passed in from ctx when available), and localhost dev servers when not in
 * production.
 */
export function sanitizeRedirectOrigin(origin: string, requestOrigin?: string | null): string {
  const allowedHosts = new Set<string>();
  if (process.env.APP_URL) {
    try {
      allowedHosts.add(new URL(process.env.APP_URL).host);
    } catch {
      // APP_URL malformed — treat as unset rather than crash checkout.
    }
  }
  if (requestOrigin) {
    try {
      allowedHosts.add(new URL(requestOrigin).host);
    } catch {
      // ignore malformed request origin
    }
  }
  if (process.env.NODE_ENV !== "production") {
    allowedHosts.add("localhost:3000");
    allowedHosts.add("127.0.0.1:3000");
  }

  try {
    const parsed = new URL(origin);
    if (allowedHosts.has(parsed.host)) {
      return parsed.origin;
    }
  } catch {
    // not a URL — fall through to the fallback
  }

  if (process.env.APP_URL) {
    try {
      return new URL(process.env.APP_URL).origin;
    } catch {
      // fall through
    }
  }
  return "https://dreamforgex.ai";
}

/** Best-effort extraction of the caller's Origin/Host from a tRPC ctx object. */
export function requestOriginFromCtx(ctx: unknown): string | null {
  const headers: any = (ctx as any)?.req?.headers;
  const raw: unknown = headers?.origin ?? headers?.host;
  if (typeof raw !== "string" || !raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
}

export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  userName: string,
  packageId: string,
  origin: string
) {
  // Accepts a CREDIT_PACKS id, or a retired /credits id from a tab that was
  // open across the deploy (it resolves to the pack with the same price).
  const pack = resolveCreditPack(packageId);
  if (!pack) throw new Error(`Invalid package: ${packageId}`);
  const pkg = CREDIT_PACKAGES.find((p) => p.id === pack.id)!;
  origin = sanitizeRedirectOrigin(origin);

  // Get or create Stripe customer
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const balance = await getOrCreateBalance(userId);
  let customerId = balance.stripeCustomerId;

  if (!customerId) {
    const customer = await getStripeClient().customers.create({
      email: userEmail,
      name: userName,
      metadata: { userId: userId.toString() },
    });
    customerId = customer.id;
    await db
      .update(creditBalances)
      .set({ stripeCustomerId: customerId })
      .where(eq(creditBalances.userId, userId));
  }

  const session = await getStripeClient().checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId.toString(),
    customer_email: undefined, // already set on customer
    mode: "payment",
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `DreamForgeX ${pkg.name}`,
            description: `${pkg.credits.toLocaleString("en-US")} generation credits`,
            metadata: { dreamforge_type: "credit_pack", pack_id: pack.id, credits: String(pack.credits) },
          },
          unit_amount: pkg.price,
        },
        quantity: 1,
      },
    ],
    // Same metadata as pricing.purchaseCredits: one format, one webhook branch.
    metadata: creditPackCheckoutMetadata(userId, pack),
    success_url: `${origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}&value=${(pkg.price / 100).toFixed(2)}&currency=usd&credits=${pkg.credits}`,
    cancel_url: `${origin}/credits?canceled=true`,
  });

  return { url: session.url };
}

// Webhook handling lives in app/api/webhooks/stripe/route.ts (Next.js).
// The dead Express handler that used to be here was removed — Stripe is
// configured to POST to /api/webhooks/stripe and only that path responds.

/** Cancel every billable subscription; deletion must surface incomplete cancellation. */
export async function cancelStripeSubscriptionsForCustomer(customerId: string): Promise<void> {
  if (!/^cus_[A-Za-z0-9_]+$/.test(customerId)) throw new Error("Invalid billing customer.");
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Billing cancellation is unavailable. Please retry account deletion later.");
  const stripe = getStripeClient();
  let startingAfter: string | undefined;
  do {
    const page = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) });
    for (const sub of page.data) {
      if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
      await stripe.subscriptions.cancel(sub.id);
    }
    if (!page.has_more) return;
    const lastId = page.data.at(-1)?.id;
    if (!lastId || lastId === startingAfter) throw new Error("Billing cancellation could not verify all subscriptions.");
    startingAfter = lastId;
  } while (startingAfter);
}
