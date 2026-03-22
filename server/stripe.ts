import Stripe from "stripe";
import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { createNotification } from "./routersPhase15";
import { creditBalances, creditTransactions, webhookEvents } from "../drizzle/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  activateSubscription,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleMonthlyReset,
} from "./routers/pricing";

// ─── Stripe Client ─────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia" as any,
});

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
    name: "Enterprise Pack",
    credits: 5000,
    price: 14999, // $149.99
    priceDisplay: "$149.99",
    perCredit: "$0.03",
    popular: false,
    description: "Maximum credits for large-scale production",
  },
] as const;

// ─── Credit Costs per Tool ──────────────────────────────────────────────────
export const CREDIT_COSTS: Record<string, number> = {
  "text-to-image": 1,
  "image-to-image": 1,
  "text-to-video": 5,
  "image-to-video": 5,
  "background-remove": 1,
  "background-edit": 1,
  "style-transfer": 2,
  "face-enhance": 1,
  "color-grade": 1,
  "super-resolution": 2,
  "object-remove": 2,
  "sketch-to-image": 2,
  "image-merge": 2,
  "texture-gen": 1,
  "panorama": 3,
  "animate": 3,
  storyboard: 3,
  "scene-director": 2,
  "video-style-transfer": 3,
  "video-upscaler": 3,
  "soundtrack-suggest": 1,
  "text-to-video-script": 1,
  "prompt-assist": 0,
  "ai-refine": 1,
  "model-compare": 3,
};

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
    );

  // If no rows were updated, balance was insufficient (race condition protection)
  if ((result as any)[0]?.affectedRows === 0) {
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
    const customer = await stripe.customers.create({
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

  const session = await stripe.checkout.sessions.create({
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
    success_url: `${origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/credits?canceled=true`,
  });

  return { url: session.url };
}

// ─── Webhook Handler ────────────────────────────────────────────────────────
export function registerStripeWebhook(app: Express) {
  // MUST be registered BEFORE express.json() middleware
  app.post(
    "/api/stripe/webhook",
    express_raw(),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!sig || !webhookSecret) {
        return res.status(400).json({ error: "Missing signature or secret" });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return res.status(400).json({ error: "Webhook signature verification failed" });
      }

      // Handle test events — only accept in non-production environments
      if (event.id.startsWith("evt_test_")) {
        if (process.env.NODE_ENV === "production") {
          console.warn("[Stripe Webhook] Rejecting test event in production:", event.id);
          return res.status(403).json({ error: "Test events not allowed in production" });
        }
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      // Log the webhook event
      const logWebhookEvent = async (status: "processed" | "failed" | "ignored", summary: string, errorMsg?: string) => {
        try {
          const db = await getDb();
          if (db) {
            await db.insert(webhookEvents).values({
              eventId: event.id,
              eventType: event.type,
              status,
              summary,
              errorMessage: errorMsg || null,
            });
          }
        } catch (logErr) {
          console.error("[Stripe Webhook] Failed to log event:", logErr);
        }
      };

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = parseInt(session.metadata?.user_id || "0");
            const credits = parseInt(session.metadata?.credits || "0");
            const packageId = session.metadata?.package_id || "";

            if (userId && credits) {
              await addCredits(
                userId,
                credits,
                `Purchased ${packageId} pack (${credits} credits)`,
                session.id,
                session.payment_intent as string
              );
              console.log(
                `[Stripe Webhook] Added ${credits} credits to user ${userId}`
              );
              // Notify user about successful payment
              try {
                await createNotification(
                  userId,
                  "payment",
                  "Payment Successful",
                  `Your purchase of ${credits} credits has been confirmed. Happy creating!`,
                  { credits, packageId, sessionId: session.id }
                );
              } catch {}
            }
            break;
          }

          case "payment_intent.succeeded": {
            console.log(`[Stripe Webhook] Payment succeeded: ${event.data.object.id}`);
            await logWebhookEvent("processed", `Payment intent succeeded: ${event.data.object.id}`);
            break;
          }

          // ─── Subscription Events ────────────────────────────────────
          case "customer.subscription.created": {
            const sub = event.data.object as Stripe.Subscription;
            const userId = parseInt(sub.metadata?.user_id || "0");
            const planId = parseInt(sub.metadata?.plan_id || "0");

            if (userId && planId) {
              await activateSubscription(
                userId,
                planId,
                sub.id,
                new Date((sub as any).current_period_start * 1000),
                new Date((sub as any).current_period_end * 1000)
              );
              console.log(`[Stripe Webhook] Subscription created for user ${userId}, plan ${sub.metadata?.plan_name}`);
              try {
                await createNotification(
                  userId,
                  "payment",
                  "Subscription Active",
                  `Your ${sub.metadata?.plan_name || "new"} plan is now active. Credits have been allocated!`,
                  { planId, subscriptionId: sub.id }
                );
              } catch {}
              await logWebhookEvent("processed", `Subscription created for user ${userId}, plan ${planId}`);
            }
            break;
          }

          case "customer.subscription.updated": {
            const sub = event.data.object as Stripe.Subscription;
            const planName = sub.metadata?.plan_name || "";
            await handleSubscriptionUpdated(
              sub.id,
              planName,
              sub.status,
              new Date((sub as any).current_period_start * 1000),
              new Date((sub as any).current_period_end * 1000)
            );
            console.log(`[Stripe Webhook] Subscription updated: ${sub.id} → ${sub.status}`);
            await logWebhookEvent("processed", `Subscription updated: ${sub.id}, status=${sub.status}, plan=${planName}`);
            break;
          }

          case "customer.subscription.deleted": {
            const sub = event.data.object as Stripe.Subscription;
            await handleSubscriptionDeleted(sub.id);
            const userId = parseInt(sub.metadata?.user_id || "0");
            if (userId) {
              try {
                await createNotification(
                  userId,
                  "payment",
                  "Subscription Canceled",
                  "Your subscription has been canceled. You've been moved to the Free plan.",
                  { subscriptionId: sub.id }
                );
              } catch {}
            }
            console.log(`[Stripe Webhook] Subscription deleted: ${sub.id}`);
            await logWebhookEvent("processed", `Subscription deleted: ${sub.id}`);
            break;
          }

          case "invoice.payment_succeeded": {
            const invoice = event.data.object as any;
            const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
            // Only handle renewal invoices (not the first one, which is handled by subscription.created)
            if (subId && invoice.billing_reason === "subscription_cycle") {
              await handleMonthlyReset(subId);
              console.log(`[Stripe Webhook] Monthly credit reset for subscription ${subId}`);
              await logWebhookEvent("processed", `Monthly credit reset for subscription ${subId}`);
            } else {
              await logWebhookEvent("processed", `Invoice payment succeeded: ${invoice.id}`);
            }
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
            await logWebhookEvent("ignored", `Unhandled event type: ${event.type}`);
        }
        // Log successful processing for checkout events not already logged
        if (event.type === "checkout.session.completed") {
          const session = event.data.object as any;
          await logWebhookEvent("processed", `Checkout completed for user ${session.metadata?.user_id}, ${session.metadata?.credits || 'subscription'}`);
        }
      } catch (err: any) {
        console.error("[Stripe Webhook] Error processing event:", err.message);
        await logWebhookEvent("failed", `Error processing ${event.type}`, err.message);
        return res.status(500).json({ error: "Webhook processing error" });
      }

      res.json({ received: true });
    }
  );
}

// Helper to get raw body for webhook signature verification
function express_raw() {
  return (req: Request, _res: Response, next: Function) => {
    // Body is already raw when express.json() hasn't parsed it yet
    // We need to collect the raw body
    if (req.headers["content-type"] === "application/json") {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        (req as any).body = Buffer.from(data);
        next();
      });
    } else {
      next();
    }
  };
}
