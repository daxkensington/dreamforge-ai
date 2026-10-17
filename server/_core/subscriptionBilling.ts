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
           SET balance = sp."monthlyCredits" + cb."bonusCredits" + LEAST(cb.balance, 0),
               "monthlyAllocation" = sp."monthlyCredits",
               "lastResetAt" = (statement_timestamp() AT TIME ZONE 'UTC')
          FROM "userSubscriptions" us JOIN "subscriptionPlans" sp ON sp.id = us."planId"
         WHERE us."stripeSubscriptionId" = ${input.subscriptionId}
            AND cb."userId" = us."userId"
            AND cb."walletAccountingVersion" = 1
            AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted')
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
      ), paid_period AS (
        INSERT INTO "subscriptionCreditPeriods" ("userId", "stripeSubscriptionId", "stripeInvoiceId", "subscriptionItemId", "priceId", "periodStart", "periodEnd", "monthlyCredits", "lastAllowanceIndex")
        SELECT c."userId", ${input.subscriptionId}, ${input.invoiceId}, ${input.subscriptionItemId}, ${input.priceId},
          (${startIso}::timestamptz AT TIME ZONE 'UTC'), (${endIso}::timestamptz AT TIME ZONE 'UTC'), c.amount,
          COALESCE((SELECT max(n) FROM generate_series(0, 11) n WHERE (${startIso}::timestamptz AT TIME ZONE 'UTC') + make_interval(months => n) <= (statement_timestamp() AT TIME ZONE 'UTC')), 0)
        FROM changed c WHERE EXISTS (SELECT 1 FROM ledger) RETURNING id
      ), period_receipt AS (
        INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
        SELECT ${periodEventId}, 'internal.subscription.period_allocation', 'processed', 'Verified subscription service period allocated atomically'
          FROM paid_period RETURNING id
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
      throw new Error("Subscription invoice requires a current verified service period, saved plan and wallet with an approved opening balance (wallet_accounting_review_required); reconcile before retrying.");
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

/** Lazy monthly replenishment is backed only by a previously verified paid invoice. */
export async function refreshPaidSubscriptionAllowance(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for paid allowance.");
  // Lock the wallet in a preceding READ COMMITTED statement: concurrent readers
  // then observe the latest period cursor rather than the pre-lock snapshot.
  await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(sql`SELECT id FROM "creditBalances" WHERE "userId" = ${userId} FOR UPDATE`),
    db.execute(sql`
      WITH current_period AS (
        SELECT p.*, allowance.n AS next_index
        FROM "subscriptionCreditPeriods" p
        JOIN "userSubscriptions" us ON us."stripeSubscriptionId" = p."stripeSubscriptionId" AND us."userId" = p."userId"
        CROSS JOIN LATERAL (SELECT max(n)::integer AS n FROM generate_series(0,11) n
          WHERE p."periodStart" + make_interval(months => n) <= (statement_timestamp() AT TIME ZONE 'UTC')) allowance
        WHERE p."userId" = ${userId} AND p."periodStart" <= (statement_timestamp() AT TIME ZONE 'UTC')
          AND p."periodEnd" > (statement_timestamp() AT TIME ZONE 'UTC') AND us."subStatus" IN ('active','trialing')
          AND us."currentPeriodStart" = p."periodStart" AND us."currentPeriodEnd" = p."periodEnd"
          AND us.id = (SELECT "userSubscriptions".id FROM "userSubscriptions" WHERE "userSubscriptions"."userId" = p."userId"
            ORDER BY ${sql.join(currentSubscriptionOrder(), sql`, `)} LIMIT 1)
          AND allowance.n > p."lastAllowanceIndex"
        ORDER BY p."periodStart" DESC, p.id DESC LIMIT 1
      ), wallet AS (
        UPDATE "creditBalances" cb SET balance = p."monthlyCredits" + cb."bonusCredits" + LEAST(cb.balance, 0),
          "monthlyAllocation" = p."monthlyCredits", "lastResetAt" = (statement_timestamp() AT TIME ZONE 'UTC')
        FROM current_period p WHERE cb."userId" = p."userId" AND cb."walletAccountingVersion" = 1
            AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted') RETURNING cb."userId"
      ), advanced AS (
        UPDATE "subscriptionCreditPeriods" p SET "lastAllowanceIndex" = c.next_index FROM current_period c
        WHERE p.id = c.id AND EXISTS (SELECT 1 FROM wallet) RETURNING p.*, c.next_index
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
        SELECT p."userId", p."monthlyCredits", 'subscription', 'Monthly allowance from verified prepaid invoice',
          jsonb_build_object('stripeInvoiceId', p."stripeInvoiceId", 'stripeSubscriptionId', p."stripeSubscriptionId", 'allowanceIndex', p.next_index,
            'allowanceStart', p."periodStart" + make_interval(months => p.next_index), 'paidPeriodEnd', p."periodEnd")
        FROM advanced p RETURNING id
      ), receipt AS (
        INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
        SELECT 'subscription-allowance:' || p."stripeInvoiceId" || ':' || p.next_index,
          'internal.subscription.monthly_allowance', 'processed', 'Verified prepaid monthly allowance committed atomically'
        FROM advanced p WHERE EXISTS (SELECT 1 FROM ledger) RETURNING id
      ) SELECT id FROM receipt`),
  ]);
}
