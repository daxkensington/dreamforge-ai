import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

export const walletRows = (value: any): any[] => value?.rows ?? value ?? [];
export function assertCreditAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 2_147_483_647) throw new Error("Invalid credit amount.");
}

/** Wallet change and immutable provenance ledger always commit together. */
export async function debitWallet(userId: number, amount: number, description: string, type: string, metadata?: Record<string, unknown>) {
  assertCreditAmount(amount);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for credit debit.");
  const operationId = randomUUID();
  const result = walletRows(await db.execute(sql`
    WITH locked AS (SELECT * FROM "creditBalances" WHERE "userId" = ${userId} FOR UPDATE),
    wallet AS (
      UPDATE "creditBalances" cb SET balance = l.balance - ${amount},
        "bonusCredits" = CASE WHEN l."walletAccountingVersion" = 1 THEN LEAST(l."bonusCredits", GREATEST(l.balance - ${amount}, 0)) ELSE l."bonusCredits" END,
        "lifetimeSpent" = l."lifetimeSpent" + ${amount}, "updatedAt" = now()
      FROM locked l WHERE cb.id = l.id AND l.balance >= ${amount}
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted')
      RETURNING cb.balance, CASE WHEN l."walletAccountingVersion" = 1 THEN l."bonusCredits" - cb."bonusCredits" ELSE 0 END AS "purchasedCreditsDebited"
    ), ledger AS (
      INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
      SELECT ${userId}, -(${amount}::integer), ${type}::"txType", ${description},
        ${JSON.stringify(metadata ?? {})}::jsonb || jsonb_build_object('operationId', ${operationId}::text, 'purchasedCreditsDebited', w."purchasedCreditsDebited")
      FROM wallet w RETURNING id
    ) SELECT w.*, l.id AS "transactionId" FROM wallet w CROSS JOIN ledger l
  `));
  return result[0] ? { success: true as const, balance: Number(result[0].balance), needed: amount, transactionId: Number(result[0].transactionId), purchasedCreditsDebited: Number(result[0].purchasedCreditsDebited) }
    : { success: false as const, balance: 0, needed: amount, transactionId: undefined, purchasedCreditsDebited: 0 };
}

/** The checkout-session receipt excludes both racing deliveries and lost acknowledgments. */
export async function grantWalletCredits(input: { userId: number; amount: number; description: string; purchased: boolean; sessionId?: string; paymentIntentId?: string }) {
  assertCreditAmount(input.amount);
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for credit grant.");
  const key = input.sessionId ? `credit-pack:${input.sessionId}` : `credit-grant:${randomUUID()}`;
  const prior = async () => walletRows(await db.execute(sql`
    SELECT t.id FROM "creditTransactions" t WHERE t."userId" = ${input.userId} AND t.amount = ${input.amount}
      AND t."txType" = 'purchase' AND t."stripeSessionId" = ${input.sessionId ?? null}
      AND (${input.paymentIntentId ?? null}::text IS NULL OR t."stripePaymentIntentId" = ${input.paymentIntentId ?? null}) LIMIT 1`)).length > 0;
  if (input.sessionId && await prior()) return "duplicate" as const;
  try {
    const result = walletRows(await db.execute(sql`
      WITH wallet AS (
        UPDATE "creditBalances" cb SET balance = cb.balance + ${input.amount},
          "bonusCredits" = cb."bonusCredits" + ${input.purchased ? input.amount : 0}, "updatedAt" = now()
        WHERE cb."userId" = ${input.userId}
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted')
          AND NOT EXISTS (SELECT 1 FROM "webhookEvents" WHERE "eventId" = ${key}) RETURNING cb.id
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "stripeSessionId", "stripePaymentIntentId", "txMetadata")
        SELECT ${input.userId}, ${input.amount}, 'purchase', ${input.description}, ${input.sessionId ?? null}, ${input.paymentIntentId ?? null},
          jsonb_build_object('purchasedCredits', ${input.purchased ? input.amount : 0}::integer, 'operationKey', ${key}::text) FROM wallet RETURNING id
      ), receipt AS (
        INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
        SELECT ${key}, 'internal.credit_grant', 'processed', 'Credit grant committed atomically' FROM ledger RETURNING id
      ) SELECT id FROM receipt`));
    if (result.length === 1) return "granted" as const;
  } catch (error) {
    // A unique collision rolls the wallet and ledger back; an acknowledgment may also be lost.
    if (input.sessionId && await prior()) return "duplicate" as const;
    throw error;
  }
  if (input.sessionId && await prior()) return "duplicate" as const;
  throw new Error("Credit grant could not be confirmed; retry the same payment.");
}

export async function refundWallet(userId: number, amount: number, reason: string, options: { purchasedCredits?: number; operationKey?: string } = {}) {
  assertCreditAmount(amount);
  const purchased = options.purchasedCredits ?? 0;
  assertCreditAmount(purchased);
  if (purchased > amount) throw new Error("Invalid refund provenance.");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for refund.");
  const key = options.operationKey ?? `credit-refund:${randomUUID()}`;
  const result = walletRows(await db.execute(sql`
    WITH wallet AS (
      UPDATE "creditBalances" cb SET balance = cb.balance + ${amount},
        "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN ${purchased} ELSE 0 END,
        "lifetimeSpent" = GREATEST(cb."lifetimeSpent" - ${amount}, 0), "updatedAt" = now()
      WHERE cb."userId" = ${userId} AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted') AND NOT EXISTS (SELECT 1 FROM "webhookEvents" WHERE "eventId" = ${key}) RETURNING id
    ), ledger AS (
      INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
      SELECT ${userId}, ${amount}, 'refund', ${reason}, jsonb_build_object('operationKey', ${key}::text, 'purchasedCreditsRestored', ${purchased}::integer) FROM wallet RETURNING id
    ), receipt AS (
      INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
      SELECT ${key}, 'internal.credit_refund', 'processed', 'Credit refund committed atomically' FROM ledger RETURNING id
    ) SELECT id FROM receipt`));
  return { success: true, refunded: result.length ? amount : 0 };
}

/** The terminal job claim, refund and receipt form one transaction. Failed rows remain retryable after SQL failure. */
export async function failLegacyJobAndRefund(input: { table: "generations" | "audioGenerations"; id: number; userId: number; amount: number; reason: string; purchasedCredits?: number }) {
  assertCreditAmount(input.amount);
  const purchased = Math.min(input.amount, Math.max(0, input.purchasedCredits ?? 0));
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for job refund.");
  const table = sql.identifier(input.table);
  const status = sql.identifier(input.table === "generations" ? "status" : "audioStatus");
  const key = `job-refund:${input.table}:${input.id}`;
  const fence = input.table === "generations" ? sql`AND g.metadata->>'billingRequestId' IS NULL AND COALESCE(g.metadata->>'deleted', 'false') <> 'true'` : sql``;
  try {
    const result = walletRows(await db.execute(sql`
      WITH claimed AS (
        UPDATE ${table} g SET ${status} = 'failed', "errorMessage" = ${input.reason}, "updatedAt" = now()
        WHERE g.id = ${input.id} AND g."userId" = ${input.userId} AND g.${status}::text IN ('pending','generating') ${fence}
          AND NOT EXISTS (SELECT 1 FROM "webhookEvents" WHERE "eventId" = ${key})
          AND EXISTS (SELECT 1 FROM "creditBalances" WHERE "userId" = ${input.userId})
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = g."userId" AND COALESCE(u."loginMethod", '') <> 'deleted') RETURNING g.id
      ), wallet AS (
        UPDATE "creditBalances" cb SET balance = cb.balance + ${input.amount},
          "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN ${purchased} ELSE 0 END,
          "lifetimeSpent" = GREATEST(cb."lifetimeSpent" - ${input.amount}, 0), "updatedAt" = now()
        WHERE cb."userId" = ${input.userId} AND EXISTS (SELECT 1 FROM claimed) RETURNING id
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
        SELECT ${input.userId}, ${input.amount}, 'refund', ${input.reason}, jsonb_build_object('operationKey', ${key}::text, 'purchasedCreditsRestored', ${purchased}::integer)
        FROM wallet RETURNING id
      ), receipt AS (
        INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
        SELECT ${key}, 'internal.job_refund', 'processed', 'Failed job and exact refund committed atomically' FROM ledger RETURNING id
      ) SELECT id FROM receipt`));
    return result.length === 1;
  } catch (error: any) {
    if ((error?.code ?? error?.cause?.code) === "23505") return false;
    throw error;
  }
}
