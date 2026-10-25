import { afterEach, describe, expect, it, vi } from "vitest";
import { buildProviderReport, createProviderReportCache, type ProviderConfiguration } from "./_core/providerStatus";

const empty: ProviderConfiguration = { runpodApiKey: "", runpodFluxEndpointId: "", replicateApiToken: "", falApiKey: "", runwayApiKey: "", klingAccessKey: "", klingSecretKey: "" };
const configured = { runpodApiKey: "fixture-runpod-secret", runpodFluxEndpointId: "fixture-flux", replicateApiToken: "fixture-replicate-secret", falApiKey: "fixture-fal-secret", runwayApiKey: "fixture-runway-secret", klingAccessKey: "fixture-kling-key", klingSecretKey: "fixture-kling-secret" };
const endpoint = (max = 0) => ({ id: "fixture-flux", workers: { min: 0, max, idleTimeout: 300 }, env: { TOKEN: "must-never-be-public" }, name: "private-name", requestUrls: { health: "https://api.runpod.ai/v2/fixture-flux/health" } });
const balance = (clientBalance: unknown = 4321.987) => ({ data: { myself: { clientBalance, email: "owner@private.example", id: "private-user-id" } } });
const isGraphql = (url: unknown) => String(url).endsWith("api.runpod.io/graphql");
const runpodOnly = { ...empty, runpodApiKey: configured.runpodApiKey, runpodFluxEndpointId: configured.runpodFluxEndpointId };
const ALL_NAMES = ["runpod", "runpod-balance", "replicate", "fal", "runway", "kling"];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("actual metadata-only provider consumer", () => {
  it("uses only exact supported management/account reads and anonymous host HEAD, without worker or task calls", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (isGraphql(url)) return Response.json(balance());
      return String(url).includes("api.runpod.io") ? Response.json(endpoint()) : new Response(null, { status: 200 });
    });
    const report = await buildProviderReport(configured, fetcher);
    expect(calls.map(c => [c.url, c.init?.method])).toEqual([
      ["https://api.runpod.io/v2/serverless/fixture-flux", "GET"], ["https://api.runpod.io/graphql", "POST"], ["https://api.replicate.com/v1/account", "GET"],
      ["https://status.fal.ai/", "HEAD"], ["https://api.dev.runwayml.com/v1/organization", "GET"], ["https://api.klingai.com/", "HEAD"],
    ]);
    for (const c of calls) { expect(c.init?.redirect).toBe("manual"); expect(c.init?.signal).toBeTruthy(); expect(c.url).not.toMatch(/\/health|\/workers|\/run(?:sync)?(?:\/|$)|\/warm|\/billing|\/requests/); }
    // The only request body anywhere is the one-scalar balance query.
    for (const c of calls.filter(c => !isGraphql(c.url))) expect(c.init?.body).toBeUndefined();
    expect(calls[1].init?.body).toBe(JSON.stringify({ query: "{ myself { clientBalance } }" }));
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer fixture-runpod-secret");
    expect(new Headers(calls[1].init?.headers).get("authorization")).toBe("Bearer fixture-runpod-secret");
    expect(new Headers(calls[2].init?.headers).get("authorization")).toBe("Bearer fixture-replicate-secret");
    expect(calls[3].init?.headers).toBeUndefined(); expect(calls[5].init?.headers).toBeUndefined();
    expect(report.checks.every(c => c.readiness === "not-probed")).toBe(true);
    expect(report.checks.map(c => c.name)).toEqual(ALL_NAMES);
    expect(report).toMatchObject({ mode: "read-only-metadata", generationReadiness: "not-probed", summary: "degraded:runpod" });
    expect(report.checks[0]).toMatchObject({ configured: true, hostReachable: true, authenticatedAccess: true, capacity: "disabled", ok: false, error: "capacity-disabled" });
    expect(report.checks[1]).toMatchObject({ configured: true, probe: "account-metadata", authenticatedAccess: true, balance: "ok", ok: true });
    const publicJson = JSON.stringify(report);
    for (const secret of [...Object.values(configured), "must-never-be-public", "private-name", "requestUrls", "TOKEN", "4321", "clientBalance", "owner@private", "private-user-id"]) expect(publicJson).not.toContain(secret);
  });
  it("enabled capacity plus a funded balance is all-healthy, distinct from unprobed readiness", async () => {
    const report = await buildProviderReport({ ...empty, ...configured }, vi.fn(async url => isGraphql(url) ? Response.json(balance()) : String(url).includes("api.runpod.io") ? Response.json(endpoint(1)) : new Response(null, { status: 200 })));
    expect(report.checks[0]).toMatchObject({ capacity: "enabled", ok: true, readiness: "not-probed" });
    expect(report.summary).toBe("all-healthy"); expect(report.generationReadiness).toBe("not-probed");
  });
  it("a balance under the floor degrades the report before RunPod pauses the endpoint, without publishing the amount", async () => {
    const report = await buildProviderReport({ ...empty, ...configured }, vi.fn(async url => isGraphql(url) ? Response.json(balance(7.77)) : String(url).includes("api.runpod.io") ? Response.json(endpoint(1)) : new Response(null, { status: 200 })));
    expect(report.checks[1]).toMatchObject({ configured: true, ok: false, balance: "low", error: "balance-low", authenticatedAccess: true });
    expect(report.summary).toBe("degraded:runpod-balance");
    expect(JSON.stringify(report)).not.toContain("7.77");
  });
  it("the floor is configurable and a zero floor never alerts", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => isGraphql(url) ? Response.json(balance(7.77)) : Response.json(endpoint(1)));
    expect((await buildProviderReport({ ...runpodOnly, runpodLowBalanceUsd: 5 }, fetcher)).checks[1]).toMatchObject({ ok: true, balance: "ok" });
    expect((await buildProviderReport({ ...runpodOnly, runpodLowBalanceUsd: 10 }, fetcher)).checks[1]).toMatchObject({ ok: false, balance: "low" });
    expect((await buildProviderReport({ ...runpodOnly, runpodLowBalanceUsd: 0 }, fetcher)).checks[1]).toMatchObject({ ok: true, balance: "ok" });
    expect((await buildProviderReport({ ...runpodOnly, runpodLowBalanceUsd: Number.NaN }, fetcher)).checks[1]).toMatchObject({ ok: false, balance: "low" });
  });
  it.each([balance("12"), balance(null), { data: { myself: null } }, { errors: [{ message: "private detail" }] }, null])("a malformed balance payload is unknown, never ok", async body => {
    const report = await buildProviderReport(runpodOnly, vi.fn(async (url: string | URL | Request) => isGraphql(url) ? Response.json(body) : Response.json(endpoint(1))));
    expect(report.checks[1]).toMatchObject({ ok: false, balance: "unknown", error: "invalid-response" });
    expect(JSON.stringify(report)).not.toContain("private detail");
  });
  it("absent credentials produce configured=false rows without any provider request", async () => {
    const fetcher = vi.fn(); const report = await buildProviderReport(empty, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(report.checks).toHaveLength(6);
    expect(report.checks.every(c => c.configured === false && c.ok === undefined)).toBe(true);
    expect(report.summary).toBe("unconfigured");
  });
  it.each([401, 403])("authenticated metadata HTTP%s cannot be reported as validated access", async status => {
    const report = await buildProviderReport({ ...runpodOnly, replicateApiToken: configured.replicateApiToken, runwayApiKey: configured.runwayApiKey }, vi.fn(async () => new Response("arbitrary private body", { status })));
    expect(report.checks.filter(c => c.configured)).toHaveLength(4);
    for (const row of report.checks.filter(c => c.configured)) expect(row).toMatchObject({ ok: false, hostReachable: true, authenticatedAccess: false, error: "authorization-rejected", httpStatus: status });
    expect(report.checks[1].balance).toBe("unknown");
    expect(JSON.stringify(report)).not.toContain("arbitrary private body");
  });
  it.each([302, 404, 429, 503])("finite HTTP%s errors do not follow redirects or disclose response bodies", async status => {
    const fetcher = vi.fn(async () => new Response("secret-body", { status, headers: { location: "https://attacker.example/?key=secret" } }));
    const report = await buildProviderReport(runpodOnly, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(report.checks[0].ok).toBe(false); expect(report.checks[0].authenticatedAccess).toBeNull(); expect(report.checks[0].httpStatus).toBe(status);
    expect(report.checks[1]).toMatchObject({ ok: false, balance: "unknown", authenticatedAccess: null, httpStatus: status });
    expect(JSON.stringify(report)).not.toMatch(/secret-body|attacker|fixture-runpod/);
  });
  it.each([{ ...endpoint(), id: "foreign-endpoint" }, { ...endpoint(), workers: { min: 1, max: 0 } }, { ...endpoint(), workers: { min: 0, max: "1" } }, null])("rejects malformed or different endpoint inventory instead of claiming capacity", async body => {
    const report = await buildProviderReport(runpodOnly, vi.fn(async (url: string | URL | Request) => isGraphql(url) ? Response.json(balance()) : Response.json(body)));
    expect(report.checks[0]).toMatchObject({ ok: false, capacity: "unknown", error: "invalid-response", readiness: "not-probed" });
    expect(JSON.stringify(report)).not.toContain("foreign-endpoint");
  });
  it("refuses an endpoint path injection before any outbound call, balance read included", async () => {
    const fetcher = vi.fn(); const report = await buildProviderReport({ ...empty, runpodApiKey: "fixture", runpodFluxEndpointId: "../health?key=x" }, fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(report.checks[0].error).toBe("invalid-configuration"); expect(report.checks[1]).toMatchObject({ ok: false, balance: "unknown", error: "invalid-configuration" });
  });
  it("a foreign timeout-named transport error is sanitized and is not retried", async () => {
    const fetcher = vi.fn(async () => { throw new DOMException("Bearer secret-private-token https://private.example/", "TimeoutError"); });
    const report = await buildProviderReport(runpodOnly, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(report.checks[0].error).toBe("fetch-failed"); expect(report.checks[1].error).toBe("fetch-failed"); expect(JSON.stringify(report)).not.toContain("private");
  });
  it("own timeout has exactly one metadata-only retry, including stalled response-body parsing", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; });
    const fetcher = vi.fn(async (_url, init) => new Response(new ReadableStream({ start(controller) { init?.signal?.addEventListener("abort", () => controller.error(new DOMException("private text", "AbortError")), { once: true }); } })));
    const pending = buildProviderReport(runpodOnly, fetcher);
    await vi.advanceTimersByTimeAsync(13_001); const report = await pending;
    expect(fetcher).toHaveBeenCalledTimes(4); expect(report.checks[0].error).toBe("timeout"); expect(report.checks[0].capacity).toBe("unknown"); expect(report.checks[1]).toMatchObject({ error: "timeout", balance: "unknown" }); expect(JSON.stringify(report)).not.toContain("private");
  });
  it("Kling bare-host404 retains homepage reachability without pretending its credentials are validated", async () => {
    const report = await buildProviderReport({ ...empty, klingAccessKey: configured.klingAccessKey, klingSecretKey: configured.klingSecretKey }, vi.fn(async () => new Response(null, { status: 404 })));
    expect(report.checks[5]).toMatchObject({ name: "kling", configured: true, ok: true, hostReachable: true, authenticatedAccess: null, probe: "host-reachability", readiness: "not-probed" });
  });
  it("the existing60-second cache reuses a sanitized report and refreshes only after expiry", async () => {
    let now = 1000; const build = vi.fn(() => buildProviderReport(empty, vi.fn())); const get = createProviderReportCache(build, () => now);
    const first = await get(); now += 59_999; const second = await get(); expect(second).toMatchObject({ ...first, cached: true }); expect(build).toHaveBeenCalledTimes(1);
    now += 1; await get(); expect(build).toHaveBeenCalledTimes(2);
  });
  it("the real Next handler reads only runtime metadata and returns the strengthened smoke response contract", async () => {
    vi.resetModules(); vi.stubEnv("RUNPOD_API_KEY", configured.runpodApiKey); vi.stubEnv("RUNPOD_FLUX_ENDPOINT_ID", configured.runpodFluxEndpointId); vi.stubEnv("RUNPOD_LOW_BALANCE_USD", "30");
    for (const name of ["REPLICATE_API_TOKEN", "FAL_API_KEY", "RUNWAY_API_KEY", "KLING_ACCESS_KEY", "KLING_SECRET_KEY"]) vi.stubEnv(name, "");
    const fetcher = vi.fn(async (url: string | URL | Request) => isGraphql(url) ? Response.json(balance(29.5)) : Response.json(endpoint())); vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("../app/api/status/providers/route"); const response = await GET(), body = await response.json();
    expect(response.status).toBe(200); expect(body.mode).toBe("read-only-metadata"); expect(body.generationReadiness).toBe("not-probed"); expect(body.checks.map((c: {name: string}) => c.name)).toEqual(ALL_NAMES);
    expect(body.checks[0]).toMatchObject({ probe: "control-plane-metadata", capacity: "disabled" });
    expect(body.checks[1]).toMatchObject({ balance: "low", error: "balance-low" }); expect(body.summary).toBe("degraded:runpod,runpod-balance");
    expect(JSON.stringify(body)).not.toContain("29.5");
    expect((await (await GET()).json()).cached).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
