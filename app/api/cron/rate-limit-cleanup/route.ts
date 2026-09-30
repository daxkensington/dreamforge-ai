/**
 * Vercel Cron — daily prune of rate_limit_hits rows older than 1 hour.
 *
 * The longest sliding window we use is ~1 minute, so anything > 1 hour is
 * just dead weight on the index. Bounds the table to a few thousand rows
 * even under heavy traffic.
 *
 * Auth: same as auto-degrade — "Authorization: Bearer <CRON_SECRET>", with
 * the secret mandatory in production (missing secret fails closed).
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "../../../../server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const result: any = await db.execute(sql`
    DELETE FROM rate_limit_hits
    WHERE ts < NOW() - INTERVAL '1 hour'
    RETURNING 1
  `);
  const pruned = (result.rows ?? result).length ?? 0;

  return NextResponse.json({ ok: true, pruned, ts: new Date().toISOString() });
}
