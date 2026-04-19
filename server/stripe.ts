import Stripe from "stripe";
import { getDb } from "./db";
import { creditBalances, creditTransactions } from "../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import { TOOL_CREDIT_COSTS } from "../shared/creditCosts";

// ─── Stripe Client (lazy init to avoid crash if key is missing) ────────────
let _stripeClient: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripeClient = new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripeClient;
}

// ─── Credit Packages ────────────────────────────────────────────────────────
export const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 100,
    price: 499, // $4.99
    priceDisplay: "$4.99",
    perCredit: "$0.05",
    popular: false,
    description: "Perfect for trying out DreamForge",
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 500,
    price: 1999, // $19.99
    priceDisplay: "$19.99",
    perCredit: "$0.04",
    popular: true,
    description: "Best value for regular creators",
  },
  {
    id: "studio",
    name: "Studio Pack",
    credits: 1500,
    price: 4999, // $49.99
    priceDisplay: "$49.99",
    perCredit: "$0.03",
    popular: false,
    description: "For professional studios and teams",
  },
  {
    id: "enterprise",
    name: "Ultimate Pack",
    credits: 5000,
    price: 14999, // $149.99
    priceDisplay: "$149.99",
    perCredit: "$0.03",
    popular: false,
    description: "Maximum credits for large-scale production",
  },
] as const;

// ─── Credit Costs per Tool ──────────────────────────────────────────────────
// Re-exported from shared/creditCosts.ts so server + client can't drift.
// For model-based generations (text-to-image, text-to-video), the actual cost
// depends on the MODEL selected (see MODEL_CREDIT_COSTS in shared/creditCosts.ts).
export const CREDIT_COSTS: Record<string, number> = TOOL_CREDIT_COSTS;

// ─── DB Helpers ─────────────────────────────────────────────────────────────
export async function getOrCreateBalance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  await db.insert(creditBalances).values({ userId, balance: 50 });
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
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const balance = await getOrCreateBalance(userId);
  if (balance.balance < amount) {
    return { success: false, balance: balance.balance, needed: amount };
  }

  // Atomic deduction — uses SQL expression so concurrent requests can't overdraw
  const result = await db
    .update(creditBalances)
    .set({
      balance: sql`GREATEST(${creditBalances.balance} - ${amount}, 0)`,
      lifetimeSpent: sql`${creditBalances.lifetimeSpent} + ${amount}`,
    })
    .where(
      and(
        eq(creditBalances.userId, userId),
        sql`${creditBalances.balance} >= ${amount}`
      )
    )
    .returning({ id: creditBalances.id });

  // If no rows were returned, balance was insufficient (race condition protection)
  if (result.length === 0) {
    return { success: false, balance: balance.balance, needed: amount };
  }

  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    type,
    description,
    metadata: metadata || null,
  });

  return { success: true, balance: balance.balance - amount, needed: amount };
}

export async function addCredits(
  userId: number,
  amount: number,
  description: string,
  stripeSessionId?: string,
  stripePaymentIntentId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await getOrCreateBalance(userId);

  await db
    .update(creditBalances)
    .set({
      balance: sql`${creditBalances.balance} + ${amount}`,
    })
    .where(eq(creditBalances.userId, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount,
    type: "purchase",
    description,
    stripeSessionId: stripeSessionId || null,
    stripePaymentIntentId: stripePaymentIntentId || null,
  });
}

export async function refundCredits(
  userId: number,
  amount: number,
  reason: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await getOrCreateBalance(userId);

  await db
    .update(creditBalances)
    .set({
      balance: sql`${creditBalances.balance} + ${amount}`,
      lifetimeSpent: sql`GREATEST(${creditBalances.lifetimeSpent} - ${amount}, 0)`,
    })
    .where(eq(creditBalances.userId, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount,
    type: "refund" as const,
    description: reason,
  });

  return { success: true, refunded: amount };
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
export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  userName: string,
  packageId: string,
  origin: string
) {
  const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error(`Invalid package: ${packageId}`);

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
            name: `DreamForge ${pkg.name}`,
            description: `${pkg.credits} generation credits`,
          },
          unit_amount: pkg.price,
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: userId.toString(),
      package_id: pkg.id,
      credits: pkg.credits.toString(),
      customer_email: userEmail,
      customer_name: userName,
    },
    success_url: `${origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}&value=${(pkg.price / 100).toFixed(2)}&currency=usd&credits=${pkg.credits}`,
    cancel_url: `${origin}/credits?canceled=true`,
  });

  return { url: session.url };
}

// Webhook handling lives in app/api/webhooks/stripe/route.ts (Next.js).
// The dead Express handler that used to be here was removed — Stripe is
// configured to POST to /api/webhooks/stripe and only that path responds.
