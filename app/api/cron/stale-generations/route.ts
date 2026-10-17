/**
 * Vercel Cron — reaps generations and audioGenerations rows stuck in a
 * non-terminal state.
 *
 * Long-running jobs (video.textToVideo, audio, story) run inline or
 * fire-and-forget; when serverless kills the invocation the row is left in
 * "generating" forever even though credits were deducted at submit. This
 * route claims each stale row atomically (UPDATE ... WHERE status IN (...)
 * RETURNING — a row already moved to a terminal state is not touched),
 * marks it "failed", and refunds the charge via refundCredits.
 *
 * generationStatusEnum has no "processing" value — the non-terminal states
 * are "pending" and "generating", so those are what we reap. audioStatusEnum
 * rows are only ever written with "generating" (both writers insert the row
 * already in that state), so that is the only audio status we reap.
 *
 * Auth: same as rate-limit-cleanup — "Authorization: Bearer <CRON_SECRET>",
 * with the secret mandatory in production (missing secret fails closed).
 */
import { NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import { generations, audioGenerations } from "../../../../drizzle/schema";
import { failLegacyJobAndRefund } from "../../../../server/_core/walletAccounting";
import { sweepGenerationBatches } from "../../../../server/_core/generationBatchBilling";
import { TOOL_CREDIT_COSTS } from "../../../../shared/creditCosts";
import { sweepStaleGenerationRequests } from "../../../../server/_core/generationBilling";
import { sweepOwnedTrainingJobs } from "../../../../server/_core/modelTraining";
import { sweepImageAnimations } from "../../../../server/_core/imageAnimation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const STALE_AFTER_MINUTES = 15;
const BATCH_LIMIT = 200;
const REAP_STATUSES = ["pending", "generating"] as const;
const AUDIO_REAP_STATUSES = ["generating"] as const;
const REFUND_DESCRIPTION = "Stale job reaper — automatic refund";

// audioGenerations has no cost/credits column — the charge is implied by how
// the row was created, so the reaper mirrors those exact amounts rather than
// guessing a flat rate:
//   - audio.generate deducts CREDIT_COSTS["audio-<type>"] BEFORE inserting
//     the row (server/routers/audio.ts): sfx 2, music 4, voiceover 3,
//     ambient 3.
//   - story.create charges music as part of a bundled cost
//     (STORY_MUSIC_COST, server/routers/story.ts) and marks its row with
//     metadata.storyTitle.
// No free/preview flow writes to this table (userId is NOT NULL and both
// writers deduct first), so every stuck row was charged.
const AUDIO_TYPE_COSTS: Record<string, number> = {
  sfx: 2,
  music: 4,
  voiceover: 3,
  ambient: 3,
};
const STORY_MUSIC_COST = 6;

function audioRefundCost(row: typeof audioGenerations.$inferSelect): number {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  // Defensive: if a future free audio flow marks rows metadata.free, those
  // were never charged — never refund them.
  if (meta.free) return 0;
  if (row.type === "music" && typeof meta.storyTitle === "string") {
    return STORY_MUSIC_COST; // story.ts bundled music charge
  }
  return AUDIO_TYPE_COSTS[row.type] ?? 0;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // Prod: require an exact match unconditionally — an unset CRON_SECRET must
  // never fail open. Non-prod: only enforce when a secret is configured.
  if (process.env.NODE_ENV === "production") {
    if (!expected || auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = await getDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "db unavailable" }, { status: 503 });
  }
  // GET-only receipt recovery also runs when the creator has closed the page.
  // One trainer + one custom image are the training share of this cron budget.
  const [trainingCheck,animationCheck]=await Promise.allSettled([sweepOwnedTrainingJobs(),sweepImageAnimations(2)]);
  const trainingRecovery=trainingCheck.status==='fulfilled'?trainingCheck.value:{expired:0,polled:0,errors:1};
  const animationRecovery=animationCheck.status==='fulfilled'?animationCheck.value:{checked:0,completed:0,failed:0,pending:0,errors:1};

  // Durable generation requests own their exact debit/refund ledger. A stale
  // rendering request requires reconciliation; this legacy reaper cannot refund
  // it independently or declare an upstream request safe to run again.
  let requestSweep;
  try {
    await sweepGenerationBatches();
    requestSweep = await sweepStaleGenerationRequests({ olderThanMinutes: STALE_AFTER_MINUTES, limit: BATCH_LIMIT });
  } catch {
    requestSweep = { kind: "uncertain" as const };
  }

  const stale = await db
    .select()
    .from(generations)
    .where(
      and(
        inArray(generations.status, [...REAP_STATUSES]),
        sql`${generations.metadata}->>'billingRequestId' IS NULL`,
        sql`COALESCE(${generations.metadata}->>'deleted', 'false') <> 'true'`,
        sql`${generations.updatedAt} < NOW() - ${STALE_AFTER_MINUTES} * INTERVAL '1 minute'`,
      ),
    )
    .orderBy(asc(generations.updatedAt))
    .limit(BATCH_LIMIT);

  let reaped = requestSweep.kind === "swept" ? requestSweep.refunded : 0;
  let refunded = requestSweep.kind === "swept" ? requestSweep.refunded : 0;
  let errors = requestSweep.kind === "uncertain" ? 1 : 0;

  for (const row of stale) {
    try {
      const rowMetadata = row.metadata as Record<string, unknown> | null;
      if (rowMetadata?.billingRequestId || rowMetadata?.deleted) continue;
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      // Charged jobs record their exact debit in metadata.cost (uncensored
      // flows). Free previews (metadata.free) were never charged — never
      // refund those. Otherwise fall back to the flat media-type price that
      // batch/standard flows deduct (routers.ts).
      let cost = typeof meta.cost === "number" && meta.cost > 0 ? meta.cost : 0;
      if (cost === 0 && !meta.free) {
        cost =
          row.mediaType === "video"
            ? TOOL_CREDIT_COSTS["text-to-video"] ?? 0
            : TOOL_CREDIT_COSTS["text-to-image"] ?? 0;
      }
      const claimed = await failLegacyJobAndRefund({ table: "generations", id: row.id, userId: row.userId, amount: cost,
        purchasedCredits: Number(meta.purchasedCreditsDebited) || 0, reason: REFUND_DESCRIPTION });
      if (claimed) { reaped++; if (cost > 0) refunded++; }
    } catch (err) {
      errors++;
      console.error(`[cron/stale-generations] failed to reap generation ${row.id}:`, err);
    }
  }

  const staleAudio = await db
    .select()
    .from(audioGenerations)
    .where(
      and(
        inArray(audioGenerations.status, [...AUDIO_REAP_STATUSES]),
        sql`${audioGenerations.updatedAt} < NOW() - ${STALE_AFTER_MINUTES} * INTERVAL '1 minute'`,
      ),
    )
    .orderBy(asc(audioGenerations.updatedAt))
    .limit(BATCH_LIMIT);

  for (const row of staleAudio) {
    try {
      const cost = audioRefundCost(row);
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const claimed = await failLegacyJobAndRefund({ table: "audioGenerations", id: row.id, userId: row.userId,
        amount: cost, purchasedCredits: Number(meta.purchasedCreditsDebited) || 0, reason: REFUND_DESCRIPTION });
      if (claimed) { reaped++; if (cost > 0) refunded++; }
    } catch (err) {
      errors++;
      console.error(`[cron/stale-generations] failed to reap audio generation ${row.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stale.length + staleAudio.length,
    reaped,
    refunded,
    errors,
    requestReconciliation: requestSweep.kind === "swept" ? requestSweep.reconciliation : 0,
    requestRefunded: requestSweep.kind === "swept" ? requestSweep.refunded : 0,
    requestSweepUncertain: requestSweep.kind === "uncertain",
    trainingRecovery,
    animationRecovery,
    ts: new Date().toISOString(),
  });
}
