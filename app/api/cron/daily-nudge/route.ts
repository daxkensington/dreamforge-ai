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
import {
  sendPassExpiringEmail,
  sendFreePreviewsRemainingEmail,
} from "../../../../server/_core/uncensoredEmail";

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
  let nudged = 0,
    referred = 0,
    expiringNudged = 0,
    freeRecovered = 0,
    errors = 0;

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
        "Earn 100 credits for every friend who joins (4 referrals = a free 24h Uncensored Pass!) — grab your referral link.",
        { href: "/credits" }
      );
      referred++;
    } catch (err) {
      errors++;
      console.error(`[cron/daily-nudge] referral prompt failed for user ${row.id}:`, err);
    }
  }

  // ─── 3. Uncensored Pass Expiring Soon (within 24h) ───────────────────────
  const expiringCandidates = await db.execute(sql`
    SELECT u.id, u.email, u."uncensoredUntil"
    FROM users u
    WHERE u."uncensoredUntil" > now()
      AND u."uncensoredUntil" <= now() + interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n."userId" = u.id AND n.title = ${"uncensored-expiring:" + dayTag}
      )
    LIMIT ${BATCH_LIMIT}
  `);

  for (const row of expiringCandidates.rows as { id: number; email: string | null; uncensoredUntil: string | Date }[]) {
    try {
      const untilDate = new Date(row.uncensoredUntil);
      await createNotification(
        row.id,
        "system",
        `uncensored-expiring:${dayTag}`,
        "Your Uncensored Pro Studio Pass expires in less than 24 hours — extend in 1 click to keep uninterrupted access.",
        { href: "/uncensored?plan=uncensored-30d" }
      );
      if (row.email) {
        await sendPassExpiringEmail({ to: row.email, until: untilDate });
      }
      expiringNudged++;
    } catch (err) {
      errors++;
      console.error(`[cron/daily-nudge] uncensored expiring failed for user ${row.id}:`, err);
    }
  }

  // ─── 4. Uncensored Free Previews Left Recovery (lifetime-once) ───────────
  const freeCandidates = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      (
        SELECT count(*)::int
        FROM generations g
        WHERE g."userId" = u.id
          AND g.metadata->>'free' = 'true'
          AND g.status <> 'failed'
      ) AS "freeUsed"
    FROM users u
    WHERE u."ageConfirmedAt" IS NOT NULL
      AND u."ageConfirmedAt" < now() - interval '6 hours'
      AND (u."uncensoredUntil" IS NULL OR u."uncensoredUntil" <= now())
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n."userId" = u.id AND n.title = 'uncensored-free-reminder'
      )
    LIMIT ${BATCH_LIMIT}
  `);

  for (const row of freeCandidates.rows as { id: number; email: string | null; freeUsed: number }[]) {
    const remaining = 3 - Number(row.freeUsed ?? 0);
    if (remaining <= 0) continue;
    try {
      await createNotification(
        row.id,
        "system",
        "uncensored-free-reminder",
        `You still have ${remaining} free Uncensored Studio ${remaining === 1 ? "preview" : "previews"} waiting — try our 8 character presets now.`,
        { href: "/uncensored?start=1" }
      );
      if (row.email) {
        await sendFreePreviewsRemainingEmail({ to: row.email, remaining });
      }
      freeRecovered++;
    } catch (err) {
      errors++;
      console.error(`[cron/daily-nudge] uncensored free recovery failed for user ${row.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    dayTag,
    nudged,
    referred,
    expiringNudged,
    freeRecovered,
    errors,
    ts: new Date().toISOString(),
  });
}
