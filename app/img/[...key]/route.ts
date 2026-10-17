/**
 * Permanent image/video proxy — GET /img/<key> streams the R2 object using the
 * app's S3 credentials. This gives every asset a PERMANENT URL on our own
 * domain, replacing the 7-day presigned URLs storagePut used to return (which
 * silently broke gallery/OG images after a week). storagePut now returns
 * `${R2_PUBLIC_URL}/<key>` where R2_PUBLIC_URL = https://dreamforgex.ai/img.
 *
 * Every request checks durable revocation. Shared caching is disabled so
 * account deletion and takedowns take effect on subsequent origin reads.
 */
import { NextRequest, NextResponse } from "next/server";
import { storageGetObject } from "../../../server/storage";
import { isMediaRevoked, normalizeStorageKey } from "../../../server/_core/mediaLifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  let key: string;
  try { key = normalizeStorageKey((parts ?? []).join("/")); }
  catch { return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } }); }

  let obj: Awaited<ReturnType<typeof storageGetObject>>;
  try {
    if (await isMediaRevoked(key)) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    obj = await storageGetObject(key);
  } catch (err) {
    console.error("[/img] storage fetch failed:", key, err);
    return new NextResponse("Upstream storage error", {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  }
  if (!obj) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  // Explicit streaming also serves completed video clips above the platform's
  // buffered-response limit. Backpressure bounds each outgoing chunk.
  let offset = 0;
  const bytes = obj.bytes;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) { controller.close(); return; }
      const end = Math.min(offset + 64 * 1024, bytes.byteLength);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      // These are AI-generated assets; keep the raw object URLs out of the index
      // (the /g and /explore pages are the canonical indexable surfaces).
      "X-Robots-Tag": "noindex",
    },
  });
}
