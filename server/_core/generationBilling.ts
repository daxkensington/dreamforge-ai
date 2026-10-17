import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { getOrCreateBalance } from "../stripe";

export type GenerationRequestState = "reserved" | "rendering" | "completed" | "rejected" | "refunded" | "reconciliation";
export interface GenerationRequestIdentity { userId: number; requestId: string; payloadHash: string }
export interface GenerationRequestOwner extends GenerationRequestIdentity { id: number; executionToken: string }
export interface GenerationRequestRecord extends GenerationRequestIdentity {
  id: number;
  quotedCredits: number;
  state: GenerationRequestState;
  generationId: number | null;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  debitedAt: Date | string | null;
  refundedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
export type GenerationReplay = { kind: "replay"; request: GenerationRequestRecord };
export type GenerationUncertain = { kind: "uncertain"; requestId: string };
export type GenerationConflict = { kind: "conflict"; requestId: string };
export type GenerationClaimResult =
  | { kind: "owned"; owner: GenerationRequestOwner; request: GenerationRequestRecord }
  | GenerationReplay | GenerationUncertain | GenerationConflict;
export type GenerationTransitionResult<K extends string> =
  | { kind: K; request: GenerationRequestRecord }
  | GenerationReplay | GenerationUncertain | GenerationConflict;

export interface GenerationBillingDriver {
  execute(query: SQL): Promise<unknown>;
  initializeBalance(userId: number): Promise<unknown>;
  makeExecutionToken?: () => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertIdentity(identity: GenerationRequestIdentity) {
  if (!Number.isSafeInteger(identity.userId) || identity.userId < 1 || !UUID.test(identity.requestId) || !/^[0-9a-f]{64}$/.test(identity.payloadHash)) {
    throw new Error("Invalid generation request identity.");
  }
}
function assertOwner(owner: GenerationRequestOwner) {
  assertIdentity(owner);
  if (!Number.isSafeInteger(owner.id) || owner.id < 1 || !UUID.test(owner.executionToken)) throw new Error("Invalid generation request owner.");
}
function assertGenerationId(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid generation identifier.");
}
function rows(result: unknown): Record<string, unknown>[] {
  const values = Array.isArray(result) ? result : (result as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(values)) throw new Error("Invalid generation billing database response.");
  return values as Record<string, unknown>[];
}
function record(row: Record<string, unknown>): GenerationRequestRecord {
  // Pick fields explicitly so the internal owner token can never leak through a replay.
  return {
    id: Number(row.id), userId: Number(row.userId), requestId: String(row.requestId), payloadHash: String(row.payloadHash),
    quotedCredits: Number(row.quotedCredits), state: row.state as GenerationRequestState,
    generationId: row.generationId == null ? null : Number(row.generationId),
    result: row.result == null ? null : row.result as Record<string, unknown>,
    errorCode: row.errorCode == null ? null : String(row.errorCode),
    debitedAt: row.debitedAt as Date | string | null, refundedAt: row.refundedAt as Date | string | null,
    createdAt: row.createdAt as Date | string, updatedAt: row.updatedAt as Date | string,
  };
}
function errorCode(value: string) {
  if (!/^[a-z0-9_-]{1,128}$/.test(value)) throw new Error("Invalid generation failure code.");
  return value;
}
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown })?.code === "23505" || (error as { cause?: { code?: unknown } })?.cause?.code === "23505";
}
function terminalJson(result: Record<string, unknown> | undefined, status: "completed" | "failed") {
  if (result === undefined) return null;
  const json = JSON.stringify(result);
  if (!json || json.length > 65_536 || result.status !== status) throw new Error("Invalid generation replay result.");
  return json;
}

/** All mutations are single PostgreSQL statements: compatible with Neon HTTP. */
export function createGenerationBillingStore(driver: GenerationBillingDriver) {
  async function readGenerationRequest(identity: Pick<GenerationRequestIdentity, "userId" | "requestId">) {
    if (!Number.isSafeInteger(identity.userId) || identity.userId < 1 || !UUID.test(identity.requestId)) throw new Error("Invalid generation request identity.");
    const result = rows(await driver.execute(sql`/* generation-billing:read */
      SELECT r.* FROM "generationRequests" r WHERE r."userId" = ${identity.userId} AND r."requestId" = ${identity.requestId}::uuid`));
    return result[0] ? record(result[0]) : null;
  }
  async function recover(identity: GenerationRequestIdentity): Promise<GenerationReplay | GenerationUncertain | GenerationConflict> {
    try {
      const existing = await readGenerationRequest(identity);
      if (!existing) return { kind: "uncertain", requestId: identity.requestId };
      return existing.payloadHash === identity.payloadHash
        ? { kind: "replay", request: existing }
        : { kind: "conflict", requestId: identity.requestId };
    } catch {
      return { kind: "uncertain", requestId: identity.requestId };
    }
  }
  async function transition<K extends string>(owner: GenerationRequestOwner, query: SQL, kind: K): Promise<GenerationTransitionResult<K>> {
    try {
      const result = rows(await driver.execute(query));
      if (result[0]) return { kind, request: record(result[0]) };
    } catch {
      // An HTTP acknowledgment can be lost after commit. Read; never replay provider work.
    }
    const recovered = await recover(owner);
    if (recovered.kind === "replay" && (kind === "completed" && recovered.request.state === "completed" || kind === "refunded" && recovered.request.state === "refunded" || kind === "reconciliation" && recovered.request.state === "reconciliation")) {
      return { kind, request: recovered.request };
    }
    // A lost begin acknowledgment MUST NOT authorize another provider submission.
    return recovered;
  }

  async function claimGenerationRequest(input: GenerationRequestIdentity & { credits: number; rejectedResult?: Record<string, unknown> }): Promise<GenerationClaimResult> {
    assertIdentity(input);
    if (!Number.isSafeInteger(input.credits) || input.credits < 1 || input.credits > 2_147_483_647) throw new Error("Invalid generation credit quote.");
    const rejectedJson = terminalJson(input.rejectedResult, "failed");
    // Preserve the existing daily grant policy. Only initialization is retried on its unique race.
    try { await driver.initializeBalance(input.userId); }
    catch (error) { if (!isUniqueViolation(error)) throw error; await driver.initializeBalance(input.userId); }
    const token = (driver.makeExecutionToken ?? randomUUID)();
    if (!UUID.test(token)) throw new Error("Invalid generation owner token.");
    try {
      const result = rows(await driver.execute(sql`/* generation-billing:claim */
        WITH prior AS (
          SELECT id FROM "generationRequests" WHERE "userId" = ${input.userId} AND "requestId" = ${input.requestId}::uuid
        ), wallet_before AS (
          SELECT cb.* FROM "creditBalances" cb WHERE cb."userId" = ${input.userId}
            AND EXISTS (SELECT 1 FROM users u WHERE u.id = cb."userId" AND u."loginMethod" IS DISTINCT FROM 'deleted') FOR UPDATE
        ), wallet AS (
          UPDATE "creditBalances" cb SET balance = wb.balance - ${input.credits},
            "bonusCredits" = CASE WHEN wb."walletAccountingVersion" = 1 THEN LEAST(wb."bonusCredits", GREATEST(wb.balance - ${input.credits}, 0)) ELSE wb."bonusCredits" END,
            "lifetimeSpent" = wb."lifetimeSpent" + ${input.credits}, "updatedAt" = now()
          FROM wallet_before wb WHERE cb.id = wb.id AND wb.balance >= ${input.credits} AND NOT EXISTS (SELECT 1 FROM prior)
          RETURNING cb.balance, CASE WHEN wb."walletAccountingVersion" = 1 THEN wb."bonusCredits" - cb."bonusCredits" ELSE 0 END AS "purchasedCreditsDebited"
        ), claimed AS (
          INSERT INTO "generationRequests" ("userId", "requestId", "payloadHash", "executionToken", "quotedCredits", state, "debitedAt", "errorCode", result)
          SELECT ${input.userId}, ${input.requestId}::uuid, ${input.payloadHash}, ${token}::uuid, ${input.credits},
            CASE WHEN EXISTS (SELECT 1 FROM wallet) THEN 'reserved' ELSE 'rejected' END,
            CASE WHEN EXISTS (SELECT 1 FROM wallet) THEN now() ELSE NULL END,
            CASE WHEN EXISTS (SELECT 1 FROM wallet) THEN NULL ELSE 'insufficient_credits' END,
            CASE WHEN EXISTS (SELECT 1 FROM wallet) THEN NULL ELSE COALESCE(${rejectedJson}::text::jsonb,
              jsonb_build_object('requestId', ${input.requestId}::uuid, 'status', 'failed', 'error', 'Insufficient credits.', 'needed', ${input.credits}::integer, 'creditCost', 0)) END
          WHERE NOT EXISTS (SELECT 1 FROM prior)
            AND EXISTS (SELECT 1 FROM users u WHERE u.id = ${input.userId} AND u."loginMethod" IS DISTINCT FROM 'deleted')
          RETURNING *
        ), ledger AS (
          INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
          SELECT c."userId", -c."quotedCredits", 'usage', 'Generation request debit',
            jsonb_build_object('generationRequestId', c.id, 'requestId', c."requestId", 'purchasedCreditsDebited', wallet."purchasedCreditsDebited")
          FROM claimed c CROSS JOIN wallet RETURNING id
        )
        SELECT c.* FROM claimed c WHERE c.state = 'rejected' OR EXISTS (SELECT 1 FROM ledger)
      `));
      if (result[0]) {
        const request = record(result[0]);
        if (request.state === "reserved") return { kind: "owned", request, owner: { userId: input.userId, requestId: input.requestId, payloadHash: input.payloadHash, id: request.id, executionToken: token } };
        return { kind: "replay", request };
      }
    } catch {
      // No ON CONFLICT: a simultaneous unique insert rolls back its entire debit+ledger.
      // A fresh read also handles a statement whose successful response was lost.
    }
    return recover(input);
  }

  async function beginGenerationRequest(owner: GenerationRequestOwner, generationId: number): Promise<GenerationTransitionResult<"begun">> {
    assertOwner(owner); assertGenerationId(generationId);
    return transition(owner, sql`/* generation-billing:begin */
      WITH eligible AS (
        SELECT r.* FROM "generationRequests" r WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId}
          AND r."requestId" = ${owner.requestId}::uuid AND r."payloadHash" = ${owner.payloadHash}
          AND r."executionToken" = ${owner.executionToken}::uuid AND r.state = 'reserved'
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = r."userId" AND u."loginMethod" IS DISTINCT FROM 'deleted') FOR UPDATE
      ), owned_generation AS (
        SELECT g.id FROM generations g JOIN eligible r ON g."userId" = r."userId"
          WHERE g.id = ${generationId} AND lower(g.metadata->>'billingRequestId') = r."requestId"::text
            AND g.status IN ('pending', 'generating') FOR UPDATE OF g
      )
      UPDATE "generationRequests" r SET state = 'rendering', "generationId" = ${generationId}, "updatedAt" = now()
      WHERE r.id IN (SELECT id FROM eligible) AND EXISTS (SELECT 1 FROM owned_generation) RETURNING r.*
    `, "begun");
  }

  async function completeGenerationRequest(owner: GenerationRequestOwner, input: {
    result: Record<string, unknown>; imageUrl: string; thumbnailUrl?: string; metadata?: Record<string, unknown> | null;
  }): Promise<GenerationTransitionResult<"completed">> {
    assertOwner(owner);
    if (!input.imageUrl?.trim()) throw new Error("Missing generation output URL.");
    const resultJson = terminalJson(input.result, "completed");
    if (!resultJson) throw new Error("Missing generation replay result.");
    const metadataJson = input.metadata == null ? null : JSON.stringify(input.metadata);
    return transition(owner, sql`/* generation-billing:complete */
      WITH eligible AS (
        SELECT r.* FROM "generationRequests" r WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId}
          AND r."requestId" = ${owner.requestId}::uuid AND r."payloadHash" = ${owner.payloadHash}
          AND r."executionToken" = ${owner.executionToken}::uuid AND r.state IN ('rendering', 'reconciliation')
          AND COALESCE(r."errorCode", '') <> 'account-deleted' FOR UPDATE
      ), completed_generation AS (
        UPDATE generations g SET status = 'completed', "imageUrl" = ${input.imageUrl},
          "thumbnailUrl" = ${input.thumbnailUrl ?? input.imageUrl}, "errorMessage" = NULL,
          metadata = CASE WHEN ${input.metadata !== undefined} THEN ${metadataJson}::text::jsonb ELSE g.metadata END, "updatedAt" = now()
        FROM eligible r WHERE g.id = r."generationId" AND g."userId" = r."userId"
          AND lower(g.metadata->>'billingRequestId') = r."requestId"::text AND g.status IN ('pending', 'generating') RETURNING g.id
      )
      UPDATE "generationRequests" r SET state = 'completed', result = ${resultJson}::text::jsonb, "errorCode" = NULL, "updatedAt" = now()
      WHERE r.id IN (SELECT id FROM eligible) AND EXISTS (SELECT 1 FROM completed_generation) RETURNING r.*
    `, "completed");
  }

  async function failGenerationRequestAndRefund(owner: GenerationRequestOwner, input: {
    confirmedFailure: true; errorCode: string; errorMessage: string; generationId?: number; result?: Record<string, unknown>;
  }): Promise<GenerationTransitionResult<"refunded">> {
    assertOwner(owner); errorCode(input.errorCode);
    if (input.confirmedFailure !== true) throw new Error("A confirmed generation failure is required for a refund.");
    if (input.generationId !== undefined) assertGenerationId(input.generationId);
    const message = input.errorMessage.slice(0, 1000);
    const failedJson = terminalJson(input.result, "failed");
    return transition(owner, sql`/* generation-billing:refund */
      WITH locked AS (
        SELECT r.* FROM "generationRequests" r WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId}
          AND r."requestId" = ${owner.requestId}::uuid AND r."payloadHash" = ${owner.payloadHash}
          AND r."executionToken" = ${owner.executionToken}::uuid AND r.state IN ('reserved', 'rendering', 'reconciliation')
          AND COALESCE(r."errorCode", '') <> 'account-deleted'
          AND (r."generationId" IS NULL OR ${input.generationId ?? null}::integer IS NULL OR r."generationId" = ${input.generationId ?? null})
          AND r."refundedAt" IS NULL FOR UPDATE
      ), orphans AS (
        SELECT r.id, count(g.id) AS orphan_count, min(g.id) AS orphan_id
        FROM locked r LEFT JOIN generations g ON g."userId" = r."userId" AND lower(g.metadata->>'billingRequestId') = r."requestId"::text
        GROUP BY r.id
      ), ambiguous AS (
        UPDATE "generationRequests" r SET state = 'reconciliation', "errorCode" = 'ambiguous_generation_link', "updatedAt" = now()
        FROM locked l JOIN orphans o ON o.id = l.id WHERE r.id = l.id AND l."generationId" IS NULL AND o.orphan_count > 1 RETURNING r.id
      ), eligible AS (
        SELECT r.*, COALESCE(r."generationId", ${input.generationId ?? null}::integer, o.orphan_id) AS target_generation
        FROM locked r JOIN orphans o ON o.id = r.id WHERE r."generationId" IS NOT NULL OR o.orphan_count <= 1
      ), owned_generation AS (
        SELECT g.id FROM generations g JOIN eligible r ON g.id = r.target_generation AND g."userId" = r."userId"
          WHERE lower(g.metadata->>'billingRequestId') = r."requestId"::text AND g.status IN ('pending', 'generating', 'failed') FOR UPDATE OF g
      ), wallet AS (
        UPDATE "creditBalances" cb SET balance = cb.balance + r."quotedCredits",
          "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN COALESCE((SELECT LEAST(r."quotedCredits", (t."txMetadata"->>'purchasedCreditsDebited')::integer) FROM "creditTransactions" t WHERE t."userId" = r."userId" AND t."txType" = 'usage' AND t."txMetadata"->>'generationRequestId' = r.id::text ORDER BY t.id LIMIT 1), 0) ELSE 0 END,
          "lifetimeSpent" = GREATEST(cb."lifetimeSpent" - r."quotedCredits", 0), "updatedAt" = now()
        FROM eligible r WHERE cb."userId" = r."userId" AND (r.target_generation IS NULL OR EXISTS (SELECT 1 FROM owned_generation)) RETURNING cb.id
      ), failed_generation AS (
        UPDATE generations g SET status = 'failed', "errorMessage" = ${message}, "updatedAt" = now()
        FROM eligible r WHERE g.id = r.target_generation AND g.id IN (SELECT id FROM owned_generation) AND EXISTS (SELECT 1 FROM wallet) RETURNING g.id
      ), refunded AS (
        UPDATE "generationRequests" r SET state = 'refunded', "generationId" = e.target_generation,
          "refundedAt" = now(), "errorCode" = ${input.errorCode}, "updatedAt" = now(),
          result = COALESCE(${failedJson}::text::jsonb, jsonb_build_object('requestId', r."requestId", 'status', 'failed', 'error', ${message}::text, 'creditCost', 0, 'refundedCredits', r."quotedCredits")
            || CASE WHEN e.target_generation IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('id', e.target_generation) END)
        FROM eligible e WHERE r.id = e.id AND EXISTS (SELECT 1 FROM wallet)
          AND (e.target_generation IS NULL OR EXISTS (SELECT 1 FROM failed_generation)) RETURNING r.*
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
        SELECT r."userId", r."quotedCredits", 'refund', 'Confirmed generation failure refund',
          jsonb_build_object('generationRequestId', r.id, 'requestId', r."requestId") FROM refunded r RETURNING id
      )
      SELECT r.* FROM refunded r WHERE EXISTS (SELECT 1 FROM ledger)
    `, "refunded");
  }

  async function markGenerationReconciliation(owner: GenerationRequestOwner, input: {
    errorCode: string; generationId?: number;
  }): Promise<GenerationTransitionResult<"reconciliation">> {
    assertOwner(owner); errorCode(input.errorCode);
    if (input.generationId !== undefined) assertGenerationId(input.generationId);
    return transition(owner, sql`/* generation-billing:reconciliation */
      UPDATE "generationRequests" r SET state = 'reconciliation', "errorCode" = CASE WHEN r."errorCode" = 'account-deleted' THEN r."errorCode" ELSE ${input.errorCode} END,
        "generationId" = COALESCE(r."generationId", ${input.generationId ?? null}::integer), "updatedAt" = now()
      WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId} AND r."requestId" = ${owner.requestId}::uuid
        AND r."payloadHash" = ${owner.payloadHash} AND r."executionToken" = ${owner.executionToken}::uuid
        AND r.state IN ('reserved', 'rendering', 'reconciliation')
        AND (r."generationId" IS NULL OR ${input.generationId ?? null}::integer IS NULL OR r."generationId" = ${input.generationId ?? null})
        AND (${input.generationId ?? null}::integer IS NULL OR EXISTS (SELECT 1 FROM generations g WHERE g.id = ${input.generationId ?? null} AND g."userId" = r."userId"))
      RETURNING r.*
    `, "reconciliation");
  }

  async function sweepStaleGenerationRequests(input: { olderThanMinutes: number; limit: number }): Promise<
    { kind: "swept"; refunded: number; reconciliation: number } | { kind: "uncertain" }
  > {
    if (!Number.isInteger(input.olderThanMinutes) || input.olderThanMinutes < 1 || input.olderThanMinutes > 1440 || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new Error("Invalid generation reconciliation sweep limits.");
    }
    try {
      const result = rows(await driver.execute(sql`/* generation-billing:sweep */
        WITH locked AS (
          SELECT r.* FROM "generationRequests" r WHERE r.state IN ('reserved', 'rendering')
            AND r."updatedAt" < now() - make_interval(mins => ${input.olderThanMinutes})
          ORDER BY r.id LIMIT ${input.limit} FOR UPDATE SKIP LOCKED
        ), orphans AS (
          SELECT r.id, count(g.id) AS orphan_count, min(g.id) AS orphan_id
          FROM locked r LEFT JOIN generations g ON g."userId" = r."userId" AND lower(g.metadata->>'billingRequestId') = r."requestId"::text GROUP BY r.id
        ), refundable AS (
          SELECT r.*, COALESCE(r."generationId", o.orphan_id) AS target_generation FROM locked r JOIN orphans o ON o.id = r.id
          WHERE r.state = 'reserved' AND (r."generationId" IS NOT NULL OR o.orphan_count <= 1)
            AND NOT EXISTS (SELECT 1 FROM generations g WHERE g.id = COALESCE(r."generationId", o.orphan_id) AND g.status = 'completed')
        ), wallet_totals AS (
          SELECT r."userId", sum(r."quotedCredits")::integer AS credits,
            sum(COALESCE((SELECT LEAST(r."quotedCredits", (t."txMetadata"->>'purchasedCreditsDebited')::integer) FROM "creditTransactions" t WHERE t."userId" = r."userId" AND t."txType" = 'usage' AND t."txMetadata"->>'generationRequestId' = r.id::text ORDER BY t.id LIMIT 1), 0))::integer AS purchased
          FROM refundable r GROUP BY r."userId"
        ), wallet AS (
          UPDATE "creditBalances" cb SET balance = cb.balance + w.credits,
            "bonusCredits" = cb."bonusCredits" + CASE WHEN cb."walletAccountingVersion" = 1 THEN w.purchased ELSE 0 END,
            "lifetimeSpent" = GREATEST(cb."lifetimeSpent" - w.credits, 0), "updatedAt" = now()
          FROM wallet_totals w WHERE cb."userId" = w."userId" RETURNING cb."userId"
        ), refunded AS (
          UPDATE "generationRequests" r SET state = 'refunded', "generationId" = e.target_generation,
            "refundedAt" = now(), "errorCode" = 'stale_before_render', "updatedAt" = now(),
            result = jsonb_build_object('requestId', r."requestId", 'status', 'failed', 'error', 'Generation expired before rendering. Credits returned.', 'creditCost', 0, 'refundedCredits', r."quotedCredits")
              || CASE WHEN e.target_generation IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('id', e.target_generation) END
          FROM refundable e WHERE r.id = e.id AND r."userId" IN (SELECT "userId" FROM wallet) RETURNING r.*
        ), failed_generation AS (
          UPDATE generations g SET status = 'failed', "errorMessage" = 'Generation expired before rendering. Credits returned.', "updatedAt" = now()
          FROM refunded r WHERE g.id = r."generationId" AND g."userId" = r."userId" AND g.status IN ('pending', 'generating') RETURNING g.id
        ), ledger AS (
          INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
          SELECT r."userId", r."quotedCredits", 'refund', 'Expired generation reservation refund', jsonb_build_object('generationRequestId', r.id, 'requestId', r."requestId") FROM refunded r RETURNING id
        ), reconciled AS (
          UPDATE "generationRequests" r SET state = 'reconciliation', "errorCode" = CASE WHEN l.state = 'rendering' THEN 'stale_rendering' ELSE 'reservation_needs_review' END, "updatedAt" = now()
          FROM locked l JOIN orphans o ON o.id = l.id WHERE r.id = l.id AND (l.state = 'rendering' OR l.state = 'reserved' AND NOT EXISTS (SELECT 1 FROM refunded f WHERE f.id = l.id)) RETURNING r.id
        )
        SELECT (SELECT count(*) FROM refunded) AS refunded, (SELECT count(*) FROM reconciled) AS reconciliation,
          (SELECT count(*) FROM ledger) AS ledger_count, (SELECT count(*) FROM failed_generation) AS generation_count
      `));
      if (!result[0]) return { kind: "uncertain" };
      return { kind: "swept", refunded: Number(result[0].refunded), reconciliation: Number(result[0].reconciliation) };
    } catch {
      // Re-running the sweep is safe, but a failed acknowledgment cannot certify its counts.
      return { kind: "uncertain" };
    }
  }

  return { claimGenerationRequest, beginGenerationRequest, completeGenerationRequest, failGenerationRequestAndRefund, markGenerationReconciliation, sweepStaleGenerationRequests, readGenerationRequest };
}

async function productionStore() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable for generation billing.");
  return createGenerationBillingStore({ execute: (query) => db.execute(query), initializeBalance: getOrCreateBalance });
}
export async function claimGenerationRequest(input: GenerationRequestIdentity & { credits: number; rejectedResult?: Record<string, unknown> }) { return (await productionStore()).claimGenerationRequest(input); }
export async function beginGenerationRequest(owner: GenerationRequestOwner, generationId: number) { return (await productionStore()).beginGenerationRequest(owner, generationId); }
export async function completeGenerationRequest(owner: GenerationRequestOwner, input: Parameters<ReturnType<typeof createGenerationBillingStore>["completeGenerationRequest"]>[1]) { return (await productionStore()).completeGenerationRequest(owner, input); }
export async function failGenerationRequestAndRefund(owner: GenerationRequestOwner, input: Parameters<ReturnType<typeof createGenerationBillingStore>["failGenerationRequestAndRefund"]>[1]) { return (await productionStore()).failGenerationRequestAndRefund(owner, input); }
export async function markGenerationReconciliation(owner: GenerationRequestOwner, input: Parameters<ReturnType<typeof createGenerationBillingStore>["markGenerationReconciliation"]>[1]) { return (await productionStore()).markGenerationReconciliation(owner, input); }
export async function sweepStaleGenerationRequests(input: { olderThanMinutes: number; limit: number }) { return (await productionStore()).sweepStaleGenerationRequests(input); }
export async function readGenerationRequest(identity: Pick<GenerationRequestIdentity, "userId" | "requestId">) { return (await productionStore()).readGenerationRequest(identity); }
