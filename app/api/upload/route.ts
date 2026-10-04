/**
 * Image upload endpoint for the AI tools (pet portrait, headshot, viral photo
 * toys, inpainting, etc.). Accepts multipart FormData with a "file" field,
 * stores the image in R2 under uploads/, and returns { url } pointing at the
 * permanent /img proxy on our own domain (R2_PUBLIC_URL = https://dreamforgex.ai/img),
 * which the generation pipeline fetches server-side.
 *
 * Auth: requires a signed-in session — every upload-driven tool is auth-gated
 * at the tRPC layer, so uploads are too. Rate-limited per user (and per IP as
 * a pre-filter) to stop storage-bombing. Uploads are transient inputs, not
 * published assets: they keep the noindex /img proxy headers.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateStorageKey, storagePut } from "../../../server/storage";
import { enforceIpRateLimit, enforceRateLimit } from "../../../server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // matches the 10MB client-side cap

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to upload images" }, { status: 401 });
  }

  const ip = clientIp(req);
  try {
    await enforceIpRateLimit("upload", ip, 30, 60 * 60 * 1000);
    await enforceRateLimit(`upload:user:${(session.user as { id?: number }).id ?? session.user.email ?? "unknown"}`, 20, 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Too many uploads — try again later" }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Max 10MB" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const { url } = await storagePut(generateStorageKey("uploads", ext), bytes, file.type);
    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error("[upload] R2 put failed:", err);
    return NextResponse.json({ error: "Upload failed — try again" }, { status: 500 });
  }
}
