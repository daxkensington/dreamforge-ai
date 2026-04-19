/**
 * Vercel Cron — daily prune of rate_limit_hits rows older than 1 hour.
 *
 * The longest sliding window we use is ~1 minute, so anything > 1 hour is
 * just dead weight on the index. Bounds the table to a few thousand rows
 * even under heavy traffic.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "../../../../server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
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
