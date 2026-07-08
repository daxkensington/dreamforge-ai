/**
 * Permanent image/video proxy — GET /img/<key> streams the R2 object using the
 * app's S3 credentials. This gives every asset a PERMANENT URL on our own
 * domain, replacing the 7-day presigned URLs storagePut used to return (which
 * silently broke gallery/OG images after a week). storagePut now returns
 * `${R2_PUBLIC_URL}/<key>` where R2_PUBLIC_URL = https://dreamforgex.ai/img.
 *
 * Immutable long-cache so Cloudflare/Vercel edge serves repeat views and R2 is
 * hit at most once per asset (keys are content-addressed nanoids — never reused).
 */
import { NextRequest, NextResponse } from "next/server";
import { storageGetObject } from "../../../server/storage";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = (parts ?? []).join("/");
  if (!key) return new NextResponse("Not found", { status: 404 });

  const obj = await storageGetObject(key);
  if (!obj) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(obj.bytes), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // These are AI-generated assets; keep the raw object URLs out of the index
      // (the /g and /explore pages are the canonical indexable surfaces).
      "X-Robots-Tag": "noindex",
    },
  });
}
