import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { getOrCreateBalance } from "../stripe";
import { beginGenerationBatch, claimGenerationBatch, completeGenerationBatch } from "./generationBatchBilling";
import { assertCreditAmount, walletRows } from "./walletAccounting";
import { sanitizeErrorMessage } from "./errorSanitizer";

export interface PaidToolResponse<T = unknown> {
  status: "completed" | "pending" | "failed";
  requestId: string;
  creditCost: number;
  result?: T;
  error?: string;
  refundedCredits?: number;
  reconciliationRequired?: boolean;
}

/** Only throw after a confirmed rejection or a received, unusable result.
 * A transport timeout is ambiguous and must remain a normal Error. */
export class KnownPaidToolFailure extends Error {}

function key(kind: string, requestId: string) {
  if (!/^[a-z][a-z0-9-]{0,24}$/.test(kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tool request identity." });
  }
  return `${kind}:${requestId.toLowerCase()}`;
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
function pending<T>(requestId: string, credits: number, review = false): PaidToolResponse<T> {
  return { status: "pending", requestId, creditCost: credits, ...(review ? { reconciliationRequired: true } : {}) };
}

export async function getPaidToolOperation<T = unknown>(userId: number, kind: string, requestId: string): Promise<PaidToolResponse<T> | null> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for tool status.");
  const query = sql`SELECT b.id, b."executionToken", b.state, b.result, b."quotedCredits", b."errorCode"
    FROM "generationBatchRequests" b JOIN users u ON u.id = b."userId"
    WHERE b."userId" = ${userId} AND b."requestId" = ${key(kind, requestId)}
      AND u."loginMethod" IS DISTINCT FROM 'deleted' LIMIT 1`;
  let row = walletRows(await db.execute(query))[0];
  if (!row || row.errorCode === "account-deleted") return null;
  if (row.errorCode === "confirmed-tool-failure" && ["reserved", "submitting"].includes(row.state)) {
    await refundKnownFailure({ userId, id: Number(row.id), token: row.executionToken,
      error: sanitizeErrorMessage(row.result?.error ?? "The draft did not complete. Your credits were returned.") });
    row = walletRows(await db.execute(query))[0];
    if (!row || row.errorCode === "account-deleted") return null;
  }
  const value = row.result;
  if (row.state === "completed" && value?.status === "completed") return { status: "completed", requestId, creditCost: Number(row.quotedCredits), result: value.result as T };
  if (["refunded", "rejected"].includes(row.state)) return { status: "failed", requestId, creditCost: 0,
    refundedCredits: row.state === "refunded" ? Number(row.quotedCredits) : 0,
    error: typeof value?.error === "string" ? sanitizeErrorMessage(value.error) : "This request did not complete." };
  return pending(requestId, Number(row.quotedCredits), row.state === "reconciliation");
}

async function refundKnownFailure(input: { userId: number; id: number; token: string; error: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for tool refund.");
  return db.execute(sql`WITH locked AS (
      SELECT * FROM "generationBatchRequests" WHERE id = ${input.id} AND "userId" = ${input.userId}
        AND "executionToken" = ${input.token}::uuid AND state IN ('reserved', 'submitting')
        AND COALESCE("errorCode", '') <> 'account-deleted' FOR UPDATE
    ), wallet AS (
      UPDATE "creditBalances" cb SET balance = cb.balance + b."quotedCredits",
        "lifetimeSpent" = GREATEST(0, cb."lifetimeSpent" - b."quotedCredits"),
        "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN b."purchasedCreditsDebited" ELSE 0 END,
        "updatedAt" = now()
      FROM locked b WHERE cb."userId" = b."userId"
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND u."loginMethod" IS DISTINCT FROM 'deleted')
      RETURNING cb."userId"
    ), terminal AS (
      UPDATE "generationBatchRequests" b SET state = 'refunded', "errorCode" = 'confirmed-tool-failure',
        result = jsonb_build_object('status', 'failed', 'error', ${input.error}::text), "updatedAt" = now()
      FROM locked l WHERE b.id = l.id AND l."userId" IN (SELECT "userId" FROM wallet) RETURNING b.*
    ), ledger AS (
      INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
      SELECT "userId", "quotedCredits", 'refund', 'Confirmed tool operation failure',
        jsonb_build_object('batchRequestId', id, 'requestId', "requestId", 'purchasedCreditsRestored', "purchasedCreditsDebited")
      FROM terminal RETURNING id
    ) SELECT id FROM ledger`);
}

export async function runPaidToolOperation<T>(input: { userId: number; requestId: string; kind: string; payload: unknown; credits: number; description: string }, execute: () => Promise<T>): Promise<PaidToolResponse<T>> {
  assertCreditAmount(input.credits);
  if (input.credits < 1) throw new Error("Paid tool cost must be positive.");
  const requestKey = key(input.kind, input.requestId);
  const payloadHash = createHash("sha256").update(JSON.stringify(stable({ kind: input.kind, payload: input.payload }))).digest("hex");
  await getOrCreateBalance(input.userId);
  const claim = await claimGenerationBatch({ userId: input.userId, requestId: requestKey, payloadHash,
    credits: input.credits, description: input.description.slice(0, 256) });
  if (claim.kind === "conflict") throw new TRPCError({ code: "CONFLICT", message: "This request ID belongs to a different draft. Start a new request." });
  if (claim.kind !== "owned") return await getPaidToolOperation<T>(input.userId, input.kind, input.requestId) ?? pending(input.requestId, input.credits);
  let invoked = false;
  try {
    // A lost begin acknowledgment must never launch another provider call.
    if (!(await beginGenerationBatch(claim.id, claim.token))) return await getPaidToolOperation<T>(input.userId, input.kind, input.requestId) ?? pending(input.requestId, input.credits, true);
    invoked = true;
    const result = await execute();
    const envelope = { status: "completed", result };
    if (JSON.stringify(envelope).length > 131_072) throw new KnownPaidToolFailure("The generated draft was too large. Your credits were returned.");
    await completeGenerationBatch(claim.id, claim.token, envelope);
    return await getPaidToolOperation<T>(input.userId, input.kind, input.requestId) ?? pending(input.requestId, input.credits, true);
  } catch (error) {
    if (!invoked || error instanceof KnownPaidToolFailure) {
      const message = error instanceof KnownPaidToolFailure ? sanitizeErrorMessage(error.message) : "The draft could not start. Your credits were returned.";
      const db = await getDb();
      // Preserve the known outcome separately: a failed refund transaction can
      // then be safely retried on status access without rerunning the provider.
      await db?.execute(sql`UPDATE "generationBatchRequests" SET "errorCode" = 'confirmed-tool-failure',
        result = jsonb_build_object('status', 'failed', 'error', ${message}::text), "updatedAt" = now()
        WHERE id = ${claim.id} AND "userId" = ${input.userId} AND "executionToken" = ${claim.token}::uuid
          AND state IN ('reserved', 'submitting') AND COALESCE("errorCode", '') <> 'account-deleted'`).catch(() => undefined);
      await refundKnownFailure({ userId: input.userId, id: claim.id, token: claim.token, error: message }).catch(() => undefined);
    } else {
      const db = await getDb();
      await db?.execute(sql`UPDATE "generationBatchRequests" SET state = 'reconciliation', "errorCode" = 'tool-outcome-uncertain', "updatedAt" = now()
        WHERE id = ${claim.id} AND "userId" = ${input.userId} AND "executionToken" = ${claim.token}::uuid AND state = 'submitting'
          AND COALESCE("errorCode", '') <> 'account-deleted'`).catch(() => undefined);
    }
    return await getPaidToolOperation<T>(input.userId, input.kind, input.requestId).catch(() => null) ?? pending(input.requestId, input.credits, true);
  }
}
