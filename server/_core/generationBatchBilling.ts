import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { walletRows } from "./walletAccounting";

export async function claimGenerationBatch(input: { userId: number; requestId: string; payloadHash: string; credits: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for generation submission.");
  const read = async () => walletRows(await db.execute(sql`SELECT * FROM "generationBatchRequests" WHERE "userId" = ${input.userId} AND "requestId" = ${input.requestId}`))[0];
  const interpret = (r: any) => r.payloadHash !== input.payloadHash ? { kind: "conflict" as const }
    : r.result ? { kind: "replay" as const, result: r.result as Record<string, any>, state: r.state }
    : { kind: "pending" as const };
  const prior = await read();
  if (prior) return interpret(prior);
  const token = randomUUID();
  try {
    const rows = walletRows(await db.execute(sql`
      WITH prior AS (SELECT id FROM "generationBatchRequests" WHERE "userId" = ${input.userId} AND "requestId" = ${input.requestId}),
      locked AS (SELECT * FROM "creditBalances" WHERE "userId" = ${input.userId} FOR UPDATE),
      wallet AS (
        UPDATE "creditBalances" cb SET balance = l.balance - ${input.credits},
          "bonusCredits" = CASE WHEN l."walletAccountingVersion" = 1 THEN LEAST(l."bonusCredits", GREATEST(l.balance - ${input.credits}, 0)) ELSE l."bonusCredits" END,
          "lifetimeSpent" = l."lifetimeSpent" + ${input.credits}, "updatedAt" = now()
        FROM locked l WHERE cb.id = l.id AND l.balance >= ${input.credits}
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted') AND NOT EXISTS (SELECT 1 FROM prior)
        RETURNING cb.balance, CASE WHEN l."walletAccountingVersion" = 1 THEN l."bonusCredits" - cb."bonusCredits" ELSE 0 END AS purchased
      ), claimed AS (
        INSERT INTO "generationBatchRequests" ("userId", "requestId", "payloadHash", "executionToken", "quotedCredits", "purchasedCreditsDebited", state, result)
        SELECT ${input.userId}, ${input.requestId}, ${input.payloadHash}, ${token}::uuid, ${input.credits}, COALESCE((SELECT purchased FROM wallet), 0),
          CASE WHEN EXISTS (SELECT 1 FROM wallet) THEN 'reserved' ELSE 'rejected' END,
          CASE WHEN EXISTS (SELECT 1 FROM wallet) THEN NULL ELSE jsonb_build_object('status','failed','error','Not enough credits for this request.') END
        WHERE NOT EXISTS (SELECT 1 FROM prior) RETURNING *
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
        SELECT c."userId", -c."quotedCredits", 'usage', 'Uncensored image batch reservation',
          jsonb_build_object('batchRequestId', c.id, 'requestId', c."requestId", 'purchasedCreditsDebited', c."purchasedCreditsDebited")
        FROM claimed c WHERE c.state = 'reserved' RETURNING id
      ) SELECT c.*, (SELECT balance FROM wallet) AS balance FROM claimed c WHERE c.state = 'rejected' OR EXISTS (SELECT 1 FROM ledger)`));
    if (rows[0]?.state === "reserved") return { kind: "owned" as const, id: Number(rows[0].id), token,
      purchasedCreditsDebited: Number(rows[0].purchasedCreditsDebited), balance: Number(rows[0].balance) };
    if (rows[0]) return interpret(rows[0]);
  } catch (error) {
    const recovered = await read();
    if (recovered) return interpret(recovered);
    throw error;
  }
  const recovered = await read();
  return recovered ? interpret(recovered) : { kind: "pending" as const };
}

export async function beginGenerationBatch(id: number, token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for generation submission.");
  // A lost acknowledgment never permits submitting again.
  return walletRows(await db.execute(sql`UPDATE "generationBatchRequests" SET state = 'submitting', "updatedAt" = now()
    WHERE id = ${id} AND "executionToken" = ${token}::uuid AND state = 'reserved' AND COALESCE("errorCode",'') <> 'account-deleted'
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = "generationBatchRequests"."userId" AND COALESCE(u."loginMethod", '') <> 'deleted') RETURNING id`)).length === 1;
}
export async function completeGenerationBatch(id: number, token: string, result: Record<string, any>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for generation submission.");
  return walletRows(await db.execute(sql`UPDATE "generationBatchRequests" SET state = 'completed', result = ${JSON.stringify(result)}::jsonb, "updatedAt" = now()
    WHERE id = ${id} AND "executionToken" = ${token}::uuid AND state = 'submitting' AND COALESCE("errorCode",'') <> 'account-deleted' RETURNING id`)).length === 1;
}

export async function sweepGenerationBatches() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for generation recovery.");
  return db.execute(sql`
    WITH locked AS (SELECT * FROM "generationBatchRequests" WHERE state IN ('reserved','submitting') AND "updatedAt" < now() - interval '15 minutes' FOR UPDATE SKIP LOCKED),
    refundable AS (SELECT * FROM locked WHERE state = 'reserved'),
    totals AS (SELECT "userId", sum("quotedCredits")::integer AS amount, sum("purchasedCreditsDebited")::integer AS purchased FROM refundable GROUP BY "userId"),
    wallet AS (UPDATE "creditBalances" cb SET balance = cb.balance + t.amount, "lifetimeSpent" = GREATEST(0, cb."lifetimeSpent" - t.amount),
      "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN t.purchased ELSE 0 END
      FROM totals t WHERE cb."userId" = t."userId" AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND COALESCE(u."loginMethod", '') <> 'deleted') RETURNING cb."userId"),
    refunded AS (UPDATE "generationBatchRequests" b SET state = 'refunded', "errorCode" = 'stale_before_submit', "updatedAt" = now(),
      result = jsonb_build_object('status','failed','error','Submission expired. Your credits were returned.')
      FROM refundable f WHERE b.id = f.id AND f."userId" IN (SELECT "userId" FROM wallet) RETURNING b.*),
    ledger AS (INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
      SELECT "userId", "quotedCredits", 'refund', 'Expired image batch reservation', jsonb_build_object('batchRequestId', id, 'purchasedCreditsRestored', "purchasedCreditsDebited") FROM refunded RETURNING id),
    reviewed AS (UPDATE "generationBatchRequests" b SET state = 'reconciliation', "errorCode" = 'submission_outcome_uncertain', "updatedAt" = now()
      FROM locked l WHERE b.id = l.id AND l.state = 'submitting' RETURNING b.id)
    SELECT (SELECT count(*) FROM ledger) AS refunded, (SELECT count(*) FROM reviewed) AS reconciliation`);
}
