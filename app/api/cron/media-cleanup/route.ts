import { NextResponse } from "next/server";
import { cleanupExpiredMediaUploads } from "../../../../server/_core/mediaUpload";
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
    const expiredUploads = await cleanupExpiredMediaUploads();
    return NextResponse.json({ ok: true, expiredUploads, ...await purgeRevokedMedia(100) });
  } catch {
    return NextResponse.json({ ok: false, error: "Media cleanup unavailable" }, { status: 503 });
  }
}
