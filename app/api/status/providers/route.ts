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
const PROBE_TIMEOUT_MS = 6_500;

// One retry on timeout: provider account/meta APIs (Replicate especially)
// intermittently stall past the timeout while generation is unaffected, and a
// single stall was paging ohwista with fail→recover flaps. A real outage still
// fails both attempts.
async function ping(url: string, opts?: RequestInit): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const first = await pingOnce(url, opts);
  if (first.error !== "timeout") return first;
  return pingOnce(url, opts);
}

async function pingOnce(url: string, opts?: RequestInit): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
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

async function probe(
  name: string,
  configured: boolean,
  url: string,
  opts?: RequestInit,
): Promise<ProviderCheck> {
  if (!configured) return { name, configured: false };
  const r = await ping(url, opts);
  return { name, configured: true, ok: r.ok, latencyMs: r.latencyMs, error: r.error };
}

async function buildReport(): Promise<{ checks: ProviderCheck[]; summary: string }> {
  // Probes run concurrently so total latency is the slowest probe (with its
  // one retry), not the sum — keeps us under ohwista's 15s check timeout.
  const checks = await Promise.all([
    // RunPod serverless: GET /v2/{endpointId}/health is the documented probe
    probe(
      "runpod",
      !!ENV.runpodApiKey && !!ENV.runpodFluxEndpointId,
      `https://api.runpod.ai/v2/${ENV.runpodFluxEndpointId}/health`,
      { headers: { Authorization: `Bearer ${ENV.runpodApiKey}` } },
    ),
    probe("replicate", !!ENV.replicateApiToken, "https://api.replicate.com/v1/account", {
      headers: { Authorization: `Token ${ENV.replicateApiToken}` },
    }),
    // fal.ai public ping — their queue endpoint 401s without auth but 5xx if down
    probe("fal", !!ENV.falApiKey, "https://queue.fal.run/", {
      headers: { Authorization: `Key ${ENV.falApiKey}` },
    }),
    probe("runway", !!ENV.runwayApiKey, "https://api.dev.runwayml.com/v1/organization", {
      headers: {
        Authorization: `Bearer ${ENV.runwayApiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    }),
    // Kling has no lightweight health endpoint; probe base host reachability.
    probe("kling", !!(ENV.klingAccessKey && ENV.klingSecretKey), "https://api.klingai.com/", {
      method: "HEAD",
    }),
  ]);

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
