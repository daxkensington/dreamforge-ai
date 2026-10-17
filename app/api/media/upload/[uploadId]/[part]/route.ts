import { NextResponse } from "next/server";
import { createContext } from "../../../../../../server/_core/context";
import { withStorageOwner } from "../../../../../../server/_core/storageContext";
import { MEDIA_CHUNK_SIZE, putMediaUploadPart } from "../../../../../../server/_core/mediaUpload";
import { enforceRateLimit } from "../../../../../../server/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function PUT(req: Request, { params }: { params: Promise<{ uploadId: string; part: string }> }) {
  const { user } = await createContext(req);
  if (!user) return NextResponse.json({ error: "Sign in to upload media." }, { status: 401 });
  const { uploadId, part } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(uploadId) || !/^\d{1,2}$/.test(part)) return NextResponse.json({ error: "Invalid upload part." }, { status: 400 });
  const length = Number(req.headers.get("content-length"));
  if (!Number.isInteger(length) || length < 1 || length > MEDIA_CHUNK_SIZE) return NextResponse.json({ error: "Upload chunks must be at most 3 MB." }, { status: 413 });
  try {
    await enforceRateLimit(`media.parts:${user.id}`, 120, 60_000);
    const chunks: Uint8Array[] = []; let total = 0;
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Missing upload content.");
    try { while (true) { const item = await reader.read(); if (item.done) break; total += item.value.byteLength;
      if (total > MEDIA_CHUNK_SIZE) { await reader.cancel(); return NextResponse.json({ error: "Upload part is too large." }, { status: 413 }); }
      chunks.push(item.value); } } finally { reader.releaseLock(); }
    return NextResponse.json(await withStorageOwner(user.id, () => putMediaUploadPart(user.id, uploadId, Number(part), Buffer.concat(chunks))));
  } catch (error: any) {
    const status = error?.code === "NOT_FOUND" ? 404 : error?.code === "CONFLICT" ? 409 : error?.code === "TOO_MANY_REQUESTS" ? 429 : 400;
    return NextResponse.json({ error: status === 429 ? "Upload rate limit reached. Try again shortly." : "Could not store this upload part. Retry the upload." }, { status });
  }
}
