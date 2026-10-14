import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  subscription: {} as Record<string, unknown>, read: vi.fn(), claim: vi.fn(), begin: vi.fn(), complete: vi.fn(), fail: vi.fn(), reconcile: vi.fn(),
  render: vi.fn(), createGeneration: vi.fn(), setTags: vi.fn(), active: vi.fn(), notify: vi.fn(), achievements: vi.fn(),
}));
vi.mock("./db", async (original) => ({ ...(await original<Record<string, unknown>>()),
  getDb: vi.fn(async () => { const chain: Record<string, unknown> = {}; for (const key of ["select", "from", "innerJoin", "where", "orderBy"]) chain[key] = () => chain; chain.limit = async () => [mocks.subscription]; return chain; }),
  createGeneration: (...args: unknown[]) => mocks.createGeneration(...args), setGenerationTags: (...args: unknown[]) => mocks.setTags(...args),
}));
vi.mock("./_core/generationBilling", () => ({
  readGenerationRequest: (...args: unknown[]) => mocks.read(...args), claimGenerationRequest: (...args: unknown[]) => mocks.claim(...args),
  beginGenerationRequest: (...args: unknown[]) => mocks.begin(...args), completeGenerationRequest: (...args: unknown[]) => mocks.complete(...args),
  failGenerationRequestAndRefund: (...args: unknown[]) => mocks.fail(...args), markGenerationReconciliation: (...args: unknown[]) => mocks.reconcile(...args),
}));
vi.mock("./_core/imageGeneration", () => ({ generateImage: (...args: unknown[]) => mocks.render(...args), isAutomaticImageConfigured: () => true }));
vi.mock("./_core/toolStatus", async (original) => ({ ...(await original<Record<string, unknown>>()), requireToolActive: (...args: unknown[]) => mocks.active(...args), logToolFailure: vi.fn(async () => {}) }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn(async () => {}) }));
vi.mock("./routersPhase15", async (original) => ({ ...(await original<Record<string, unknown>>()), createNotification: (...args: unknown[]) => mocks.notify(...args) }));
vi.mock("./routers/phase22", async (original) => ({ ...(await original<Record<string, unknown>>()), autoCheckAchievements: (...args: unknown[]) => mocks.achievements(...args), checkAndSendBudgetAlerts: vi.fn(async () => {}) }));
import { appRouter } from "./routers";
import { hashGenerationRequest } from "./_core/generationRequest";
import { DirectImageConfirmedRejection, DirectImageOutcomeUncertain } from "./_core/directImageProviders";

const input = () => ({ requestId: randomUUID(), prompt: "A fictional crystal mountain", modelVersion: "built-in-v1", mediaType: "image" as const, width: 768, height: 768, duration: 4, uncensored: false });
const record = (request: ReturnType<typeof input>, state: string, extra: Record<string, unknown> = {}) => ({ id: 4, userId: 8, requestId: request.requestId, payloadHash: hashGenerationRequest(request), quotedCredits: 5, state, generationId: state === "reserved" ? null : 9, result: null, ...extra });
const caller = () => appRouter.createCaller({ user: { id: 8, openId: "test", role: "user" } as never, session: null, ip: "local-test" });

describe("generation request router ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscription = { planName: "business", status: "active", currentPeriodStart: new Date(Date.now() - 60_000), currentPeriodEnd: new Date(Date.now() + 3600_000) };
    mocks.read.mockResolvedValue(null);
    mocks.active.mockResolvedValue(undefined);
    mocks.notify.mockResolvedValue(undefined);
    mocks.achievements.mockResolvedValue([]);
    mocks.createGeneration.mockResolvedValue(9);
    mocks.setTags.mockResolvedValue(undefined);
    mocks.render.mockResolvedValue({ url: "https://assets.example/image.png" });
    mocks.claim.mockImplementation(async (identity) => ({ kind: "owned", owner: { ...identity, id: 4, executionToken: randomUUID() }, request: { id: 4, ...identity, quotedCredits: identity.credits, state: "reserved", generationId: null, result: null } }));
    mocks.begin.mockImplementation(async (owner) => ({ kind: "begun", request: { ...owner, state: "rendering", generationId: 9 } }));
    mocks.complete.mockImplementation(async (owner, data) => ({ kind: "completed", request: { ...owner, quotedCredits: 5, state: "completed", generationId: 9, result: data.result } }));
    mocks.fail.mockImplementation(async (owner) => ({ kind: "refunded", request: { ...owner, quotedCredits: 5, state: "refunded", generationId: 9, result: null } }));
    mocks.reconcile.mockResolvedValue({ kind: "uncertain" });
  });
  it("completes through one reservation and fenced render, then replays the result", async () => {
    const request = input();
    const first = await caller().generation.create(request);
    mocks.read.mockResolvedValue(record(request, "completed", { result: first }));
    mocks.subscription.status = "canceled";
    expect(await caller().generation.create(request)).toEqual(first);
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(mocks.begin).toHaveBeenCalledTimes(1);
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(mocks.fail).not.toHaveBeenCalled();
  });
  it("returns an existing pending attempt without another charge or provider call", async () => {
    const request = input();
    mocks.read.mockResolvedValue(record(request, "rendering"));
    expect(await caller().generation.create(request)).toMatchObject({ status: "generating", requestId: request.requestId, id: 9 });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("rejects a different payload using the same key before a debit", async () => {
    const request = input();
    mocks.read.mockResolvedValue(record(request, "rendering"));
    await expect(caller().generation.create({ ...request, prompt: "Different fictional scene" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("does not render after a lost reservation or begin acknowledgment", async () => {
    mocks.claim.mockResolvedValueOnce({ kind: "uncertain" });
    expect(await caller().generation.create(input())).toMatchObject({ status: "generating" });
    mocks.begin.mockResolvedValueOnce({ kind: "uncertain" });
    expect(await caller().generation.create(input())).toMatchObject({ status: "generating" });
    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.fail).not.toHaveBeenCalled();
  });
  it("does not refund after uncertain completion, and preserves a recovered completion", async () => {
    mocks.complete.mockResolvedValueOnce({ kind: "uncertain" });
    const request = input();
    expect(await caller().generation.create(request)).toMatchObject({ status: "generating", requestId: request.requestId });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.fail).not.toHaveBeenCalled();
  });
  it("settles a failure before provider invocation once and replays its terminal refund", async () => {
    const request = { ...input(), tagIds: [1] };
    mocks.setTags.mockRejectedValueOnce(new Error("Tags unavailable"));
    expect(await caller().generation.create(request)).toMatchObject({ status: "failed", requestId: request.requestId });
    mocks.read.mockResolvedValue(record(request, "refunded"));
    expect(await caller().generation.create(request)).toMatchObject({ status: "failed" });
    expect(mocks.fail).toHaveBeenCalledTimes(1);
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("does not report a completed refund when settlement is uncertain", async () => {
    mocks.createGeneration.mockRejectedValueOnce(new Error("Record unavailable"));
    mocks.fail.mockResolvedValueOnce({ kind: "uncertain" });
    expect(await caller().generation.create(input())).toMatchObject({ status: "generating" });
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });
  it.each(["fal.ai generation timed out", "fetch failed", "Failed to download result", "Storage unavailable"])("holds an unverified renderer failure for review: %s", async (message) => {
    const request = input();
    mocks.render.mockRejectedValueOnce(new Error(message));
    expect(await caller().generation.create(request)).toMatchObject({ status: "generating", requestId: request.requestId, reconciliationRequired: true });
    mocks.read.mockResolvedValue(record(request, "reconciliation"));
    expect(await caller().generation.create(request)).toMatchObject({ status: "generating", reconciliationRequired: true });
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(mocks.fail).not.toHaveBeenCalled();
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });
  it("normalizes UUID casing before storing and returning a request identity", async () => {
    const request = input();
    const upper = request.requestId.toUpperCase();
    expect(await caller().generation.create({ ...request, requestId: upper })).toMatchObject({ requestId: request.requestId });
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ requestId: request.requestId }));
  });
  it.each([401, 403, 404, 429])("refunds a typed direct-provider rejection once and replays it: HTTP %s", async (status) => {
    const request = input();
    mocks.render.mockRejectedValueOnce(new DirectImageConfirmedRejection("xai", "grok-imagine-image-2.0", status));
    expect(await caller().generation.create(request)).toMatchObject({ status: "failed", requestId: request.requestId });
    mocks.read.mockResolvedValue(record(request, "refunded"));
    expect(await caller().generation.create(request)).toMatchObject({ status: "failed" });
    expect(mocks.fail).toHaveBeenCalledTimes(1);
    expect(mocks.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirmedFailure: true }));
    expect(mocks.render).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it.each([
    new DirectImageOutcomeUncertain("xai", "grok-imagine-image-2.0", "timeout"),
    new DirectImageOutcomeUncertain("xai", "grok-imagine-image-2.0", "http_error", 503),
    new DirectImageOutcomeUncertain("openai", "gpt-image-2.5-flare-2026-09-08", "http_error", 400),
    new DirectImageOutcomeUncertain("xai", "grok-imagine-image-2.0", "http_error", 422),
    Object.assign(new Error("Rejected HTTP 429"), { outcome: "confirmed_rejection", status: 429 }),
  ])("holds ambiguous or untyped direct errors without a refund or another render", async (error) => {
    const request = input();
    mocks.render.mockRejectedValueOnce(error);
    expect(await caller().generation.create(request)).toMatchObject({ status: "generating", reconciliationRequired: true });
    mocks.read.mockResolvedValue(record(request, "reconciliation"));
    await caller().generation.create(request);
    expect(mocks.fail).not.toHaveBeenCalled();
    expect(mocks.render).toHaveBeenCalledTimes(1);
  });
  it("returns confirmed insufficient-credit rejection as terminal without rendering", async () => {
    const request = input();
    mocks.claim.mockResolvedValueOnce({ kind: "replay", request: record(request, "rejected", { generationId: null }) });
    expect(await caller().generation.create(request)).toMatchObject({ status: "failed", error: expect.stringContaining("No credits charged") });
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("preserves completed delivery despite notification failure", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("Notification offline"));
    expect(await caller().generation.create(input())).toMatchObject({ status: "completed" });
    expect(mocks.fail).not.toHaveBeenCalled();
  });
});
