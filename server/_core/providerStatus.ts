/** Monitoring reads metadata and host reachability, never GPU runtime health. */
export type ProviderError = "timeout" | "fetch-failed" | "redirect-rejected" | "authorization-rejected" | "not-found" | "rate-limited" | "http-error" | "invalid-response" | "invalid-configuration" | "capacity-disabled";
export type ProviderCheck = {
  name: "runpod" | "replicate" | "fal" | "runway" | "kling";
  configured: boolean;
  probe: "control-plane-metadata" | "account-metadata" | "host-reachability";
  readiness: "not-probed";
  ok?: boolean; hostReachable?: boolean; authenticatedAccess?: boolean | null;
  capacity?: "enabled" | "disabled" | "unknown";
  httpStatus?: number; latencyMs?: number; error?: ProviderError;
};
export type ProviderConfiguration = {
  runpodApiKey: string; runpodFluxEndpointId: string; replicateApiToken: string;
  falApiKey: string; runwayApiKey: string; klingAccessKey: string; klingSecretKey: string;
};
type ReadResult = { hostReachable: boolean; ok: boolean; status?: number; latencyMs: number; error?: ProviderError; body?: unknown };
const PROBE_TIMEOUT_MS = 6_500;
const httpError = (status: number): ProviderError => status >= 300 && status < 400 ? "redirect-rejected" : status === 401 || status === 403 ? "authorization-rejected" : status === 404 ? "not-found" : status === 429 ? "rate-limited" : "http-error";

async function metadataRead(url: string, init: RequestInit, parse: boolean, fetchImpl: typeof fetch): Promise<ReadResult> {
  async function once(): Promise<ReadResult> {
    const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS), started = performance.now();
    try {
      const response = await fetchImpl(url, { ...init, redirect: "manual", signal });
      const latencyMs = Math.round(performance.now() - started);
      if (!response.ok) return { hostReachable: true, ok: false, status: response.status, latencyMs, error: httpError(response.status) };
      if (!parse) return { hostReachable: true, ok: true, status: response.status, latencyMs };
      let body: unknown;
      try { body = await response.json(); } catch { return { hostReachable: true, ok: false, status: response.status, latencyMs: Math.round(performance.now() - started), error: signal.aborted ? "timeout" : "invalid-response" }; }
      return { hostReachable: true, ok: true, status: response.status, latencyMs: Math.round(performance.now() - started), body };
    } catch {
      return { hostReachable: false, ok: false, latencyMs: Math.round(performance.now() - started), error: signal.aborted ? "timeout" : "fetch-failed" };
    }
  }
  const first = await once();
  return first.error === "timeout" ? once() : first;
}

export async function buildProviderReport(env: ProviderConfiguration, fetchImpl: typeof fetch = fetch) {
  const base = (name: ProviderCheck["name"], configured: boolean, probe: ProviderCheck["probe"]): ProviderCheck => ({ name, configured, probe, readiness: "not-probed" });
  const expose = (row: ProviderCheck, r: ReadResult): ProviderCheck => ({ ...row, ok: r.ok, hostReachable: r.hostReachable, httpStatus: r.status, latencyMs: r.latencyMs, ...(r.error ? { error: r.error } : {}) });
  async function account(name: "replicate" | "runway", key: string, url: string, headers: Record<string, string>) {
    const row = base(name, !!key, "account-metadata");
    if (!row.configured) return row;
    const r = await metadataRead(url, { method: "GET", headers }, false, fetchImpl);
    return { ...expose(row, r), authenticatedAccess: r.ok ? true : r.status === 401 || r.status === 403 ? false : null };
  }
  async function host(name: "fal" | "kling", configured: boolean, url: string) {
    const row = base(name, configured, "host-reachability");
    if (!configured) return row;
    // Public HEAD to an official host: no model path, task, body or API key.
    const r = await metadataRead(url, { method: "HEAD" }, false, fetchImpl);
    const reachable = r.hostReachable && r.status !== undefined && r.status < 500 && !(r.status >= 300 && r.status < 400);
    return { ...expose(row, r), ok: reachable, authenticatedAccess: null };
  }
  async function runpod() {
    const row = base("runpod", !!env.runpodApiKey && !!env.runpodFluxEndpointId, "control-plane-metadata");
    if (!row.configured) return row;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(env.runpodFluxEndpointId)) return { ...row, ok: false, capacity: "unknown" as const, error: "invalid-configuration" as const };
    // Supported management v2 is distinct from api.runpod.ai runtime v2.
    const r = await metadataRead("https://api.runpod.io/v2/serverless/" + encodeURIComponent(env.runpodFluxEndpointId), { method: "GET", headers: { Authorization: "Bearer " + env.runpodApiKey } }, true, fetchImpl);
    const visible = { ...expose(row, r), authenticatedAccess: r.ok ? true : r.status === 401 || r.status === 403 ? false : null };
    if (!r.ok) return { ...visible, capacity: "unknown" as const };
    const body = r.body as { id?: unknown; workers?: { min?: unknown; max?: unknown } } | null;
    const min = body?.workers?.min, max = body?.workers?.max;
    if (body?.id !== env.runpodFluxEndpointId || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || (min as number) < 0 || (max as number) < (min as number)) return { ...visible, ok: false, capacity: "unknown" as const, error: "invalid-response" as const };
    return { ...visible, ok: (max as number) > 0, capacity: (max as number) > 0 ? "enabled" as const : "disabled" as const, ...((max as number) === 0 ? { error: "capacity-disabled" as const } : {}) };
  }
  const checks = await Promise.all([
    runpod(),
    account("replicate", env.replicateApiToken, "https://api.replicate.com/v1/account", { Authorization: "Token " + env.replicateApiToken }),
    host("fal", !!env.falApiKey, "https://status.fal.ai/"),
    account("runway", env.runwayApiKey, "https://api.dev.runwayml.com/v1/organization", { Authorization: "Bearer " + env.runwayApiKey, "X-Runway-Version": "2024-11-06" }),
    host("kling", !!(env.klingAccessKey && env.klingSecretKey), "https://api.klingai.com/"),
  ]);
  const unavailable = checks.filter(c => c.configured && c.ok === false);
  return { checks, summary: unavailable.length ? `degraded:${unavailable.map(c => c.name).join(",")}` : checks.some(c => c.configured) ? "metadata-reachable" : "unconfigured", mode: "read-only-metadata" as const, generationReadiness: "not-probed" as const };
}

export function createProviderReportCache(build: () => ReturnType<typeof buildProviderReport>, now = Date.now) {
  let cache: { at: number; body: Awaited<ReturnType<typeof buildProviderReport>> & { ts: string } } | null = null;
  return async () => {
    if (cache && now() - cache.at < 60_000) return { ...cache.body, cached: true };
    const report = await build(), at = now();
    const body = { ...report, ts: new Date(at).toISOString() };
    cache = { at, body };
    return body;
  };
}
