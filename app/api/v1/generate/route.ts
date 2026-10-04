/**
 * Public API — POST /api/v1/generate
 *
 * The first real /api/v1 endpoint: text-to-image generation authenticated by
 * the df_ API keys that Business/Agency users create on /api-keys (the docs
 * page promised this surface before the auth existed — now it does).
 *
 *   Authorization: Bearer df_<key>
 *   Body: { prompt, model?, width?, height? }
 *   200: { id, status, url }
 *   401 invalid key · 403 plan lacks API access · 402 insufficient credits
 *   400 bad input · 429 hourly rate limit (per key, from the key's rateLimit)
 *
 * Credits are deducted by the normal generation.create path, so refunds,
 * daily free credits, model-aware pricing, and the stale-job reaper all apply
 * exactly as they do in the app.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import { getApiKeyByHash, updateApiKeyLastUsed } from "../../../../server/dbExtended";
import { subscriptionPlans, userSubscriptions } from "../../../../drizzle/schema";
import { enforceRateLimit } from "../../../../server/rate-limit";
import { TIERS } from "../../../../shared/tiers";

export const runtime = "nodejs";
export const maxDuration = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function err(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status, headers: CORS });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer (df_[A-Za-z0-9_-]+)$/);
  if (!match) return err(401, "unauthorized", "Missing or malformed Bearer API key (expected 'Authorization: Bearer df_...').");

  const keyHash = createHash("sha256").update(match[1]).digest("hex");
  const key = await getApiKeyByHash(keyHash);
  if (!key) return err(401, "unauthorized", "Invalid or revoked API key.");
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return err(401, "key_expired", "This API key has expired.");

  const db = await getDb();
  if (!db) return err(503, "unavailable", "Service temporarily unavailable.");

  // Plan gate: API access is a Business/Agency entitlement.
  const [sub] = await db
    .select({ planName: subscriptionPlans.name })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(eq(userSubscriptions.userId, key.userId))
    .orderBy(desc(userSubscriptions.createdAt))
    .limit(1);
  const plan = sub ? TIERS[sub.planName as keyof typeof TIERS] : undefined;
  if (!plan?.apiAccess) {
    return err(403, "plan_required", "API access requires the Business plan or higher. Upgrade at https://dreamforgex.ai/pricing.");
  }

  // Per-key hourly rate limit (defaults to the key's rateLimit, floor at plan's).
  const hourly = Math.max(key.rateLimit ?? 100, plan.apiRequestsPerHour || 100);
  try {
    await enforceRateLimit(`api:v1:${key.id}`, hourly, 60 * 60 * 1000, "Hourly API rate limit exceeded.");
  } catch {
    return err(429, "rate_limited", `Rate limit: ${hourly} requests/hour on this key.`);
  }

  let body: { prompt?: string; model?: string; width?: number; height?: number };
  try {
    body = await req.json();
  } catch {
    return err(400, "bad_request", "Body must be JSON.");
  }
  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.length > 4000) {
    return err(400, "bad_request", "prompt is required (string, max 4000 chars).");
  }
  const width = Math.min(2048, Math.max(256, body.width ?? 1024));
  const height = Math.min(2048, Math.max(256, body.height ?? 1024));

  const { appRouter } = await import("../../../../server/routers");
  const caller = appRouter.createCaller({
    user: { id: key.userId } as never,
    session: null,
    ip: "api-v1",
  });

  try {
    const res = await caller.generation.create({
      prompt: body.prompt,
      modelVersion: body.model ?? "auto",
      mediaType: "image",
      width,
      height,
    } as never);
    updateApiKeyLastUsed(key.id).catch(() => {});
    if (res.status !== "completed" || !(res as { imageUrl?: string }).imageUrl) {
      return err(502, "generation_failed", (res as { error?: string }).error ?? "Generation failed.");
    }
    return NextResponse.json(
      { id: res.id ?? null, status: res.status, url: (res as { imageUrl: string }).imageUrl },
      { status: 200, headers: CORS }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (/insufficient|credits/i.test(msg)) return err(402, "insufficient_credits", "Not enough credits — top up at https://dreamforgex.ai/credits.");
    if (/rate|limit/i.test(msg)) return err(429, "rate_limited", msg);
    return err(500, "internal", "Generation failed.");
  }
}
