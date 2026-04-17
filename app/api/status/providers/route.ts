/**
 * Public provider-health endpoint — used by external uptime monitors and by
 * the in-app status banner. Returns reachability for each provider we depend
 * on; does NOT consume credits or invoke actual generation.
 *
 * Cached 60s to stay within provider rate limits under load.
 */
import { NextResponse } from "next/server";
import { ENV } from "../../../../server/_core/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProviderCheck = {
  name: string;
  configured: boolean;
  ok?: boolean;
  latencyMs?: number;
  error?: string;
};

let cache: { at: number; body: any } | null = null;
const CACHE_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 8_000;

async function ping(url: string, opts?: RequestInit): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow", ...opts });
    clearTimeout(t);
    return { ok: res.status < 500, latencyMs: Date.now() - start };
  } catch (err: any) {
    clearTimeout(t);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err?.name === "AbortError" ? "timeout" : err?.message || "fetch failed",
    };
  }
}

async function buildReport(): Promise<{ checks: ProviderCheck[]; summary: string }> {
  const checks: ProviderCheck[] = [];

  const runpodOk = !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId;
  if (runpodOk) {
    // RunPod serverless: GET /v2/{endpointId}/health is the documented probe
    const r = await ping(
      `https://api.runpod.ai/v2/${ENV.runpodFluxEndpointId}/health`,
      { headers: { Authorization: `Bearer ${ENV.runpodApiKey}` } },
    );
    checks.push({ name: "runpod", configured: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error });
  } else {
    checks.push({ name: "runpod", configured: false });
  }

  if (ENV.replicateApiToken) {
    const r = await ping("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Token ${ENV.replicateApiToken}` },
    });
    checks.push({ name: "replicate", configured: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error });
  } else {
    checks.push({ name: "replicate", configured: false });
  }

  if (ENV.falApiKey) {
    // fal.ai public ping — their queue endpoint 401s without auth but 5xx if down
    const r = await ping("https://queue.fal.run/", {
      headers: { Authorization: `Key ${ENV.falApiKey}` },
    });
    checks.push({ name: "fal", configured: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error });
  } else {
    checks.push({ name: "fal", configured: false });
  }

  if (ENV.runwayApiKey) {
    const r = await ping("https://api.dev.runwayml.com/v1/organization", {
      headers: {
        Authorization: `Bearer ${ENV.runwayApiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    });
    checks.push({ name: "runway", configured: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error });
  } else {
    checks.push({ name: "runway", configured: false });
  }

  if (ENV.klingAccessKey && ENV.klingSecretKey) {
    // Kling has no lightweight health endpoint; probe base host reachability.
    const r = await ping("https://api.klingai.com/", { method: "HEAD" as any });
    checks.push({ name: "kling", configured: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error });
  } else {
    checks.push({ name: "kling", configured: false });
  }

  const degraded = checks.filter((c) => c.configured && c.ok === false);
  const summary = degraded.length === 0 ? "all-healthy" : `degraded:${degraded.map((c) => c.name).join(",")}`;
  return { checks, summary };
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.body, cached: true });
  }
  const report = await buildReport();
  const body = { ...report, ts: new Date().toISOString() };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
