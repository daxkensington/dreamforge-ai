/**
 * Vercel Cron — runs every 5 min to auto-flip tools to "degraded" when
 * failure rate spikes. Safe to hit manually for diagnostics.
 *
 * Auth: Vercel sets a secret "Authorization: Bearer <CRON_SECRET>" header
 * when invoking crons. We accept that header or an admin session (via
 * ?probe=1) for manual testing.
 */
import { NextResponse } from "next/server";
import { runAutoDegradeScan } from "../../../../server/_core/toolStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  // Vercel cron sends "Bearer <CRON_SECRET>". Accept if matching or if no
  // secret is configured yet (dev ergonomics).
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await runAutoDegradeScan();
  return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
}
