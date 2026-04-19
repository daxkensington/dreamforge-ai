import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getDb } from "../../../../server/db";
import { addCredits } from "../../../../server/stripe";
import { createNotification } from "../../../../server/routersPhase15";
import {
  webhookEvents,
  creditBalances,
  creditTransactions,
  userSubscriptions,
} from "../../../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import {
  activateSubscription,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleMonthlyReset,
} from "../../../../server/routers/pricing";

// Stripe retries webhooks for up to 3 days if we don't 200 in time, so
// failing fast is better than letting an event hang. 30s is plenty for
// the heaviest handler (charge.refunded does ~3 DB queries + notify).
export const maxDuration = 30;
export const runtime = "nodejs";

// Lazy Stripe client
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripe;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Reject test events in production
  if (event.id.startsWith("evt_test_")) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[Stripe Webhook] Rejecting test event in production:", event.id);
      return NextResponse.json(
        { error: "Test events not allowed in production" },
        { status: 403 }
      );
    }
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return NextResponse.json({ verified: true });
  }

  // Idempotency check — skip if we already processed this event
  const db = await getDb();
  if (db) {
    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);
    if (existing.length > 0) {
      console.log("[Stripe Webhook] Duplicate event, skipping:", event.id);
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  // Helper to log webhook events to DB
  const logWebhookEvent = async (
    status: "processed" | "failed" | "ignored",
    summary: string,
    errorMsg?: string
  ) => {
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
      // ─── Credit Purchase ─────────────────────────────────────────
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
          // Notify user
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
        await logWebhookEvent(
          "processed",
          `Checkout completed for user ${userId}, ${credits || "subscription"} credits`
        );
        break;
      }

      // ─── Payment Intent ──────────────────────────────────────────
      case "payment_intent.succeeded": {
        console.log(`[Stripe Webhook] Payment succeeded: ${event.data.object.id}`);
        await logWebhookEvent("processed", `Payment intent succeeded: ${event.data.object.id}`);
        break;
      }

      // ─── Subscription Created ────────────────────────────────────
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
          console.log(
            `[Stripe Webhook] Subscription created for user ${userId}, plan ${sub.metadata?.plan_name}`
          );
          try {
            await createNotification(
              userId,
              "payment",
              "Subscription Active",
              `Your ${sub.metadata?.plan_name || "new"} plan is now active. Credits have been allocated!`,
              { planId, subscriptionId: sub.id }
            );
          } catch {}
        }
        await logWebhookEvent(
          "processed",
          `Subscription created for user ${userId}, plan ${planId}`
        );
        break;
      }

      // ─── Subscription Updated ────────────────────────────────────
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
        await logWebhookEvent(
          "processed",
          `Subscription updated: ${sub.id}, status=${sub.status}, plan=${planName}`
        );
        break;
      }

      // ─── Subscription Deleted ────────────────────────────────────
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

      // ─── Invoice / Monthly Reset ─────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId && invoice.billing_reason === "subscription_cycle") {
          await handleMonthlyReset(subId);
          console.log(`[Stripe Webhook] Monthly credit reset for subscription ${subId}`);
          await logWebhookEvent("processed", `Monthly credit reset for subscription ${subId}`);
        } else {
          await logWebhookEvent("processed", `Invoice payment succeeded: ${invoice.id}`);
        }
        break;
      }

      // ─── Refund Clawback ─────────────────────────────────────────
      // Fired when a charge is refunded (full or partial) via Stripe Dashboard
      // or API. We claw back the equivalent credits so users who get refunded
      // can't keep generating with credits they no longer paid for.
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (!paymentIntentId) {
          await logWebhookEvent("ignored", `charge.refunded with no payment_intent: ${charge.id}`);
          break;
        }
        if (!db) {
          await logWebhookEvent("failed", `charge.refunded: no database (${charge.id})`);
          break;
        }

        // Find the original credit purchase by payment intent.
        const original = await db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId))
          .limit(1);

        if (original.length === 0) {
          // Subscription invoice or pre-credits-system purchase — nothing to claw back.
          await logWebhookEvent(
            "ignored",
            `charge.refunded: no matching credit purchase for ${paymentIntentId}`
          );
          break;
        }

        const purchase = original[0];
        const refundRatio = (charge.amount_refunded || 0) / (charge.amount || 1);
        const creditsToClawback = Math.round(purchase.amount * refundRatio);

        if (creditsToClawback <= 0) {
          await logWebhookEvent("ignored", `charge.refunded: zero refund amount (${charge.id})`);
          break;
        }

        // Deduct from balance — allow it to go negative if the user already
        // spent the credits, so they can't simply spend-then-refund.
        await db
          .update(creditBalances)
          .set({
            balance: sql`${creditBalances.balance} - ${creditsToClawback}`,
          })
          .where(eq(creditBalances.userId, purchase.userId));

        await db.insert(creditTransactions).values({
          userId: purchase.userId,
          amount: -creditsToClawback,
          type: "refund",
          description: `Stripe refund: ${creditsToClawback} credits clawed back`,
          stripePaymentIntentId: paymentIntentId,
          metadata: {
            chargeId: charge.id,
            refundAmount: charge.amount_refunded,
            originalPurchaseTransactionId: purchase.id,
          },
        });

        try {
          await createNotification(
            purchase.userId,
            "payment",
            "Refund Processed",
            `Your refund has been processed and ${creditsToClawback} credit${creditsToClawback === 1 ? "" : "s"} ` +
              `have been removed from your balance.`,
            { chargeId: charge.id, creditsRemoved: creditsToClawback }
          );
        } catch {}

        console.log(
          `[Stripe Webhook] Refund clawback: ${creditsToClawback} credits from user ${purchase.userId} (charge ${charge.id})`
        );
        await logWebhookEvent(
          "processed",
          `Refund clawback: ${creditsToClawback} credits from user ${purchase.userId}`
        );
        break;
      }

      // ─── Subscription Renewal Failure ────────────────────────────
      // Stripe handles retries automatically (smart retries over ~3 weeks)
      // and will eventually fire customer.subscription.updated → past_due
      // → canceled. We just notify the user so they can update their card
      // before they lose access.
      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!subId) {
          await logWebhookEvent(
            "ignored",
            `invoice.payment_failed: not a subscription invoice (${invoice.id})`
          );
          break;
        }
        if (!db) {
          await logWebhookEvent("failed", `invoice.payment_failed: no database (${invoice.id})`);
          break;
        }

        const subRows = await db
          .select({ userId: userSubscriptions.userId })
          .from(userSubscriptions)
          .where(eq(userSubscriptions.stripeSubscriptionId, subId))
          .limit(1);
        const userId = subRows[0]?.userId;

        if (!userId) {
          await logWebhookEvent(
            "ignored",
            `invoice.payment_failed: no local subscription for ${subId}`
          );
          break;
        }

        const attemptCount = invoice.attempt_count || 1;
        const nextAttemptUnix = invoice.next_payment_attempt;
        const nextAttemptText = nextAttemptUnix
          ? `We'll automatically retry on ${new Date(nextAttemptUnix * 1000).toLocaleDateString()}.`
          : "Please update your payment method to avoid losing access.";

        try {
          await createNotification(
            userId,
            "payment",
            attemptCount === 1
              ? "Subscription Payment Failed"
              : `Payment Retry Failed (Attempt ${attemptCount})`,
            `Your subscription renewal couldn't be processed. ${nextAttemptText} ` +
              `Update your payment method on the Credits page.`,
            {
              invoiceId: invoice.id,
              subscriptionId: subId,
              attemptCount,
              amountDue: invoice.amount_due,
            }
          );
        } catch {}

        console.log(
          `[Stripe Webhook] Invoice payment failed: user ${userId}, sub ${subId}, attempt ${attemptCount}`
        );
        await logWebhookEvent(
          "processed",
          `Payment failed for user ${userId}, sub ${subId}, attempt ${attemptCount}`
        );
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        await logWebhookEvent("ignored", `Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error("[Stripe Webhook] Error processing event:", err.message);
    await logWebhookEvent("failed", `Error processing ${event.type}`, err.message);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
