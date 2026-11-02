/**
 * Permanent image/video proxy — GET /img/<key> streams the R2 object using the
 * app's S3 credentials. This gives every asset a PERMANENT URL on our own
 * domain, replacing the 7-day presigned URLs storagePut used to return (which
 * silently broke gallery/OG images after a week). storagePut now returns
 * `${R2_PUBLIC_URL}/<key>` where R2_PUBLIC_URL = https://dreamforgex.ai/img.
 *
 * Every request checks durable revocation. Shared caching is disabled so
 * account deletion and takedowns take effect on subsequent origin reads.
 *
 * A single `Range: bytes=start-end` request is answered with 206 so video
 * players can seek; unsatisfiable ranges get 416.
 */
import { NextRequest, NextResponse } from "next/server";
import { storageGetObject } from "../../../server/storage";
import { isMediaPrivate, isMediaRevoked, normalizeStorageKey } from "../../../server/_core/mediaLifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK_SIZE = 64 * 1024;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  // These are AI-generated assets; keep the raw object URLs out of the index
  // (the /g and /explore pages are the canonical indexable surfaces).
  "X-Robots-Tag": "noindex",
};

type RangeResult = { kind: "none" } | { kind: "invalid" } | { kind: "range"; start: number; end: number };

/**
 * Parses a single `bytes=` range against an object of `total` bytes. Headers in
 * other units or with multiple ranges are ignored (full 200 response), which
 * RFC 9110 permits.
 */
function parseRange(header: string | null, total: number): RangeResult {
  if (!header) return { kind: "none" };
  const value = header.trim();
  if (!/^bytes=/i.test(value)) return { kind: "none" };
  const spec = value.slice(6).trim();
  if (spec.includes(",")) return { kind: "none" };
  const m = /^(\d*)\s*-\s*(\d*)$/.exec(spec);
  if (!m || (m[1] === "" && m[2] === "")) return { kind: "invalid" };
  if (total <= 0) return { kind: "invalid" };

  let start: number;
  let end: number;
  if (m[1] === "") {
    // Suffix range: the final N bytes.
    const suffix = Number(m[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: "invalid" };
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? total - 1 : Number(m[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return { kind: "invalid" };
    if (start >= total || start > end) return { kind: "invalid" };
    end = Math.min(end, total - 1);
  }
  return { kind: "range", start, end };
}

// Explicit streaming also serves completed video clips above the platform's
// buffered-response limit. Backpressure bounds each outgoing chunk.
function streamBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) { controller.close(); return; }
      const end = Math.min(offset + CHUNK_SIZE, bytes.byteLength);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  let key: string;
  try { key = normalizeStorageKey((parts ?? []).join("/")); }
  catch { return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } }); }

  let obj: Awaited<ReturnType<typeof storageGetObject>>;
  try {
    if (await isMediaPrivate(key) || await isMediaRevoked(key)) return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
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

  const bytes = obj.bytes;
  const total = bytes.byteLength;
  const range = parseRange(req?.headers?.get("range") ?? null, total);

  if (range.kind === "invalid") {
    return new NextResponse(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${total}`,
        "Accept-Ranges": "bytes",
        ...NO_STORE_HEADERS,
      },
    });
  }

  if (range.kind === "range") {
    const { start, end } = range;
    return new NextResponse(streamBytes(bytes.subarray(start, end + 1)), {
      status: 206,
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        ...NO_STORE_HEADERS,
      },
    });
  }

  return new NextResponse(streamBytes(bytes), {
    status: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      ...NO_STORE_HEADERS,
    },
  });
}
