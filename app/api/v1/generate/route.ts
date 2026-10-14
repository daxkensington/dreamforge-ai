/**
 * Public API — POST /api/v1/generate
 *
 * The first real /api/v1 endpoint: text-to-image generation authenticated by
 * the df_ API keys that Business/Agency users create on /api-keys (the docs
 * page promised this surface before the auth existed — now it does).
 *
 *   Authorization: Bearer df_<key>
 *   Body: { prompt, model?, width?, height? }
 *   Idempotency-Key: UUID, reused for retries of the same request
 *   200: { id, status, url }
 *   202: original request pending; retry the same key after Retry-After
 *   409: key reused for different inputs
 *   401 invalid key · 403 plan lacks API access · 402 insufficient credits
 *   400 bad input · 429 hourly rate limit (per key, from the key's rateLimit)
 *
 * Credits are deducted by the normal generation.create path, so refunds,
 * daily free credits, model-aware pricing, and the stale-job reaper all apply
 * exactly as they do in the app.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../server/db";
import { getApiKeyByHash, updateApiKeyLastUsed } from "../../../../server/dbExtended";
import { subscriptionPlans, userSubscriptions } from "../../../../drizzle/schema";
import { enforceRateLimit } from "../../../../server/rate-limit";
import { getTierConfig } from "../../../../shared/tiers";
import { getEffectiveSubscriptionTier } from "../../../../shared/subscriptionEntitlement";
import { currentSubscriptionOrder } from "../../../../server/_core/subscriptionSelection";
import { readGenerationRequest } from "../../../../server/_core/generationBilling";

export const runtime = "nodejs";
export const maxDuration = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
  "Access-Control-Expose-Headers": "Idempotency-Key, Retry-After",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function err(status: number, code: string, message: string, requestId?: string) {
  return NextResponse.json({ error: { code, message }, ...(requestId ? { requestId } : {}) }, { status, headers: { ...CORS, ...(requestId ? { "Idempotency-Key": requestId } : {}) } });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer (df_[A-Za-z0-9_-]+)$/);
  if (!match) return err(401, "unauthorized", "Missing or malformed Bearer API key (expected 'Authorization: Bearer df_...').");

  const keyHash = createHash("sha256").update(match[1]).digest("hex");
  const key = await getApiKeyByHash(keyHash);
  if (!key) return err(401, "unauthorized", "Invalid or revoked API key.");
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return err(401, "key_expired", "This API key has expired.");

  const suppliedRequestId = req.headers.get("idempotency-key");
  if (suppliedRequestId !== null && !z.string().uuid().safeParse(suppliedRequestId).success) {
    return err(400, "bad_request", "Idempotency-Key must be a UUID. Reuse it only when retrying the same generation.");
  }
  const requestId = suppliedRequestId?.toLowerCase() ?? randomUUID();
  const responseHeaders = { ...CORS, "Idempotency-Key": requestId };

  const db = await getDb();
  if (!db) return err(503, "unavailable", "Service temporarily unavailable.");

  // Plan gate: API access is a Business/Agency entitlement.
  const [sub] = await db
    .select({ planName: subscriptionPlans.name, status: userSubscriptions.status, currentPeriodStart: userSubscriptions.currentPeriodStart, currentPeriodEnd: userSubscriptions.currentPeriodEnd, cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(eq(userSubscriptions.userId, key.userId))
    .orderBy(...currentSubscriptionOrder())
    .limit(1);
  const plan = getTierConfig(getEffectiveSubscriptionTier(sub ?? {}));
  if (!plan?.apiAccess) {
    // Paid eligibility governs NEW renders. A saved owner-scoped request may
    // still be recovered; generation.create validates its immutable payload.
    let existing = null;
    try {
      if (suppliedRequestId !== null) existing = await readGenerationRequest({ userId: key.userId, requestId });
    } catch {
      return err(503, "unavailable", "Could not verify the original request. Retry with the same Idempotency-Key.", requestId);
    }
    if (!existing) return err(403, "plan_required", "API access requires the Business plan or higher. Upgrade at https://dreamforgex.ai/pricing.", requestId);
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
    return err(400, "bad_request", "Body must be JSON.", requestId);
  }
  if (!body || !body.prompt || typeof body.prompt !== "string" || body.prompt.length > 2000) {
    return err(400, "bad_request", "prompt is required (string, max 2000 chars).", requestId);
  }
  const width = body.width ?? 1024;
  const height = body.height ?? 1024;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 256 || width > 1536 || height < 256 || height > 1536 || (body.model !== undefined && (typeof body.model !== "string" || body.model.length > 128))) {
    return err(400, "bad_request", "Use whole-number dimensions from 256 to 1536 and a supported model ID.", requestId);
  }

  const { appRouter } = await import("../../../../server/routers");
  const caller = appRouter.createCaller({
    user: { id: key.userId } as never,
    session: null,
    ip: "api-v1",
  });

  try {
    const res = await caller.generation.create({
      requestId,
      prompt: body.prompt,
      modelVersion: body.model ?? "auto",
      mediaType: "image",
      width,
      height,
    } as never);
    updateApiKeyLastUsed(key.id).catch(() => {});
    if (res.status === "generating") {
      return NextResponse.json({ id: res.id ?? null, status: "generating", requestId, retryAfterMs: res.retryAfterMs ?? 3000, reconciliationRequired: !!res.reconciliationRequired }, { status: 202, headers: { ...responseHeaders, "Retry-After": "3" } });
    }
    if (res.status !== "completed" || !(res as { imageUrl?: string }).imageUrl) {
      const message = (res as { error?: string }).error ?? "Generation failed.";
      return /insufficient credits/i.test(message) ? err(402, "insufficient_credits", message, requestId) : err(502, "generation_failed", message, requestId);
    }
    return NextResponse.json(
      { id: res.id ?? null, status: res.status, url: (res as { imageUrl: string }).imageUrl, requestId },
      { status: 200, headers: responseHeaders }
    );
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (e?.code === "CONFLICT") return err(409, "idempotency_conflict", msg, requestId);
    if (e?.code === "BAD_REQUEST") return err(400, "bad_request", msg, requestId);
    if (e?.code === "FORBIDDEN") return err(403, "forbidden", msg, requestId);
    if (e?.code === "SERVICE_UNAVAILABLE") return err(503, "unavailable", msg, requestId);
    if (/insufficient|credits/i.test(msg)) return err(402, "insufficient_credits", "Not enough credits — top up at https://dreamforgex.ai/credits.", requestId);
    if (/rate|limit/i.test(msg)) return err(429, "rate_limited", msg, requestId);
    return err(500, "internal", "Generation failed. Retry with the same Idempotency-Key.", requestId);
  }
}
