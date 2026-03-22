import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  subscriptionPlans,
  userSubscriptions,
  creditBalances,
  creditTransactions,
} from "../../drizzle/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { getOrCreateBalance } from "../stripe";
import { SUBSCRIPTION_PLANS, CREDIT_PACKS } from "../../shared/creditCosts";
import Stripe from "stripe";

// ─── Stripe Client ─────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia" as any,
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Ensure subscription plans exist in DB (seed on first call) */
async function ensurePlansSeeded() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).limit(1);
  if (existing.length > 0) return;

  for (const plan of SUBSCRIPTION_PLANS) {
    await db.insert(subscriptionPlans).values({
      name: plan.name,
      displayName: plan.displayName,
      price: plan.price,
      monthlyCredits: plan.monthlyCredits,
      features: plan.features as any,
      isActive: true,
    });
  }
}

async function getPlanByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  await ensurePlansSeeded();
  const rows = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, name))
    .limit(1);
  return rows[0] ?? null;
}

async function getPlanById(planId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);
  return rows[0] ?? null;
}

async function getUserSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function getStripeCustomerId(userId: number, email: string, name: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const balance = await getOrCreateBalance(userId);
  if (balance.stripeCustomerId) return balance.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId: userId.toString() },
  });

  await db
    .update(creditBalances)
    .set({ stripeCustomerId: customer.id })
    .where(eq(creditBalances.userId, userId));

  return customer.id;
}

// ─── Pricing Router ────────────────────────────────────────────────────────

export const pricingRouter = router({
  /** Get all active subscription plans */
  getPlans: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return SUBSCRIPTION_PLANS;
    await ensurePlansSeeded();
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));
    return plans;
  }),

  /** Get current user's subscription + credit balance */
  getCurrentSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const balance = await getOrCreateBalance(ctx.user.id);
    const sub = await getUserSubscription(ctx.user.id);

    let plan = null;
    if (sub) {
      plan = await getPlanById(sub.planId);
    }

    return {
      subscription: sub,
      plan,
      credits: {
        balance: balance.balance,
        monthlyAllocation: balance.monthlyAllocation,
        bonusCredits: balance.bonusCredits,
        lifetimeSpent: balance.lifetimeSpent,
        lastResetAt: balance.lastResetAt,
      },
    };
  }),

  /** Create a Stripe Checkout session for a subscription plan */
  subscribe: protectedProcedure
    .input(
      z.object({
        planName: z.enum(["creator", "pro", "studio"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await getPlanByName(input.planName);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      if (!plan.stripePriceId) {
        // Create Stripe product + price on the fly if not yet configured
        const product = await stripe.products.create({
          name: `DreamForge ${plan.displayName} Plan`,
          description: `${plan.monthlyCredits.toLocaleString()} credits/month`,
          metadata: { planId: plan.id.toString(), planName: plan.name },
        });
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.price,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { planId: plan.id.toString() },
        });

        const db = await getDb();
        if (db) {
          await db
            .update(subscriptionPlans)
            .set({ stripeProductId: product.id, stripePriceId: price.id })
            .where(eq(subscriptionPlans.id, plan.id));
        }
        plan.stripePriceId = price.id;
        plan.stripeProductId = product.id;
      }

      const customerId = await getStripeCustomerId(
        ctx.user.id,
        ctx.user.email || "",
        ctx.user.name || "User"
      );

      // Check if user already has an active subscription
      const existingSub = await getUserSubscription(ctx.user.id);
      if (existingSub && existingSub.status === "active" && existingSub.stripeSubscriptionId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an active subscription. Use changePlan to switch plans.",
        });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        client_reference_id: ctx.user.id.toString(),
        mode: "subscription",
        allow_promotion_codes: true,
        line_items: [{ price: plan.stripePriceId!, quantity: 1 }],
        metadata: {
          user_id: ctx.user.id.toString(),
          plan_id: plan.id.toString(),
          plan_name: plan.name,
        },
        subscription_data: {
          metadata: {
            user_id: ctx.user.id.toString(),
            plan_id: plan.id.toString(),
            plan_name: plan.name,
          },
        },
        success_url: `${input.origin}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/pricing?canceled=true`,
      });

      return { url: session.url };
    }),

  /** Cancel subscription at period end */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const sub = await getUserSubscription(ctx.user.id);
    if (!sub || !sub.stripeSubscriptionId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription found" });
    }

    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const db = await getDb();
    if (db) {
      await db
        .update(userSubscriptions)
        .set({ cancelAtPeriodEnd: true })
        .where(eq(userSubscriptions.id, sub.id));
    }

    return { success: true, cancelAt: sub.currentPeriodEnd };
  }),

  /** Change plan (upgrade/downgrade with Stripe proration) */
  changePlan: protectedProcedure
    .input(
      z.object({
        newPlanName: z.enum(["free", "creator", "pro", "studio"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sub = await getUserSubscription(ctx.user.id);
      if (!sub || !sub.stripeSubscriptionId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription to change. Use subscribe to start a new plan.",
        });
      }

      const newPlan = await getPlanByName(input.newPlanName);
      if (!newPlan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      // Downgrade to free = cancel
      if (input.newPlanName === "free") {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        const db = await getDb();
        if (db) {
          await db
            .update(userSubscriptions)
            .set({ cancelAtPeriodEnd: true })
            .where(eq(userSubscriptions.id, sub.id));
        }
        return { success: true, action: "downgrade_to_free" as const };
      }

      if (!newPlan.stripePriceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Plan not yet available for subscription. Contact support.",
        });
      }

      // Get current Stripe subscription to find the item ID
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const itemId = stripeSub.items.data[0]?.id;
      if (!itemId) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not find subscription item" });
      }

      // Update with proration
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: itemId, price: newPlan.stripePriceId! }],
        proration_behavior: "create_prorations",
        metadata: {
          plan_id: newPlan.id.toString(),
          plan_name: newPlan.name,
        },
      });

      const db = await getDb();
      if (db) {
        await db
          .update(userSubscriptions)
          .set({
            planId: newPlan.id,
            cancelAtPeriodEnd: false,
          })
          .where(eq(userSubscriptions.id, sub.id));

        // Update monthly allocation
        await db
          .update(creditBalances)
          .set({ monthlyAllocation: newPlan.monthlyCredits })
          .where(eq(creditBalances.userId, ctx.user.id));
      }

      return { success: true, action: "plan_changed" as const, newPlan: newPlan.name };
    }),

  /** Get current credit balance */
  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const balance = await getOrCreateBalance(ctx.user.id);
    return {
      balance: balance.balance,
      monthlyAllocation: balance.monthlyAllocation,
      bonusCredits: balance.bonusCredits,
      lifetimeSpent: balance.lifetimeSpent,
      lastResetAt: balance.lastResetAt,
    };
  }),

  /** Get paginated credit transaction history */
  getCreditHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { transactions: [], total: 0 };

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const [transactions, countResult] = await Promise.all([
        db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, ctx.user.id))
          .orderBy(desc(creditTransactions.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, ctx.user.id)),
      ]);

      return {
        transactions,
        total: Number(countResult[0]?.total ?? 0),
      };
    }),

  /** Purchase a one-time credit pack via Stripe */
  purchaseCredits: protectedProcedure
    .input(
      z.object({
        packId: z.string(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Credit pack not found" });

      const customerId = await getStripeCustomerId(
        ctx.user.id,
        ctx.user.email || "",
        ctx.user.name || "User"
      );

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        client_reference_id: ctx.user.id.toString(),
        mode: "payment",
        allow_promotion_codes: true,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `DreamForge ${pack.name}`,
                description: `${pack.credits.toLocaleString()} generation credits`,
              },
              unit_amount: pack.price,
            },
            quantity: 1,
          },
        ],
        metadata: {
          user_id: ctx.user.id.toString(),
          pack_id: pack.id,
          credits: pack.credits.toString(),
          type: "credit_pack",
        },
        success_url: `${input.origin}/pricing?credit_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${input.origin}/pricing?canceled=true`,
      });

      return { url: session.url };
    }),

  /** Get available credit packs for one-time purchase */
  getCreditPacks: publicProcedure.query(() => {
    return CREDIT_PACKS;
  }),
});

// ─── Exported Helpers for Webhook Use ──────────────────────────────────────

/** Activate a subscription after Stripe confirms it */
export async function activateSubscription(
  userId: number,
  planId: number,
  stripeSubscriptionId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const plan = await getPlanById(planId);
  if (!plan) throw new Error(`Plan ${planId} not found`);

  // Upsert user subscription
  const existing = await getUserSubscription(userId);
  if (existing) {
    await db
      .update(userSubscriptions)
      .set({
        planId,
        stripeSubscriptionId,
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .where(eq(userSubscriptions.id, existing.id));
  } else {
    await db.insert(userSubscriptions).values({
      userId,
      planId,
      stripeSubscriptionId,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  }

  // Allocate monthly credits
  await db
    .update(creditBalances)
    .set({
      balance: sql`${creditBalances.balance} + ${plan.monthlyCredits}`,
      monthlyAllocation: plan.monthlyCredits,
      lastResetAt: new Date(),
    })
    .where(eq(creditBalances.userId, userId));

  // Record the transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: plan.monthlyCredits,
    type: "subscription",
    description: `${plan.displayName} plan — monthly credit allocation`,
    metadata: { planId, planName: plan.name, stripeSubscriptionId },
  });
}

/** Handle subscription update (plan change) */
export async function handleSubscriptionUpdated(
  stripeSubscriptionId: string,
  planName: string,
  status: string,
  periodStart: Date,
  periodEnd: Date
) {
  const db = await getDb();
  if (!db) return;

  // Find the subscription in our DB
  const subs = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subs[0]) return;
  const sub = subs[0];

  const plan = await getPlanByName(planName);
  const statusMap: Record<string, "active" | "canceled" | "past_due" | "trialing" | "incomplete"> = {
    active: "active",
    canceled: "canceled",
    past_due: "past_due",
    trialing: "trialing",
    incomplete: "incomplete",
  };

  const updateData: Record<string, any> = {
    status: statusMap[status] || "active",
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  };
  if (plan) updateData.planId = plan.id;

  await db
    .update(userSubscriptions)
    .set(updateData)
    .where(eq(userSubscriptions.id, sub.id));

  // Update monthly allocation if plan changed
  if (plan) {
    await db
      .update(creditBalances)
      .set({ monthlyAllocation: plan.monthlyCredits })
      .where(eq(creditBalances.userId, sub.userId));
  }
}

/** Handle subscription cancellation */
export async function handleSubscriptionDeleted(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return;

  const subs = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subs[0]) return;
  const sub = subs[0];

  await db
    .update(userSubscriptions)
    .set({ status: "canceled" })
    .where(eq(userSubscriptions.id, sub.id));

  // Reset monthly allocation to free tier
  const freePlan = await getPlanByName("free");
  const freeCredits = freePlan?.monthlyCredits ?? 1500;

  await db
    .update(creditBalances)
    .set({ monthlyAllocation: freeCredits })
    .where(eq(creditBalances.userId, sub.userId));
}

/** Monthly credit reset on invoice payment */
export async function handleMonthlyReset(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return;

  const subs = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!subs[0]) return;
  const sub = subs[0];

  const plan = await getPlanById(sub.planId);
  if (!plan) return;

  // Reset balance to monthly allocation (keep bonus credits separate)
  const balance = await getOrCreateBalance(sub.userId);

  await db
    .update(creditBalances)
    .set({
      balance: sql`${plan.monthlyCredits} + ${creditBalances.bonusCredits}`,
      monthlyAllocation: plan.monthlyCredits,
      lastResetAt: new Date(),
    })
    .where(eq(creditBalances.userId, sub.userId));

  // Record transaction
  await db.insert(creditTransactions).values({
    userId: sub.userId,
    amount: plan.monthlyCredits,
    type: "subscription",
    description: `Monthly credit reset — ${plan.displayName} plan`,
    metadata: { planId: plan.id, planName: plan.name },
  });
}
