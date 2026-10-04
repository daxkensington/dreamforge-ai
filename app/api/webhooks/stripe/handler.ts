import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "../../../../server/db";
import { addCredits } from "../../../../server/stripe";
import { createNotification } from "../../../../server/routersPhase15";
import { hasPurchased, recordPurchase } from "../../../../server/dbMarketplace";
import {
  webhookEvents,
  creditBalances,
  creditTransactions,
  userSubscriptions,
  marketplaceListings,
  users,
} from "../../../../drizzle/schema";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import {
  activateSubscription,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleMonthlyReset,
} from "../../../../server/routers/pricing";

// Lazy Stripe client
let _stripe: Stripe | null = null;
export function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripe;
}

/**
 * Stripe moved current_period_start/end off the subscription and onto its
 * items. Reading them from the subscription yields undefined -> NaN ->
 * new Date(NaN), which THREW before any entitlement was written: verified in
 * prod on 2026-09-12, the subscription was active and paid and the customer
 * got no plan row and no credits.
 *
 * Prefer the item, fall back to the legacy top-level field, then to sensible
 * defaults — a future shape change must never again cost a payer their plan.
 */
function subscriptionPeriod(sub: Stripe.Subscription): { start: Date; end: Date } {
  const anySub = sub as any;
  const item = anySub.items?.data?.[0];
  const rawStart = item?.current_period_start ?? anySub.current_period_start ?? anySub.start_date;
  const rawEnd = item?.current_period_end ?? anySub.current_period_end;

  const start = Number.isFinite(rawStart) ? new Date(rawStart * 1000) : new Date();
  const end = Number.isFinite(rawEnd)
    ? new Date(rawEnd * 1000)
    : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
    console.warn(
      "[Stripe Webhook] Subscription period missing on",
      sub.id,
      "- falling back so the entitlement is still granted"
    );
  }
  return { start, end };
}

type WebhookDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type StripeEventResult = "processed" | "ignored" | "duplicate";

/**
 * Claw back credits for a purchase, tracking the CUMULATIVE clawed amount on
 * the purchase row (clawedBackCredits). Stripe fires one refund event per
 * refund with a cumulative amount_refunded, and disputes can interleave with
 * refunds on the same charge — so each event computes the target cumulative
 * clawback and removes only the delta over what earlier events already took.
 *
 * The read-modify-write of the counter is serialized with an optimistic
 * atomic UPDATE ... WHERE clawedBackCredits = <seen> RETURNING: only one
 * concurrent event wins the counter move; losers re-read and recompute, so
 * two events for the same purchase can never double-claw.
 *
 * Returns the delta actually clawed (0 = nothing left to take).
 */
async function clawBackCredits(
  db: WebhookDb,
  purchaseId: number,
  targetClawedTotal: number,
  kind: "refund" | "dispute",
  descriptionPrefix: string,
  metadata: Record<string, unknown>,
  sentryContext: Record<string, unknown>
): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await db
      .select({
        id: creditTransactions.id,
        userId: creditTransactions.userId,
        amount: creditTransactions.amount,
        clawedBackCredits: creditTransactions.clawedBackCredits,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.id, purchaseId))
      .limit(1);

    const current = rows[0];
    if (!current) {
      throw new Error(`Purchase transaction ${purchaseId} vanished mid-clawback`);
    }

    const alreadyClawed = current.clawedBackCredits ?? 0;
    // Never claw back more than the purchase granted, and never move the
    // counter backwards (a refund event arriving after a dispute already
    // clawed everything must not "un-claw").
    const target = Math.min(Math.max(targetClawedTotal, alreadyClawed), current.amount);
    const delta = target - alreadyClawed;
    if (delta <= 0) return 0;

    // Atomically claim the delta. If a concurrent event moved the counter
    // first, this matches zero rows and we re-read + recompute.
    const updated = await db
      .update(creditTransactions)
      .set({ clawedBackCredits: target })
      .where(
        and(
          eq(creditTransactions.id, current.id),
          eq(creditTransactions.clawedBackCredits, alreadyClawed)
        )
      )
      .returning({ id: creditTransactions.id });

    if (updated.length === 0) continue;

    try {
      // Deduct from balance — allow it to go negative if the user already
      // spent the credits, so they can't simply spend-then-refund.
      await db
        .update(creditBalances)
        .set({
          balance: sql`${creditBalances.balance} - ${delta}`,
        })
        .where(eq(creditBalances.userId, current.userId));

      await db.insert(creditTransactions).values({
        userId: current.userId,
        amount: -delta,
        type: kind,
        description: `${descriptionPrefix}: ${delta} credits clawed back`,
        stripePaymentIntentId: (metadata.paymentIntentId as string) || null,
        metadata,
      });
    } catch (err) {
      Sentry.captureException(err, { extra: sentryContext });
      throw err;
    }

    return delta;
  }

  throw new Error(
    `Clawback conflict resolution exhausted retries for transaction ${purchaseId}`
  );
}

/**
 * Shared lookup for the original credit purchase behind a payment intent.
 * Restricted to positive "purchase" rows so a previous refund/dispute
 * clawback row (which stores the same payment intent for audit) can never be
 * mistaken for the original purchase on a later event.
 */
async function findPurchaseByPaymentIntent(db: WebhookDb, paymentIntentId: string) {
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.stripePaymentIntentId, paymentIntentId),
        eq(creditTransactions.type, "purchase"),
        gt(creditTransactions.amount, 0)
      )
    )
    .orderBy(asc(creditTransactions.id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Claim-and-process a single verified Stripe event.
 *
 * Idempotency is atomic: the event row is claimed up front with
 * INSERT ... ON CONFLICT (eventId) DO NOTHING RETURNING, so two concurrent
 * deliveries can never both pass the check (the old SELECT-then-insert
 * could), and a redelivery after a crash between processing and logging no
 * longer re-grants credits — the claim row exists regardless. A conflicting
 * row means the event is already claimed (processed or failed): return 200
 * without reprocessing.
 *
 * Throws on processing failure (the route maps that to a 500 for Stripe);
 * the claim row is updated to 'failed' first so the failure is auditable.
 */
export async function processStripeEvent(
  event: Stripe.Event,
  db: WebhookDb | null
): Promise<StripeEventResult> {
  // ─── Atomic idempotency claim ──────────────────────────────────
  if (db) {
    const claimed = await db
      .insert(webhookEvents)
      .values({
        eventId: event.id,
        eventType: event.type,
        status: "pending",
        summary: "Claimed for processing",
      })
      .onConflictDoNothing({ target: webhookEvents.eventId })
      .returning({ id: webhookEvents.id });

    if (claimed.length === 0) {
      console.log("[Stripe Webhook] Duplicate event, skipping:", event.id);
      return "duplicate";
    }
  }

  // Helper to log webhook events to DB — updates the claim row written above
  // so each event keeps exactly one audit row. Failures here are swallowed:
  // the processing already happened, and erroring out would invite a Stripe
  // redelivery that the claim row then swallows as a duplicate anyway.
  let outcome: StripeEventResult = "processed";
  const logWebhookEvent = async (
    status: "processed" | "failed" | "ignored",
    summary: string,
    errorMsg?: string
  ) => {
    if (status !== "failed") outcome = status;
    if (!db) return;
    try {
      await db
        .update(webhookEvents)
        .set({ status, summary, errorMessage: errorMsg || null })
        .where(eq(webhookEvents.eventId, event.id));
    } catch (logErr) {
      console.error("[Stripe Webhook] Failed to log event:", logErr);
    }
  };

  try {
    switch (event.type) {
      // ─── Checkout Completed (credit packs & marketplace) ─────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // ─── Marketplace Purchase ────────────────────────────────
        // Marketplace sessions are created in server/routers/marketplace.ts
        // with metadata.type = "marketplace_purchase". Without this branch the
        // buyer is charged but no purchase row is written and downloadAsset
        // denies them forever.
        if (session.metadata?.type === "marketplace_purchase") {
          const buyerId = parseInt(session.metadata?.buyer_id || "0");
          const listingId = parseInt(session.metadata?.listing_id || "0");

          if (!buyerId || !listingId) {
            await logWebhookEvent(
              "ignored",
              `Marketplace checkout with missing buyer/listing metadata: ${session.id}`
            );
            break;
          }
          if (!db) {
            await logWebhookEvent(
              "failed",
              `Marketplace purchase for buyer ${buyerId}, listing ${listingId}: no database`
            );
            break;
          }

          // Idempotency — same convention as the marketplace router's
          // purchase route (webhookEvents dedupe by event.id happens above).
          if (await hasPurchased(buyerId, listingId)) {
            console.log(
              `[Stripe Webhook] Marketplace purchase already recorded: buyer ${buyerId}, listing ${listingId}`
            );
            await logWebhookEvent(
              "processed",
              `Duplicate marketplace purchase skipped: buyer ${buyerId}, listing ${listingId}`
            );
            break;
          }

          const listingRows = await db
            .select({
              sellerId: marketplaceListings.sellerId,
              title: marketplaceListings.title,
              price: marketplaceListings.price,
            })
            .from(marketplaceListings)
            .where(eq(marketplaceListings.id, listingId))
            .limit(1);
          const listing = listingRows[0];

          const buyerRows = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, buyerId))
            .limit(1);

          // Orphaned metadata (listing deleted or buyer account gone): the
          // buyer was charged but we can't compute fees or notify a seller.
          // Log loudly and mark handled — Stripe retries can't fix a deleted
          // listing, so don't let it retry for 3 days (house convention for
          // unresolvable refs, see charge.refunded).
          if (!listing || buyerRows.length === 0) {
            console.error(
              `[Stripe Webhook] Marketplace purchase orphaned (buyer charged, not recorded): ` +
                `listing ${listingId} exists=${!!listing}, buyer ${buyerId} exists=${buyerRows.length > 0}, session ${session.id}`
            );
            await logWebhookEvent(
              "ignored",
              `Marketplace purchase orphaned: listing ${listingId} or buyer ${buyerId} no longer exists (session ${session.id})`
            );
            break;
          }

          // Price agreed at checkout (metadata), falling back to the listing's
          // current price if the metadata is missing/corrupt.
          const price = parseInt(session.metadata?.price || "") || listing.price;

          const result = await recordPurchase({
            buyerId,
            listingId,
            price,
            stripePaymentId: (session.payment_intent as string) || session.id,
          });
          // Download entitlement needs no extra step: downloadAsset and
          // hasPurchased read marketplacePurchases directly.
          console.log(
            `[Stripe Webhook] Marketplace purchase recorded: buyer ${buyerId} bought listing ${listingId} (purchase ${result.id}, session ${session.id})`
          );

          // Notify the seller
          try {
            await createNotification(
              listing.sellerId,
              "payment",
              "New Sale",
              `Your listing "${listing.title}" just sold for $${(price / 100).toFixed(2)}.`,
              {
                listingId,
                purchaseId: result.id,
                buyerId,
                price,
                sessionId: session.id,
              }
            );
          } catch {}

          await logWebhookEvent(
            "processed",
            `Marketplace purchase: buyer ${buyerId} bought listing ${listingId} (${listing.title})`
          );
          break;
        }

        // ─── Credit Purchase ─────────────────────────────────────
        const userId = parseInt(session.metadata?.user_id || "0");
        const credits = parseInt(session.metadata?.credits || "0");
        const packageId = session.metadata?.package_id || "";

        let grantSkipped = false;
        if (userId && credits) {
          // addCredits has no stripeSessionId idempotency of its own, so the
          // guard lives here: never re-grant credits for a checkout session
          // that already produced a purchase transaction. (Concurrent
          // deliveries of the SAME event are excluded by the atomic claim;
          // this covers redelivery-after-log-failure and future callers.)
          let alreadyGranted = false;
          if (db) {
            try {
              const priorGrant = await db
                .select({ id: creditTransactions.id })
                .from(creditTransactions)
                .where(eq(creditTransactions.stripeSessionId, session.id))
                .limit(1);
              alreadyGranted = priorGrant.length > 0;
            } catch (guardErr) {
              // Fail open: the buyer paid, so a guard hiccup must not strand
              // the grant — the claim row still excludes concurrent grants.
              console.error(
                `[Stripe Webhook] addCredits guard check failed for session ${session.id}:`,
                guardErr
              );
              Sentry.captureException(guardErr, {
                extra: { sessionId: session.id, userId, credits },
              });
            }
          }

          if (alreadyGranted) {
            grantSkipped = true;
            console.log(
              `[Stripe Webhook] Credits already granted for session ${session.id}, skipping addCredits`
            );
          } else {
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
        }
        await logWebhookEvent(
          "processed",
          `Checkout completed for user ${userId}, ${credits || "subscription"} credits` +
            (grantSkipped ? ` (already granted for session ${session.id})` : "")
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
          const period = subscriptionPeriod(sub);
          await activateSubscription(userId, planId, sub.id, period.start, period.end);
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
        const updatedPeriod = subscriptionPeriod(sub);
        await handleSubscriptionUpdated(
          sub.id,
          planName,
          sub.status,
          updatedPeriod.start,
          updatedPeriod.end
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
        const purchase = await findPurchaseByPaymentIntent(db, paymentIntentId);

        if (!purchase) {
          // Subscription invoice or pre-credits-system purchase — nothing to claw back.
          await logWebhookEvent(
            "ignored",
            `charge.refunded: no matching credit purchase for ${paymentIntentId}`
          );
          break;
        }

        // amount_refunded is CUMULATIVE across all refunds on the charge, so
        // compute the total clawback implied by the current refund state and
        // remove only the delta over what earlier refund/dispute events
        // already clawed (tracked on the purchase row). Clawing the raw ratio
        // here would double-count: a 50% refund followed by a top-up to 100%
        // would claw 50% + 100% = 150%.
        const refundRatio = (charge.amount_refunded || 0) / (charge.amount || 1);
        const expectedClawedTotal = Math.round(purchase.amount * refundRatio);

        if (expectedClawedTotal <= (purchase.clawedBackCredits ?? 0)) {
          await logWebhookEvent(
            "ignored",
            `charge.refunded: already fully clawed back for ${paymentIntentId} (${charge.id})`
          );
          break;
        }

        const creditsToClawback = await clawBackCredits(
          db,
          purchase.id,
          expectedClawedTotal,
          "refund",
          "Stripe refund",
          {
            chargeId: charge.id,
            refundAmount: charge.amount_refunded,
            expectedClawedTotal,
            paymentIntentId,
            originalPurchaseTransactionId: purchase.id,
          },
          { chargeId: charge.id, paymentIntentId, purchaseId: purchase.id }
        );

        if (creditsToClawback <= 0) {
          // Lost a concurrent clawback race with nothing left to take.
          await logWebhookEvent(
            "ignored",
            `charge.refunded: nothing left to claw back for ${paymentIntentId} (${charge.id})`
          );
          break;
        }

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

      // ─── Dispute Clawback ────────────────────────────────────────
      // Fired when a cardholder disputes a charge. Same clawback mechanism as
      // refunds: the clawed amount is tracked on the purchase row's
      // clawedBackCredits counter so a refund/dispute combo on the same
      // charge never claws back more than the purchase granted.
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;

        // The dispute references its charge (and, in current API versions,
        // its payment intent), but they arrive unexpanded — resolve the
        // charge to learn its amount and payment intent.
        const chargeId =
          typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        let paymentIntentId: string | undefined =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id ?? undefined;
        let chargeAmount: number | undefined =
          typeof dispute.charge === "object" && dispute.charge !== null
            ? dispute.charge.amount
            : undefined;

        if (!paymentIntentId || chargeAmount == null) {
          if (!chargeId) {
            await logWebhookEvent(
              "ignored",
              `charge.dispute.created: no charge reference on dispute ${dispute.id}`
            );
            break;
          }
          try {
            const charge = await getStripeClient().charges.retrieve(chargeId);
            paymentIntentId =
              typeof charge.payment_intent === "string"
                ? charge.payment_intent
                : charge.payment_intent?.id ?? undefined;
            chargeAmount = charge.amount;
          } catch (err: any) {
            console.error(
              `[Stripe Webhook] charge.dispute.created: charge retrieve failed (${chargeId}):`,
              err.message
            );
            Sentry.captureException(err, { extra: { disputeId: dispute.id, chargeId } });
            await logWebhookEvent(
              "failed",
              `charge.dispute.created: could not resolve charge ${chargeId} for dispute ${dispute.id}`
            );
            break;
          }
        }

        if (!paymentIntentId || chargeAmount == null) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.created: no payment intent for dispute ${dispute.id}`
          );
          break;
        }
        if (!db) {
          await logWebhookEvent("failed", `charge.dispute.created: no database (${dispute.id})`);
          break;
        }

        const purchase = await findPurchaseByPaymentIntent(db, paymentIntentId);

        if (!purchase) {
          // Subscription invoice or non-credit charge — nothing to claw back.
          await logWebhookEvent(
            "ignored",
            `charge.dispute.created: no matching credit purchase for ${paymentIntentId}`
          );
          break;
        }

        const disputeCredits = Math.round(
          (purchase.amount * (dispute.amount || 0)) / (chargeAmount || 1)
        );

        if (disputeCredits <= 0) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.created: zero disputed amount (${dispute.id})`
          );
          break;
        }

        const creditsToClawback = await clawBackCredits(
          db,
          purchase.id,
          (purchase.clawedBackCredits ?? 0) + disputeCredits,
          "dispute",
          "Stripe dispute",
          {
            disputeId: dispute.id,
            chargeId,
            disputedAmount: dispute.amount,
            reason: dispute.reason,
            paymentIntentId,
            originalPurchaseTransactionId: purchase.id,
          },
          { disputeId: dispute.id, chargeId, paymentIntentId, purchaseId: purchase.id }
        );

        if (creditsToClawback <= 0) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.created: nothing left to claw back for ${paymentIntentId} (${dispute.id})`
          );
          break;
        }

        try {
          await createNotification(
            purchase.userId,
            "payment",
            "Payment Disputed",
            `A payment was disputed by the cardholder and ${creditsToClawback} credit${creditsToClawback === 1 ? "" : "s"} ` +
              `have been removed from your balance while the dispute is investigated.`,
            { disputeId: dispute.id, chargeId, creditsRemoved: creditsToClawback }
          );
        } catch {}

        console.log(
          `[Stripe Webhook] Dispute clawback: ${creditsToClawback} credits from user ${purchase.userId} (dispute ${dispute.id})`
        );
        await logWebhookEvent(
          "processed",
          `Dispute clawback: ${creditsToClawback} credits from user ${purchase.userId} (dispute ${dispute.id})`
        );
        break;
      }

      // ─── Dispute Closed ──────────────────────────────────────────
      // We claw at dispute.created, so 'lost' is already handled. 'won' is a
      // deliberate no-op: the clawed amount can't be attributed reliably
      // when refunds and disputes interleave on the same charge, so restoring
      // credits is left as a manual support action (refundCredits).
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(
          `[Stripe Webhook] Dispute ${dispute.id} closed with status ${dispute.status} — no balance change`
        );
        await logWebhookEvent(
          "ignored",
          `Dispute ${dispute.id} closed (${dispute.status}) — no balance change`
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
    console.error("[Stripe Webhook] Error processing event:", err?.message || err);
    // Sentry capture happens in the route's outer catch (so claim failures are
    // covered too); the clawback branch captures with extra context on its
    // own before rethrowing.
    await logWebhookEvent("failed", `Error processing ${event.type}`, err?.message);
    throw err;
  }

  return outcome;
}
