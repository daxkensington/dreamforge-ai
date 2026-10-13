import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProviderReport, createProviderReportCache, type ProviderConfiguration } from "./_core/providerStatus";

const empty: ProviderConfiguration = { runpodApiKey: "", runpodFluxEndpointId: "", replicateApiToken: "", falApiKey: "", runwayApiKey: "", klingAccessKey: "", klingSecretKey: "" };
const configured = { runpodApiKey: "fixture-runpod-secret", runpodFluxEndpointId: "fixture-flux", replicateApiToken: "fixture-replicate-secret", falApiKey: "fixture-fal-secret", runwayApiKey: "fixture-runway-secret", klingAccessKey: "fixture-kling-key", klingSecretKey: "fixture-kling-secret" };
const endpoint = (max = 0) => ({ id: "fixture-flux", workers: { min: 0, max, idleTimeout: 300 }, env: { TOKEN: "must-never-be-public" }, name: "private-name", requestUrls: { health: "https://api.runpod.ai/v2/fixture-flux/health" } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("actual metadata-only provider consumer", () => {
  it("uses only exact supported management/account GET and anonymous host HEAD, without worker or task calls", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return String(url).includes("api.runpod.io") ? Response.json(endpoint()) : new Response(null, { status: 200 });
    });
    const report = await buildProviderReport(configured, fetcher);
    expect(calls.map(c => [c.url, c.init?.method])).toEqual([
      ["https://api.runpod.io/v2/serverless/fixture-flux", "GET"], ["https://api.replicate.com/v1/account", "GET"],
      ["https://status.fal.ai/", "HEAD"], ["https://api.dev.runwayml.com/v1/organization", "GET"], ["https://api.klingai.com/", "HEAD"],
    ]);
    for (const c of calls) { expect(c.init?.redirect).toBe("manual"); expect(c.init?.body).toBeUndefined(); expect(c.init?.signal).toBeTruthy(); expect(c.url).not.toMatch(/\/health|\/workers|\/run(?:sync)?(?:\/|$)|\/warm|\/billing|\/requests/); }
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer fixture-runpod-secret");
    expect(calls[2].init?.headers).toBeUndefined(); expect(calls[4].init?.headers).toBeUndefined();
    expect(report.checks.every(c => c.readiness === "not-probed")).toBe(true);
    expect(report).toMatchObject({ mode: "read-only-metadata", generationReadiness: "not-probed", summary: "degraded:runpod" });
    expect(report.checks[0]).toMatchObject({ configured: true, hostReachable: true, authenticatedAccess: true, capacity: "disabled", ok: false, error: "capacity-disabled" });
    const publicJson = JSON.stringify(report);
    for (const secret of [...Object.values(configured), "must-never-be-public", "private-name", "requestUrls", "TOKEN"]) expect(publicJson).not.toContain(secret);
  });
  it("enabled capacity is distinct from unprobed readiness and never labels all providers healthy", async () => {
    const report = await buildProviderReport({ ...empty, ...configured }, vi.fn(async url => String(url).includes("api.runpod.io") ? Response.json(endpoint(1)) : new Response(null, { status: 200 })));
    expect(report.checks[0]).toMatchObject({ capacity: "enabled", ok: true, readiness: "not-probed" });
    expect(report.summary).toBe("metadata-reachable"); expect(report.generationReadiness).toBe("not-probed");
  });
  it("absent credentials produce configured=false rows without any provider request", async () => {
    const fetcher = vi.fn(); const report = await buildProviderReport(empty, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(report.checks).toHaveLength(5);
    expect(report.checks.every(c => c.configured === false && c.ok === undefined)).toBe(true);
    expect(report.summary).toBe("unconfigured");
  });
  it.each([401, 403])("authenticated metadata HTTP%s cannot be reported as validated access", async status => {
    const report = await buildProviderReport({ ...empty, runpodApiKey: configured.runpodApiKey, runpodFluxEndpointId: configured.runpodFluxEndpointId, replicateApiToken: configured.replicateApiToken, runwayApiKey: configured.runwayApiKey }, vi.fn(async () => new Response("arbitrary private body", { status })));
    for (const row of report.checks.filter(c => c.configured)) expect(row).toMatchObject({ ok: false, hostReachable: true, authenticatedAccess: false, error: "authorization-rejected", httpStatus: status });
    expect(JSON.stringify(report)).not.toContain("arbitrary private body");
  });
  it.each([302, 404, 429, 503])("finite HTTP%s errors do not follow redirects or disclose response bodies", async status => {
    const fetcher = vi.fn(async () => new Response("secret-body", { status, headers: { location: "https://attacker.example/?key=secret" } }));
    const report = await buildProviderReport({ ...empty, runpodApiKey: configured.runpodApiKey, runpodFluxEndpointId: configured.runpodFluxEndpointId }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(report.checks[0].ok).toBe(false); expect(report.checks[0].authenticatedAccess).toBeNull(); expect(report.checks[0].httpStatus).toBe(status);
    expect(JSON.stringify(report)).not.toMatch(/secret-body|attacker|fixture-runpod/);
  });
  it.each([{ ...endpoint(), id: "foreign-endpoint" }, { ...endpoint(), workers: { min: 1, max: 0 } }, { ...endpoint(), workers: { min: 0, max: "1" } }, null])("rejects malformed or different endpoint inventory instead of claiming capacity", async body => {
    const report = await buildProviderReport({ ...empty, runpodApiKey: configured.runpodApiKey, runpodFluxEndpointId: configured.runpodFluxEndpointId }, vi.fn(async () => Response.json(body)));
    expect(report.checks[0]).toMatchObject({ ok: false, capacity: "unknown", error: "invalid-response", readiness: "not-probed" });
    expect(JSON.stringify(report)).not.toContain("foreign-endpoint");
  });
  it("refuses an endpoint path injection before any outbound call", async () => {
    const fetcher = vi.fn(); const report = await buildProviderReport({ ...empty, runpodApiKey: "fixture", runpodFluxEndpointId: "../health?key=x" }, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(report.checks[0].error).toBe("invalid-configuration");
  });
  it("a foreign timeout-named transport error is sanitized and is not retried", async () => {
    const fetcher = vi.fn(async () => { throw new DOMException("Bearer secret-private-token https://private.example/", "TimeoutError"); });
    const report = await buildProviderReport({ ...empty, runpodApiKey: configured.runpodApiKey, runpodFluxEndpointId: configured.runpodFluxEndpointId }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(report.checks[0].error).toBe("fetch-failed"); expect(JSON.stringify(report)).not.toContain("private");
  });
  it("own timeout has exactly one metadata-only retry, including stalled response-body parsing", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; });
    const fetcher = vi.fn(async (_url, init) => new Response(new ReadableStream({ start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new DOMException("private text", "AbortError")), { once: true }); } })));
    const pending = buildProviderReport({ ...empty, runpodApiKey: configured.runpodApiKey, runpodFluxEndpointId: configured.runpodFluxEndpointId }, fetcher);
    await vi.advanceTimersByTimeAsync(13_001); const report = await pending;
    expect(fetcher).toHaveBeenCalledTimes(2); expect(report.checks[0].error).toBe("timeout"); expect(report.checks[0].capacity).toBe("unknown"); expect(JSON.stringify(report)).not.toContain("private");
  });
  it("Kling bare-host404 retains homepage reachability without pretending its credentials are validated", async () => {
    const report = await buildProviderReport({ ...empty, klingAccessKey: configured.klingAccessKey, klingSecretKey: configured.klingSecretKey }, vi.fn(async () => new Response(null, { status: 404 })));
    expect(report.checks[4]).toMatchObject({ configured: true, ok: true, hostReachable: true, authenticatedAccess: null, probe: "host-reachability", readiness: "not-probed" });
  });
  it("the existing60-second cache reuses a sanitized report and refreshes only after expiry", async () => {
    let now = 1000; const build = vi.fn(() => buildProviderReport(empty, vi.fn())); const get = createProviderReportCache(build, () => now);
    const first = await get(); now += 59_999; const second = await get(); expect(second).toMatchObject({ ...first, cached: true }); expect(build).toHaveBeenCalledTimes(1);
    now += 1; await get(); expect(build).toHaveBeenCalledTimes(2);
  });
  it("the real Next handler reads only runtime metadata and returns the strengthened smoke response contract", async () => {
    vi.resetModules(); vi.stubEnv("RUNPOD_API_KEY", configured.runpodApiKey); vi.stubEnv("RUNPOD_FLUX_ENDPOINT_ID", configured.runpodFluxEndpointId);
    for (const name of ["REPLICATE_API_TOKEN", "FAL_API_KEY", "RUNWAY_API_KEY", "KLING_ACCESS_KEY", "KLING_SECRET_KEY"]) vi.stubEnv(name, "");
    const fetcher = vi.fn(async () => Response.json(endpoint())); vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../app/api/status/providers/route"); const response = await GET(), body = await response.json();
    expect(response.status).toBe(200); expect(body.mode).toBe("read-only-metadata"); expect(body.generationReadiness).toBe("not-probed"); expect(body.checks.map((c: {name: string}) => c.name)).toEqual(["runpod", "replicate", "fal", "runway", "kling"]);
    expect(body.checks[0]).toMatchObject({ probe: "control-plane-metadata", capacity: "disabled" });
    expect((await (await GET()).json()).cached).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
