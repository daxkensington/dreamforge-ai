import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "../../../../server/db";
import { addCredits, CREDIT_PACKAGES } from "../../../../server/stripe";
import { walletRows } from "../../../../server/_core/walletAccounting";
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
import { allocatePaidSubscriptionInvoice, hasPaidSubscriptionInvoiceAllocation } from "../../../../server/_core/subscriptionBilling";

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
 * Current item/legacy billing dates and explicit trial dates are authoritative.
 * Missing eligible dates fail for reconciliation instead of inventing paid time.
 */
function subscriptionPeriod(sub: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const anySub = sub as any;
  const item = anySub.items?.data?.[0];
  const trialing = sub.status === "trialing";
  const rawStart = (trialing ? anySub.trial_start : undefined) ?? item?.current_period_start ?? anySub.current_period_start;
  const rawEnd = (trialing ? anySub.trial_end : undefined) ?? item?.current_period_end ?? anySub.current_period_end;
  const valid = Number.isSafeInteger(rawStart) && Number.isSafeInteger(rawEnd)
    && rawStart >= 0 && rawEnd > rawStart
    && Number.isFinite(new Date(rawStart * 1000).getTime()) && Number.isFinite(new Date(rawEnd * 1000).getTime());
  if (!valid) {
    if (sub.status === "active" || trialing) {
      throw new Error("Subscription period missing or invalid; no entitlement granted. Reconcile Stripe period data before retrying this event.");
    }
    return { start: null, end: null };
  }
  return { start: new Date(rawStart * 1000), end: new Date(rawEnd * 1000) };
}

async function currentSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const sub = await getStripeClient().subscriptions.retrieve(subscriptionId);
  if (sub.id !== subscriptionId) throw new Error("Stripe subscription retrieval returned a different subscription.");
  return sub;
}

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = Number(sub.metadata?.user_id);
  const planId = Number(sub.metadata?.plan_id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(planId) || planId <= 0) {
    throw new Error("Stripe subscription requires verified user and plan metadata before reconciliation.");
  }
  const period = subscriptionPeriod(sub);
  await activateSubscription(userId, planId, sub.id, period.start, period.end, sub.status, sub.cancel_at_period_end);
}

function invoiceServiceMapping(invoice: any, subscriptionId: string) {
  const id = (value: any) => typeof value === "string" ? value : value?.id;
  const lines = (invoice.lines?.data ?? []) as any[];
  const matches = lines.filter(line => {
    const details = line.parent?.subscription_item_details;
    const subscriptionItem = details?.subscription_item ?? line.subscription_item;
    const lineSubscription = id(details?.subscription ?? line.subscription);
    const price = line.pricing?.price_details?.price ?? line.price;
    const recurring = line.parent?.type === "subscription_item_details" || line.type === "subscription";
    return recurring && typeof subscriptionItem === "string" && (!lineSubscription || lineSubscription === subscriptionId)
      && !(details?.proration ?? line.proration) && typeof id(price) === "string";
  });
  if (invoice.lines?.has_more || matches.length !== 1) throw new Error("Invoice service period is missing or ambiguous; reconcile before allocation.");
  const rawStart = matches[0].period?.start;
  const rawEnd = matches[0].period?.end;
  if (!Number.isSafeInteger(rawStart) || !Number.isSafeInteger(rawEnd) || rawStart < 0 || rawEnd <= rawStart
    || !Number.isFinite(new Date(rawStart * 1000).getTime()) || !Number.isFinite(new Date(rawEnd * 1000).getTime())) {
    throw new Error("Invoice service period is missing or invalid; reconcile before allocation.");
  }
  const details = matches[0].parent?.subscription_item_details;
  return {
    invoiceId: invoice.id, subscriptionId,
    subscriptionItemId: details?.subscription_item ?? matches[0].subscription_item,
    priceId: id(matches[0].pricing?.price_details?.price ?? matches[0].price),
    periodStart: new Date(rawStart * 1000), periodEnd: new Date(rawEnd * 1000),
  };
}

function admitInvoicePeriod(mapping: ReturnType<typeof invoiceServiceMapping>, sub: Stripe.Subscription): void {
  const id = (value: any) => typeof value === "string" ? value : value?.id;
  const items = (sub.items?.data ?? []) as any[];
  const current = subscriptionPeriod(sub);
  if (items.length !== 1 || sub.items?.has_more || items[0].id !== mapping.subscriptionItemId || id(items[0].price) !== mapping.priceId
    || !current.start || !current.end || current.start.getTime() !== mapping.periodStart.getTime() || current.end.getTime() !== mapping.periodEnd.getTime()
    || mapping.periodStart.getTime() > Date.now() || mapping.periodEnd.getTime() <= Date.now()) {
    throw new Error("Invoice service period is old or does not match the current verified subscription; reconcile before allocation.");
  }
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
  const receiptKey = kind === "dispute" ? `dispute-clawback:${metadata.disputeId}` : `refund-clawback:${metadata.chargeId}:${metadata.refundAmount}`;
  const result = walletRows(await db.execute(sql`
    WITH locked AS (SELECT * FROM "creditTransactions" WHERE id = ${purchaseId} FOR UPDATE),
    eligible AS (SELECT l.*, LEAST(GREATEST(${targetClawedTotal}, l."clawedBackCredits"), l.amount) - l."clawedBackCredits" AS delta FROM locked l
      WHERE NOT EXISTS (SELECT 1 FROM "webhookEvents" WHERE "eventId" = ${receiptKey})
        AND (${kind}::text <> 'dispute' OR NOT EXISTS (SELECT 1 FROM "creditTransactions" d WHERE d."txType" = 'dispute' AND d.amount < 0 AND d."txMetadata"->>'disputeId' = ${(metadata.disputeId as string) ?? null}))),
    wallet_before AS (SELECT cb.* FROM "creditBalances" cb JOIN eligible p ON p."userId" = cb."userId" FOR UPDATE OF cb),
    wallet AS (
      UPDATE "creditBalances" cb SET balance = cb.balance - p.delta,
        "bonusCredits" = CASE WHEN cb."walletAccountingVersion" = 1 THEN GREATEST(0, cb."bonusCredits" - p.delta) ELSE cb."bonusCredits" END,
        "updatedAt" = now()
      FROM eligible p JOIN wallet_before wb ON wb."userId" = p."userId" WHERE cb.id = wb.id AND p.delta > 0
      RETURNING cb."userId", p.delta, CASE WHEN wb."walletAccountingVersion" = 1 THEN LEAST(p.delta, wb."bonusCredits") ELSE 0 END AS purchased
    ), purchase AS (
      UPDATE "creditTransactions" t SET "clawedBackCredits" = t."clawedBackCredits" + w.delta
      FROM wallet w WHERE t.id = ${purchaseId} RETURNING t.id
    ), ledger AS (
      INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "stripePaymentIntentId", "txMetadata")
      SELECT w."userId", -w.delta, ${kind}::"txType", ${descriptionPrefix} || ': ' || w.delta || ' credits clawed back',
        ${(metadata.paymentIntentId as string) ?? null}, ${JSON.stringify(metadata)}::jsonb || jsonb_build_object('purchasedCreditsClawed', w.purchased)
      FROM wallet w WHERE EXISTS (SELECT 1 FROM purchase) RETURNING amount
    ), receipt AS (
      INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
      SELECT ${receiptKey}, 'internal.payment_clawback', 'processed', 'Payment clawback committed atomically' FROM ledger RETURNING id
    ) SELECT -amount AS delta FROM ledger WHERE EXISTS (SELECT 1 FROM receipt)`));
  return Number(result[0]?.delta ?? 0);
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
  if (!db) throw new Error("Database unavailable for payment processing; retry the same event.");
  const checkout = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded"
    ? event.data.object as Stripe.Checkout.Session : null;
  const recoverableCreditPack = !!checkout?.metadata?.package_id && checkout.metadata?.type !== "marketplace_purchase";
  const recoverableMarketplace = checkout?.metadata?.type === "marketplace_purchase";
  const recoverableClawback = ["charge.refunded", "charge.dispute.created", "charge.dispute.closed"].includes(event.type);
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

    if (claimed.length === 0 && !recoverableCreditPack && !recoverableMarketplace && !recoverableClawback) {
      // These paths are now idempotent state sync or atomic invoice allocation.
      // Their failed events can be retried without reopening unrelated payment paths.
      const retryable = ["invoice.paid", "invoice.payment_succeeded", "customer.subscription.created", "customer.subscription.updated"].includes(event.type);
      if (retryable) {
        const retried = await db.update(webhookEvents)
          .set({ status: "pending", summary: "Retry claimed after failed subscription processing", errorMessage: null })
          .where(and(eq(webhookEvents.eventId, event.id), eq(webhookEvents.eventType, event.type), eq(webhookEvents.status, "failed")))
          .returning({ id: webhookEvents.id });
        if (retried.length === 1) {
          // Continue through the same processing/logging scope below.
        } else {
          return "duplicate";
        }
      } else {
      console.log("[Stripe Webhook] Duplicate event, skipping:", event.id);
      return "duplicate";
      }
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
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
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
        const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
        if (session.mode === "subscription") {
          await logWebhookEvent("processed", `Subscription checkout ${session.id}: awaiting verified invoice`);
          break;
        }
        if (!pkg || !Number.isSafeInteger(userId) || userId <= 0 || credits !== pkg.credits
          || !(session.payment_status === "paid" || session.payment_status === "no_payment_required" && session.amount_total === 0) || session.currency !== "usd"
          || !Number.isSafeInteger(session.amount_total) || session.amount_total! < 0 || session.amount_total! > pkg.price) {
          throw new Error("Credit purchase requires a settled, valid USD package checkout.");
        }
        // Read Stripe's current receipt and original line price. Discounts are
        // accepted only when Stripe applied them to the server-priced package.
        const verified = await getStripeClient().checkout.sessions.retrieve(session.id, { expand: ["line_items"] });
        const line = verified.line_items?.data?.[0];
        const discount = verified.total_details?.amount_discount ?? 0;
        if (verified.id !== session.id || verified.mode !== "payment" || verified.status !== "complete"
          || !(verified.payment_status === "paid" || verified.payment_status === "no_payment_required" && verified.amount_total === 0) || verified.currency !== "usd"
          || verified.metadata?.user_id !== String(userId) || verified.metadata?.package_id !== pkg.id
          || verified.metadata?.credits !== String(pkg.credits)
          || verified.line_items?.has_more || verified.line_items?.data.length !== 1 || line?.quantity !== 1
          || line.price?.unit_amount !== pkg.price || line.price.currency !== "usd"
          || verified.amount_subtotal !== pkg.price || !Number.isSafeInteger(discount) || discount < 0
          || verified.amount_total !== pkg.price - discount) {
          throw new Error("The current payment receipt does not match the purchased credit package.");
        }

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
            const grant = await addCredits(
              userId,
              credits,
              `Purchased ${packageId} pack (${credits} credits)`,
              session.id,
              typeof verified.payment_intent === "string" ? verified.payment_intent : verified.payment_intent?.id
            );
            grantSkipped = grant === "duplicate";
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
        const incoming = event.data.object as Stripe.Subscription;
        const sub = await currentSubscription(incoming.id);
        const userId = parseInt(sub.metadata?.user_id || "0");
        const planId = parseInt(sub.metadata?.plan_id || "0");

        if (userId && planId) {
          await syncSubscription(sub);
          console.log(
            `[Stripe Webhook] Subscription created for user ${userId}, plan ${sub.metadata?.plan_name}`
          );
          try {
            await createNotification(
              userId,
              "payment",
              "Subscription Updated",
              `Your subscription status is ${sub.status}. Credits are allocated after a verified paid invoice.`,
              { planId, subscriptionId: sub.id }
            );
          } catch {}
        }
        await logWebhookEvent(
          "processed",
          `Subscription created for user ${userId}, plan ${planId}, providerStatus=${sub.status}`
        );
        break;
      }

      // ─── Subscription Updated ────────────────────────────────────
      case "customer.subscription.updated": {
        const incoming = event.data.object as Stripe.Subscription;
        const sub = await currentSubscription(incoming.id);
        const planName = sub.metadata?.plan_name || "";
        const updatedPeriod = subscriptionPeriod(sub);
        await handleSubscriptionUpdated(
          sub.id,
          planName,
          sub.status,
          updatedPeriod.start,
          updatedPeriod.end,
          sub.cancel_at_period_end,
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
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const linked = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
        const subId = typeof linked === "string" ? linked : linked?.id;
        const paid = invoice.status === "paid" || (invoice.status == null && invoice.paid === true);
        if (subId && paid && ["subscription_create", "subscription_cycle"].includes(invoice.billing_reason)) {
          const mapping = invoiceServiceMapping(invoice, subId);
          if (await hasPaidSubscriptionInvoiceAllocation(mapping)) {
            await logWebhookEvent("processed", `Subscription invoice ${invoice.id}: duplicate allocation`);
            break;
          }
          const subscription = await currentSubscription(subId);
          admitInvoicePeriod(mapping, subscription);
          await syncSubscription(subscription);
          const result = await allocatePaidSubscriptionInvoice(mapping);
          await logWebhookEvent("processed", `Subscription invoice ${invoice.id}: ${result}`);
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
      // 'lost' is already handled at dispute.created (we clawed then).
      // 'won' means the bank sided with us and the charge stands — return the
      // credits that dispute.created removed. Restoration is bounded by the
      // clawback ledger rows for THIS dispute (metadata.disputeId) and lowers
      // the purchase row's clawedBackCredits counter (optimistic UPDATE, floor
      // 0) so a later legitimate refund on the same charge can claw again.
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;

        if (dispute.status !== "won") {
          console.log(
            `[Stripe Webhook] Dispute ${dispute.id} closed with status ${dispute.status} — no balance change`
          );
          await logWebhookEvent(
            "ignored",
            `Dispute ${dispute.id} closed (${dispute.status}) — no balance change`
          );
          break;
        }

        const chargeId =
          typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
        let paymentIntentId: string | undefined =
          typeof dispute.payment_intent === "string"
            ? dispute.payment_intent
            : dispute.payment_intent?.id ?? undefined;
        if (!paymentIntentId && chargeId) {
          try {
            const charge = await getStripeClient().charges.retrieve(chargeId);
            paymentIntentId =
              typeof charge.payment_intent === "string"
                ? charge.payment_intent
                : charge.payment_intent?.id ?? undefined;
          } catch (err: any) {
            console.error(
              `[Stripe Webhook] charge.dispute.closed: charge retrieve failed (${chargeId}):`,
              err.message
            );
            Sentry.captureException(err, { extra: { disputeId: dispute.id, chargeId } });
            await logWebhookEvent(
              "failed",
              `charge.dispute.closed: could not resolve charge ${chargeId} for dispute ${dispute.id}`
            );
            break;
          }
        }

        if (!paymentIntentId) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.closed: no payment intent for dispute ${dispute.id}`
          );
          break;
        }
        if (!db) {
          await logWebhookEvent("failed", `charge.dispute.closed: no database (${dispute.id})`);
          break;
        }

        const purchase = await findPurchaseByPaymentIntent(db, paymentIntentId);
        if (!purchase) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.closed: no matching credit purchase for ${paymentIntentId}`
          );
          break;
        }

        // Sum what THIS dispute clawed (negative-amount dispute ledger rows).
        const clawRows = await db
          .select({ amount: creditTransactions.amount })
          .from(creditTransactions)
          .where(
            and(
              eq(creditTransactions.stripePaymentIntentId, paymentIntentId),
              eq(creditTransactions.type, "dispute"),
              sql`${creditTransactions.metadata}->>'disputeId' = ${dispute.id}`
            )
          );
        const restoreTotal = clawRows.reduce((s, r) => s + Math.max(0, -r.amount), 0);

        if (restoreTotal <= 0) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.closed: dispute ${dispute.id} won but nothing was clawed for it — no-op`
          );
          break;
        }

        const restoration = walletRows(await db.execute(sql`
          WITH locked AS (SELECT * FROM "creditTransactions" WHERE id = ${purchase.id} FOR UPDATE),
          dispute AS (
            SELECT GREATEST(0, -sum(amount))::integer AS remaining,
              GREATEST(0, sum(CASE WHEN amount < 0 THEN COALESCE(("txMetadata"->>'purchasedCreditsClawed')::integer, 0)
                ELSE -COALESCE(("txMetadata"->>'purchasedCreditsRestored')::integer, 0) END))::integer AS purchased
            FROM "creditTransactions" WHERE "stripePaymentIntentId" = ${paymentIntentId} AND "txType" = 'dispute'
              AND "txMetadata"->>'disputeId' = ${dispute.id}
          ), eligible AS (SELECT l.*, LEAST(l."clawedBackCredits", d.remaining) AS delta, d.purchased FROM locked l CROSS JOIN dispute d
            WHERE NOT EXISTS (SELECT 1 FROM "webhookEvents" WHERE "eventId" = ${`dispute-restore:${dispute.id}`})),
          wallet AS (
            UPDATE "creditBalances" cb SET balance = cb.balance + e.delta,
              "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN LEAST(e.delta,e.purchased) ELSE 0 END,
              "updatedAt" = now()
            FROM eligible e WHERE cb."userId" = e."userId" AND e.delta > 0 RETURNING cb."userId",e.delta,LEAST(e.delta,e.purchased) AS purchased
          ), counter AS (
            UPDATE "creditTransactions" t SET "clawedBackCredits" = t."clawedBackCredits" - w.delta FROM wallet w WHERE t.id = ${purchase.id} RETURNING t.id
          ), ledger AS (
            INSERT INTO "creditTransactions" ("userId",amount,"txType",description,"stripePaymentIntentId","txMetadata")
            SELECT w."userId",w.delta,'dispute','Dispute won: credits restored',${paymentIntentId},
              jsonb_build_object('disputeId',${dispute.id}::text,'restored',true,'purchasedCreditsRestored',w.purchased)
            FROM wallet w WHERE EXISTS (SELECT 1 FROM counter) RETURNING amount
          ), receipt AS (
            INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
            SELECT ${`dispute-restore:${dispute.id}`}, 'internal.dispute_restore', 'processed', 'Dispute restoration committed atomically' FROM ledger RETURNING id
          ) SELECT amount FROM ledger WHERE EXISTS (SELECT 1 FROM receipt)`));
        const restored = Number(restoration[0]?.amount ?? 0);

        if (restored <= 0) {
          await logWebhookEvent(
            "ignored",
            `charge.dispute.closed: dispute ${dispute.id} won but purchase counter shows nothing clawed — no-op`
          );
          break;
        }

        try {
          await createNotification(
            purchase.userId,
            "payment",
            "Dispute Resolved in Your Favor",
            `A disputed payment was resolved and ${restored} credit${restored === 1 ? "" : "s"} ` +
              `have been returned to your balance.`,
            { disputeId: dispute.id, chargeId, creditsRestored: restored }
          );
        } catch {}

        console.log(
          `[Stripe Webhook] Dispute won: ${restored} credits restored to user ${purchase.userId} (dispute ${dispute.id})`
        );
        await logWebhookEvent(
          "processed",
          `Dispute won: ${restored} credits restored to user ${purchase.userId} (dispute ${dispute.id})`
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
