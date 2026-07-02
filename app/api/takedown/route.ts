import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../../server/db";
import { takedownRequests } from "../../../drizzle/schema";
import { enforceRateLimit } from "../../../server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * POST /api/takedown — public content-removal report intake.
 *
 * Accepts { url, reason, contact? }, persists a takedown_requests row, and
 * returns a ticket id the reporter can reference. Deliberately unauthenticated:
 * the person depicted in (or harmed by) generated content is usually NOT a
 * DreamForgeX user, and a login wall on an abuse-report form is a compliance
 * failure (TAKE IT DOWN Act expects an accessible removal channel).
 *
 * Anti-abuse: IP rate limit (5/hour) + hard field length caps. No email is
 * sent from here — review happens from the DB.
 */

const takedownInput = z.object({
  // Not z.string().url() on purpose — reporters paste share links, partial
  // paths, or image CDN URLs; rejecting those loses real reports.
  url: z.string().trim().min(4, "Include the link to the content").max(2000),
  reason: z.string().trim().min(10, "Describe the problem in a sentence or two").max(5000),
  contact: z.string().trim().max(320).optional().or(z.literal("").transform(() => undefined)),
});

function extractIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const xreal = req.headers.get("x-real-ip");
  if (xreal) return xreal.trim();
  return null;
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = takedownInput.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const ip = extractIp(req);
  try {
    await enforceRateLimit(
      `takedown:ip:${ip ?? "unknown"}`,
      5,
      60 * 60 * 1000,
      "Too many reports from this address — please try again in an hour.",
    );
  } catch (err) {
    if (err instanceof TRPCError && err.code === "TOO_MANY_REQUESTS") {
      return NextResponse.json({ ok: false, error: err.message }, { status: 429 });
    }
    // Limiter infra error → fail open (a lost abuse report is worse).
  }

  const db = await getDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Temporarily unavailable — please retry shortly." },
      { status: 503 },
    );
  }

  // Human-referenceable ticket id, e.g. TD-9F3A21C4. Collision odds are
  // negligible (32 random bits); the unique constraint is the backstop.
  const ticket = `TD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  try {
    await db.insert(takedownRequests).values({
      ticket,
      url: parsed.data.url,
      reason: parsed.data.reason,
      contact: parsed.data.contact ?? null,
      ip,
    });
  } catch (err) {
    console.error("[takedown] insert failed:", err);
    return NextResponse.json(
      { ok: false, error: "Could not record the report — please retry." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ticket });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST with JSON { url, reason, contact? } — or the form at /takedown." },
    { status: 405 },
  );
}
