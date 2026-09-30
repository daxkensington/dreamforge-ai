/**
 * Vercel Cron — runs every 5 min to auto-flip tools to "degraded" when
 * failure rate spikes. Safe to hit manually for diagnostics.
 *
 * Auth: Vercel sets a secret "Authorization: Bearer <CRON_SECRET>" header
 * when invoking crons. In production the secret is mandatory — a missing
 * CRON_SECRET fails closed (403), never open. Outside production a missing
 * secret is tolerated so local dev can trigger the route by hand.
 */
import { NextResponse } from "next/server";
import { runAutoDegradeScan } from "../../../../server/_core/toolStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // Vercel cron sends "Bearer <CRON_SECRET>". Prod: require an exact match
  // unconditionally — an unset secret must never mean "open to everyone".
  // Non-prod: only enforce when a secret is configured (dev ergonomics).
  if (process.env.NODE_ENV === "production") {
    if (!expected || auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await runAutoDegradeScan();
  return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
}
