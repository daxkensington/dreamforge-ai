// @ts-nocheck — Express type augmentations don't resolve in Vercel's serverless compiler
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
// For model-based generations (text-to-image, text-to-video), the actual cost
// is determined by the MODEL selected (see MODEL_CREDIT_COSTS in shared/creditCosts.ts).
// These are fallback/default costs for tool-based operations.
export const CREDIT_COSTS: Record<string, number> = {
  "text-to-image": 5,
  "image-to-image": 5,
  "text-to-video": 50,
  "image-to-video": 40,
  "background-remove": 5,
  "background-edit": 5,
  "style-transfer": 10,
  "face-enhance": 5,
  "color-grade": 5,
  "super-resolution": 10,
  "object-remove": 10,
  "sketch-to-image": 10,
  "image-merge": 10,
  "texture-gen": 5,
  "panorama": 15,
  "animate": 40,
  storyboard: 15,
  "scene-director": 10,
  "video-style-transfer": 15,
  "video-upscaler": 15,
  "soundtrack-suggest": 5,
  "text-to-video-script": 5,
  "prompt-assist": 0,
  "ai-refine": 5,
  "model-compare": 15,
  "photo-restore": 10,
  "headshot": 10,
  "logo-maker": 10,
  "wallpaper": 5,
  "qr-art": 10,
  "vectorize": 5,
  "nl-edit": 5,
  "avatar": 10,
  "product-photo": 10,
  "image-caption": 0,
  "text-to-speech": 8,
  "audio-enhance": 5,
  "sound-effects": 4,
  "hdr-enhance": 5,
  "transparent-png": 5,
  "icon-gen": 5,
  "batch-prompts": 5,
  "music-gen": 6,
  "mockup": 5,
  "social-resize": 5,
  "depth-map": 5,
  "character-sheet": 15,
  "meme": 5,
  "interior-design": 10,
  "thumbnail": 5,
  "collage": 10,
  "film-grain": 5,
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
        event = getStripeClient().webhooks.constructEvent(
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
