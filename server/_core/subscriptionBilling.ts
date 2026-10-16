import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { currentSubscriptionOrder } from "./subscriptionSelection";

const receiptKey = (invoiceId: string) => `subscription-invoice:${invoiceId}`;
export interface PaidSubscriptionInvoiceMapping {
  invoiceId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  priceId: string;
  periodStart: Date;
  periodEnd: Date;
}

/** Existing receipt lookup is safe even after the paid interval has ended. */
export async function hasPaidSubscriptionInvoiceAllocation(input: PaidSubscriptionInvoiceMapping): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available for subscription invoice receipt lookup.");
  const result: any = await db.execute(sql`
    SELECT w.id FROM "webhookEvents" w WHERE w."eventId" = ${receiptKey(input.invoiceId)}
      AND w."eventType" = 'internal.subscription.invoice_allocation' AND w."webhookStatus" = 'processed'
      AND EXISTS (SELECT 1 FROM "creditTransactions" tx WHERE tx."txType" = 'subscription'
        AND tx."txMetadata"->>'stripeInvoiceId' = ${input.invoiceId}
        AND tx."txMetadata"->>'stripeSubscriptionId' = ${input.subscriptionId}
        AND tx."txMetadata"->>'subscriptionItemId' = ${input.subscriptionItemId}
        AND tx."txMetadata"->>'priceId' = ${input.priceId}
        AND tx."txMetadata"->>'periodStart' = ${input.periodStart.toISOString()}
        AND tx."txMetadata"->>'periodEnd' = ${input.periodEnd.toISOString()})
  `);
  return (result.rows ?? result).length === 1;
}

/** A verified paid invoice grants once, across both supported Stripe event types. */
export async function allocatePaidSubscriptionInvoice(input: PaidSubscriptionInvoiceMapping): Promise<"allocated" | "duplicate"> {
  if (!/^in_[A-Za-z0-9_]{1,120}$/.test(input.invoiceId) || !/^sub_[A-Za-z0-9_]{1,120}$/.test(input.subscriptionId)
    || !/^si_[A-Za-z0-9_]{1,120}$/.test(input.subscriptionItemId) || !/^price_[A-Za-z0-9_]{1,120}$/.test(input.priceId)) {
    throw new Error("Invalid subscription invoice mapping.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available for subscription invoice allocation.");
  const eventId = receiptKey(input.invoiceId);
  const start = input.periodStart?.getTime();
  const end = input.periodEnd?.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Verified invoice service period is required.");
  const startIso = input.periodStart.toISOString();
  const endIso = input.periodEnd.toISOString();
  const periodEventId = `subscription-period:${input.subscriptionId}:${start / 1000}:${end / 1000}`;
  const duplicateReceipt = async () => {
    const result: any = await db.execute(sql`
      SELECT w.id FROM "webhookEvents" w WHERE w."eventId" = ${eventId}
        AND w."eventType" = 'internal.subscription.invoice_allocation' AND w."webhookStatus" = 'processed'
        AND EXISTS (SELECT 1 FROM "creditTransactions" tx WHERE tx."txType" = 'subscription'
          AND tx."txMetadata"->>'stripeInvoiceId' = ${input.invoiceId}
          AND tx."txMetadata"->>'stripeSubscriptionId' = ${input.subscriptionId}
          AND tx."txMetadata"->>'subscriptionItemId' = ${input.subscriptionItemId}
          AND tx."txMetadata"->>'priceId' = ${input.priceId}
          AND tx."txMetadata"->>'periodStart' = ${startIso} AND tx."txMetadata"->>'periodEnd' = ${endIso})
    `);
    return (result.rows ?? result).length === 1;
  };
  if (await duplicateReceipt()) return "duplicate";
  try {
    // The receipt is inserted LAST without ON CONFLICT. A concurrent unique
    // collision aborts the whole transaction, including wallet and ledger writes.
    const allocationSQL = sql`
      WITH changed AS (
        UPDATE "creditBalances" cb
           SET balance = sp."monthlyCredits" + cb."bonusCredits",
               "bonusCredits" = 0,
               "monthlyAllocation" = sp."monthlyCredits",
               "lastResetAt" = (statement_timestamp() AT TIME ZONE 'UTC')
          FROM "userSubscriptions" us JOIN "subscriptionPlans" sp ON sp.id = us."planId"
         WHERE us."stripeSubscriptionId" = ${input.subscriptionId}
           AND cb."userId" = us."userId"
           AND us."subStatus" IN ('active', 'trialing')
           AND sp.name IN ('creator', 'pro', 'studio', 'business', 'agency', 'enterprise')
           AND us.id = (
             SELECT "userSubscriptions".id FROM "userSubscriptions"
              WHERE "userSubscriptions"."userId" = us."userId"
              ORDER BY ${sql.join(currentSubscriptionOrder(), sql`, `)} LIMIT 1
           )
           AND us."currentPeriodStart" = (${startIso}::timestamptz AT TIME ZONE 'UTC')
           AND us."currentPeriodEnd" = (${endIso}::timestamptz AT TIME ZONE 'UTC')
           AND us."currentPeriodStart" <= (statement_timestamp() AT TIME ZONE 'UTC')
           AND us."currentPeriodEnd" > (statement_timestamp() AT TIME ZONE 'UTC')
        RETURNING cb."userId", sp.id AS "planId", sp.name AS "planName", sp."monthlyCredits" AS amount
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
        SELECT "userId", amount, 'subscription', 'Verified paid subscription invoice allocation',
               jsonb_build_object('stripeInvoiceId', ${input.invoiceId}::text,
                 'stripeSubscriptionId', ${input.subscriptionId}::text, 'periodStart', ${startIso}::text,
                 'periodEnd', ${endIso}::text, 'subscriptionItemId', ${input.subscriptionItemId}::text,
                 'priceId', ${input.priceId}::text, 'planId', "planId", 'planName', "planName")
          FROM changed
        RETURNING id
      ), period_receipt AS (
        INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
        SELECT ${periodEventId}, 'internal.subscription.period_allocation', 'processed', 'Verified subscription service period allocated atomically'
          FROM ledger RETURNING id
      ), receipt AS (
        INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
        SELECT ${eventId}, 'internal.subscription.invoice_allocation', 'processed', 'Verified paid invoice credits allocated atomically'
          FROM period_receipt
        RETURNING id
      ) SELECT id FROM receipt
    `;
    // Neon HTTP supports static batches, not interactive transactions. Lock the
    // shared wallet first; the following READ COMMITTED statement then sees any
    // newer subscription allocation that completed while this request waited.
    const batch: any = await db.batch([
      db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
      db.execute(sql`SELECT cb.id FROM "creditBalances" cb
        JOIN "userSubscriptions" us ON us."userId" = cb."userId"
        WHERE us."stripeSubscriptionId" = ${input.subscriptionId} FOR UPDATE OF cb`),
      db.execute(allocationSQL),
    ]);
    const result: any = batch[2];
    if ((result.rows ?? result).length !== 1) {
      throw new Error("Subscription invoice requires a current verified service period, saved plan and wallet; reconcile before retrying.");
    }
    return "allocated";
  } catch (error: any) {
    const code = error?.code ?? error?.cause?.code;
    if (code === "23505") {
      if (await duplicateReceipt()) return "duplicate";
      throw new Error("Invoice or subscription period already belongs to another allocation; reconcile before retrying.", { cause: error });
    }
    throw error;
  }
}
