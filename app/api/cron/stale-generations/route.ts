/**
 * Vercel Cron — reaps generations rows stuck in a non-terminal state.
 *
 * Long-running jobs (video.textToVideo, audio, story) run inline or
 * fire-and-forget; when serverless kills the invocation the row is left in
 * "generating" forever even though credits were deducted at submit. This
 * route claims each stale row atomically (UPDATE ... WHERE status IN (...)
 * RETURNING — a row already moved to a terminal state is not touched),
 * marks it "failed", and refunds the charge via refundCredits.
 *
 * generationStatusEnum has no "processing" value — the non-terminal states
 * are "pending" and "generating", so those are what we reap.
 *
 * Auth: same as rate-limit-cleanup — "Authorization: Bearer <CRON_SECRET>",
 * with the secret mandatory in production (missing secret fails closed).
 */
import { NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import { generations } from "../../../../drizzle/schema";
import { refundCredits } from "../../../../server/stripe";
import { TOOL_CREDIT_COSTS } from "../../../../shared/creditCosts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STALE_AFTER_MINUTES = 15;
const BATCH_LIMIT = 200;
const REAP_STATUSES = ["pending", "generating"] as const;
const REFUND_DESCRIPTION = "Stale job reaper — automatic refund";

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

  const stale = await db
    .select()
    .from(generations)
    .where(
      and(
        inArray(generations.status, [...REAP_STATUSES]),
        sql`${generations.updatedAt} < NOW() - ${STALE_AFTER_MINUTES} * INTERVAL '1 minute'`,
      ),
    )
    .orderBy(asc(generations.updatedAt))
    .limit(BATCH_LIMIT);

  let reaped = 0;
  let refunded = 0;
  let errors = 0;

  for (const row of stale) {
    try {
      // Atomic claim — only act if this run actually moved the row out of a
      // non-terminal state; a job that finished (or another reaper instance
      // that got there first) returns zero rows and is skipped.
      const claimed = await db
        .update(generations)
        .set({
          status: "failed",
          errorMessage: `Stale job reaper — no update for ${STALE_AFTER_MINUTES}+ minutes, job presumed dead`,
          updatedAt: new Date(),
        })
        .where(and(eq(generations.id, row.id), inArray(generations.status, [...REAP_STATUSES])))
        .returning({ id: generations.id });
      if (claimed.length === 0) continue;
      reaped++;

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
      if (cost <= 0) continue;

      await refundCredits(row.userId, cost, REFUND_DESCRIPTION);
      refunded++;
    } catch (err) {
      errors++;
      console.error(`[cron/stale-generations] failed to reap generation ${row.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stale.length,
    reaped,
    refunded,
    errors,
    ts: new Date().toISOString(),
  });
}
