import { NextResponse } from "next/server";
import { purgeRevokedMedia } from "../../../../server/_core/mediaLifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if ((process.env.NODE_ENV === "production" && !secret) || (secret && req.headers.get("authorization") !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...await purgeRevokedMedia(100) });
  } catch {
    return NextResponse.json({ ok: false, error: "Media cleanup unavailable" }, { status: 503 });
  }
}
