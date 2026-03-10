import Stripe from "stripe";
import { Express, Request, Response } from "express";
import { getDb } from "./db";
import { createNotification } from "./routersPhase15";
import { creditBalances, creditTransactions, webhookEvents } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

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
  description: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const balance = await getOrCreateBalance(userId);
  if (balance.balance < amount) {
    return { success: false, balance: balance.balance, needed: amount };
  }

  await db
    .update(creditBalances)
    .set({
      balance: sql`${creditBalances.balance} - ${amount}`,
      lifetimeSpent: sql`${creditBalances.lifetimeSpent} + ${amount}`,
    })
    .where(eq(creditBalances.userId, userId));

  await db.insert(creditTransactions).values({
    userId,
    amount: -amount,
    type: "usage",
    description,
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

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
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
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
            await logWebhookEvent("ignored", `Unhandled event type: ${event.type}`);
        }
        // Log successful processing (for handled events)
        if (event.type !== "payment_intent.succeeded" && event.type.startsWith("checkout.")) {
          const session = event.data.object as any;
          await logWebhookEvent("processed", `Checkout completed for user ${session.metadata?.user_id}, ${session.metadata?.credits} credits`);
        } else if (event.type === "payment_intent.succeeded") {
          await logWebhookEvent("processed", `Payment intent succeeded: ${(event.data.object as any).id}`);
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
