/**
 * Vercel Cron — daily engagement nudges (in-app notifications only; no email,
 * so the 11pm–7am email rule does not apply — still scheduled for morning US).
 *
 * Two messages, both throttled per user:
 *  1. daily-credits — users who generated sometime in the last 7 days but not
 *     today: "your 50 daily credits reset". Turns the free tier into a habit.
 *  2. referral — users active in the last 7 days with zero referrals, nudged
 *     at most once ever: "earn 30 credits per friend".
 *
 * Idempotent by notification title + day (nudge) or a lifetime tag (referral):
 * re-running the same day skips users already nudged.
 *
 * Auth: same CRON_SECRET Bearer convention as the other crons; fails closed
 * in production when the secret is unset.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import { createNotification } from "../../../../server/routersPhase15";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BATCH_LIMIT = 500;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!expected || auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ ok: false, error: "db unavailable" }, { status: 503 });

  const dayTag = new Date().toISOString().slice(0, 10);
  let nudged = 0, referred = 0, errors = 0;

  // ─── 1. Daily-credit reset nudge ──────────────────────────────────────────
  // Active recently (7d) but not today; hasn't been nudged today.
  const nudgeCandidates = await db.execute(sql`
    SELECT u.id
    FROM users u
    WHERE EXISTS (
        SELECT 1 FROM generations g
        WHERE g."userId" = u.id AND g."createdAt" > now() - interval '7 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM generations g
        WHERE g."userId" = u.id AND g."createdAt"::date = now()::date
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n."userId" = u.id AND n.title = ${"daily-credits:" + dayTag}
      )
    LIMIT ${BATCH_LIMIT}
  `);

  for (const row of nudgeCandidates.rows as { id: number }[]) {
    try {
      await createNotification(
        row.id,
        "system",
        `daily-credits:${dayTag}`,
        "Your 50 free credits just reset — come make something today.",
        { href: "/workspace" }
      );
      nudged++;
    } catch (err) {
      errors++;
      console.error(`[cron/daily-nudge] nudge failed for user ${row.id}:`, err);
    }
  }

  // ─── 2. Referral prompt (lifetime-once) ──────────────────────────────────
  const referralCandidates = await db.execute(sql`
    SELECT u.id
    FROM users u
    WHERE EXISTS (
        SELECT 1 FROM generations g
        WHERE g."userId" = u.id AND g."createdAt" > now() - interval '7 days'
      )
      AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r."referrerId" = u.id)
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n."userId" = u.id AND n.title = 'referral-prompt'
      )
    LIMIT ${BATCH_LIMIT}
  `);

  for (const row of referralCandidates.rows as { id: number }[]) {
    try {
      await createNotification(
        row.id,
        "system",
        "referral-prompt",
        "Earn 30 credits for every friend who joins — grab your personal referral link.",
        { href: "/credits" }
      );
      referred++;
    } catch (err) {
      errors++;
      console.error(`[cron/daily-nudge] referral prompt failed for user ${row.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, dayTag, nudged, referred, errors, ts: new Date().toISOString() });
}
