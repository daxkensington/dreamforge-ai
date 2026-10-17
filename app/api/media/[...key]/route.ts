import { NextResponse } from "next/server";
import { createContext } from "../../../../server/_core/context";
import {
  getMediaAsset,
  normalizeStorageKey,
} from "../../../../server/_core/mediaLifecycle";
import { storageGetObjectBounded } from "../../../../server/storage";
import { canReadTimelineMedia } from "../../../../server/dbTimeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const context = await createContext(req);
  if (!context.user)
    return new NextResponse("Sign in required", {
      status: 401,
      headers: privateHeaders,
    });
  let key: string;
  try {
    key = normalizeStorageKey((await params).key.join("/"));
  } catch {
    return new NextResponse("Not found", {
      status: 404,
      headers: privateHeaders,
    });
  }
  try {
    const asset = await getMediaAsset(key);
    if (
      !asset ||
      asset.revokedAt ||
      asset.ownerDeleted ||
      (asset.ownerUserId !== context.user.id &&
        !(
          key.startsWith("uploads/") &&
          (await canReadTimelineMedia(context.user.id, key))
        ))
    ) {
      return new NextResponse("Not found", {
        status: 404,
        headers: privateHeaders,
      });
    }
    const object = await storageGetObjectBounded(key, 256 * 1024 * 1024);
    if (!object)
      return new NextResponse("Not found", {
        status: 404,
        headers: privateHeaders,
      });
    const total = object.bytes.byteLength;
    let start = 0,
      end = total - 1;
    const range = req.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new NextResponse(null, {
          status: 416,
          headers: { ...privateHeaders, "Content-Range": `bytes */${total}` },
        });
      if (!match[1]) {
        start = Math.max(0, total - Number(match[2]));
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= total
      ) {
        return new NextResponse(null, {
          status: 416,
          headers: { ...privateHeaders, "Content-Range": `bytes */${total}` },
        });
      }
    }
    let offset = start;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset > end) {
          controller.close();
          return;
        }
        const next = Math.min(offset + 64 * 1024, end + 1);
        controller.enqueue(object.bytes.subarray(offset, next));
        offset = next;
      },
    });
    const inline =
      /^(image\/(png|jpeg|webp|avif)|video\/(mp4|webm)|audio\/(mpeg|wav|x-wav|ogg))$/.test(
        object.contentType
      );
    return new NextResponse(body, {
      status: range ? 206 : 200,
      headers: {
        ...privateHeaders,
        "Content-Type": inline
          ? object.contentType
          : "application/octet-stream",
        "Accept-Ranges": "bytes",
        ...(range
          ? {
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Content-Length": String(end - start + 1),
            }
          : {}),
        ...(!inline ? { "Content-Disposition": "attachment" } : {}),
      },
    });
  } catch {
    return new NextResponse("Media temporarily unavailable", {
      status: 503,
      headers: privateHeaders,
    });
  }
}
