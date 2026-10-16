import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ subscription: {} as Record<string, unknown>, generate: vi.fn(), caller: vi.fn(), rateLimit: vi.fn(), lastUsed: vi.fn(), readRequest: vi.fn() }));
vi.mock("./db", () => ({ getDb: vi.fn(async () => {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "from", "innerJoin", "where", "orderBy"]) chain[name] = () => chain;
  chain.limit = async () => [mocks.subscription];
  return chain;
}) }));
vi.mock("./dbExtended", () => ({ getApiKeyByHash: vi.fn(async () => ({ id: 1, userId: 8, rateLimit: 100, expiresAt: null })), updateApiKeyLastUsed: (...args: unknown[]) => mocks.lastUsed(...args) }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: (...args: unknown[]) => mocks.rateLimit(...args) }));
vi.mock("./_core/generationBilling", () => ({ readGenerationRequest: (...args: unknown[]) => mocks.readRequest(...args) }));
vi.mock("./routers", () => ({ appRouter: { createCaller: (...args: unknown[]) => { mocks.caller(...args); return { generation: { create: mocks.generate } }; } } }));
import { OPTIONS, POST } from "../app/api/v1/generate/route";

const requestId = "114bdd89-cd2b-4b77-8ad3-857220ed45ed";
const request = (body: unknown = { prompt: "A crystal mountain" }, key: string | null = requestId) => new NextRequest("http://localhost/api/v1/generate", {
  method: "POST", headers: { Authorization: "Bearer df_example_key", "Content-Type": "application/json", ...(key === null ? {} : { "Idempotency-Key": key }) }, body: JSON.stringify(body),
});

describe("generation API retry contract", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    vi.clearAllMocks();
    mocks.subscription = { planName: "business", status: "active", currentPeriodStart: new Date("2026-10-01T00:00:00Z"), currentPeriodEnd: new Date("2026-11-01T00:00:00Z") };
    mocks.rateLimit.mockResolvedValue(undefined);
    mocks.lastUsed.mockResolvedValue(undefined);
    mocks.readRequest.mockResolvedValue(null);
    mocks.generate.mockImplementation(async (input) => ({ id: 9, status: "completed", imageUrl: "https://assets.example/image.png", requestId: input.requestId }));
  });
  afterEach(() => vi.useRealTimers());

  it("forwards the same supplied identity on retries and exposes it in the response", async () => {
    const first = await POST(request());
    const second = await POST(request());
    expect(first.status).toBe(200);
    expect(first.headers.get("Idempotency-Key")).toBe(requestId);
    expect(await first.json()).toMatchObject({ requestId, status: "completed", id: 9 });
    expect(second.status).toBe(200);
    expect(mocks.generate.mock.calls.map(([input]) => input.requestId)).toEqual([requestId, requestId]);
  });
  it("uses distinct generated IDs when no retry key is supplied", async () => {
    const first = await POST(request(undefined, null));
    const second = await POST(request(undefined, null));
    expect(first.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers.get("Idempotency-Key")).not.toBe(second.headers.get("Idempotency-Key"));
  });
  it("returns pending as 202 with retry instructions rather than failed generation", async () => {
    mocks.generate.mockResolvedValue({ id: null, status: "generating", requestId, retryAfterMs: 3000, reconciliationRequired: true });
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(await response.json()).toMatchObject({ status: "generating", requestId, reconciliationRequired: true });
  });
  it("maps a payload identity conflict to 409", async () => {
    mocks.generate.mockRejectedValue({ code: "CONFLICT", message: "Different generation." });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ requestId, error: { code: "idempotency_conflict" } });
  });
  it.each(["canceled", "past_due", "incomplete", "unpaid"])("does not authorize a saved Business plan with status %s", async (status) => {
    mocks.subscription.status = status;
    expect((await POST(request())).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("denies an expired active interval but preserves active period-end cancellation", async () => {
    mocks.subscription.currentPeriodEnd = new Date("2026-10-13T12:00:00Z");
    expect((await POST(request())).status).toBe(403);
    mocks.subscription.currentPeriodEnd = new Date("2026-11-01T00:00:00Z");
    mocks.subscription.cancelAtPeriodEnd = true;
    expect((await POST(request())).status).toBe(200);
  });
  it("allows only an existing owner-scoped keyed request after paid eligibility ends", async () => {
    mocks.subscription.status = "canceled";
    mocks.readRequest.mockResolvedValue({ requestId, state: "rendering" });
    mocks.generate.mockResolvedValue({ status: "generating", requestId });
    expect((await POST(request())).status).toBe(202);
    expect(mocks.readRequest).toHaveBeenCalledWith({ userId: 8, requestId });
    mocks.generate.mockClear();
    mocks.readRequest.mockClear();
    expect((await POST(request(undefined, null))).status).toBe(403);
    expect(mocks.readRequest).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("still rejects changed payloads on a saved request after cancellation", async () => {
    mocks.subscription.status = "canceled";
    mocks.readRequest.mockResolvedValue({ requestId, state: "rendering" });
    mocks.generate.mockRejectedValue({ code: "CONFLICT", message: "Different generation." });
    expect((await POST(request({ prompt: "Changed inputs" }))).status).toBe(409);
  });
  it("does not submit when saved-request lookup is uncertain", async () => {
    mocks.subscription.status = "canceled";
    mocks.readRequest.mockRejectedValue(new Error("Database reply lost"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("rejects malformed keys and invalid dimensions before generation", async () => {
    expect((await POST(request(undefined, "not-a-uuid"))).status).toBe(400);
    expect((await POST(request({ prompt: "A crystal mountain", width: 2048 }))).status).toBe(400);
    expect((await POST(request({ prompt: "A crystal mountain", height: 768.5 }))).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("preserves 402 for a terminal uncharged insufficient-credit result", async () => {
    mocks.generate.mockResolvedValue({ status: "failed", requestId, error: "Insufficient credits. No credits charged." });
    expect((await POST(request())).status).toBe(402);
  });
  it("advertises the retry key and retry header through CORS", async () => {
    const response = await OPTIONS();
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Idempotency-Key");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("Retry-After");
  });
});
