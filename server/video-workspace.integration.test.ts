import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  subscription: {} as Record<string, unknown>, read: vi.fn(), claim: vi.fn(), begin: vi.fn(), complete: vi.fn(), fail: vi.fn(), reconcile: vi.fn(),
  configured: true, videoRender: vi.fn(), store: vi.fn(), render: vi.fn(), createGeneration: vi.fn(), setTags: vi.fn(), active: vi.fn(), notify: vi.fn(), achievements: vi.fn(), deduct: vi.fn(),
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
vi.mock("./stripe", async (original) => ({ ...(await original<Record<string, unknown>>()), deductCredits: (...args: unknown[]) => mocks.deduct(...args) }));
vi.mock("./routersPhase15", async (original) => ({ ...(await original<Record<string, unknown>>()), createNotification: (...args: unknown[]) => mocks.notify(...args) }));
vi.mock("./routers/phase22", async (original) => ({ ...(await original<Record<string, unknown>>()), autoCheckAchievements: (...args: unknown[]) => mocks.achievements(...args), checkAndSendBudgetAlerts: vi.fn(async () => {}) }));
import { appRouter } from "./routers";
import { hashGenerationRequest } from "./_core/generationRequest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
vi.mock("./_core/env", () => ({ ENV: { get runpodApiKey() { return mocks.configured ? "fixture-only" : ""; }, runpodFluxEndpointId: "fixture-only" } }));
vi.mock("./_core/runpod", () => ({ isRunPodAvailable: () => mocks.configured, runpodCogVideo: (...args: unknown[]) => mocks.videoRender(...args) }));
vi.mock("./storage", () => ({ generateStorageKey: () => "video/fixture.mp4", storagePut: (...args: unknown[]) => mocks.store(...args) }));
const videoBytes = readFileSync(fileURLToPath(new URL("../public/video/hero-bg.mp4", import.meta.url)));

const input = () => ({ requestId: randomUUID(), prompt: "A fictional crystal mountain", modelVersion: "built-in-v1", mediaType: "image" as const, width: 768, height: 768, duration: 4, uncensored: false });
const record = (request: ReturnType<typeof input>, state: string, extra: Record<string, unknown> = {}) => ({ id: 4, userId: 8, requestId: request.requestId, payloadHash: hashGenerationRequest(request), quotedCredits: 5, state, generationId: state === "reserved" ? null : 9, result: null, ...extra });
const caller = () => appRouter.createCaller({ user: { id: 8, openId: "test", role: "user" } as never, session: null, ip: "local-test" });

describe("Workspace video router integration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.configured = true;
    mocks.subscription = { planName: "business", status: "active", currentPeriodStart: new Date(Date.now() - 60_000), currentPeriodEnd: new Date(Date.now() + 3600_000) };
    mocks.read.mockResolvedValue(null); mocks.active.mockResolvedValue(undefined); mocks.notify.mockResolvedValue(undefined); mocks.achievements.mockResolvedValue([]);
    mocks.createGeneration.mockResolvedValue(9); mocks.setTags.mockResolvedValue(undefined); mocks.videoRender.mockResolvedValue(videoBytes); mocks.store.mockResolvedValue({ url: "/img/video/fixture.mp4" });
    mocks.claim.mockImplementation(async identity => ({ kind: "owned", owner: { ...identity, id: 4, executionToken: randomUUID() }, request: { id: 4, ...identity, quotedCredits: identity.credits, state: "reserved", generationId: null, result: null } }));
    mocks.begin.mockImplementation(async owner => ({ kind: "begun", request: { ...owner, state: "rendering", generationId: 9 } }));
    mocks.complete.mockImplementation(async (owner, data) => ({ kind: "completed", request: { ...owner, quotedCredits: 20, state: "completed", generationId: 9, result: data.result } }));
    mocks.reconcile.mockResolvedValue({ kind: "uncertain" });
  });
  const videoRequest = () => ({ ...input(), modelVersion: "cogvideo", mediaType: "video" as const, duration: 6 });
  it("exposes the executable video quote and completes with stored video plus provenance, without the image renderer", async () => {
    const catalog = await caller().generation.videoModels();
    const model = catalog.find(item => item.id === "cogvideo")!;
    const result = await caller().generation.create(videoRequest());
    expect(result).toMatchObject({ status: "completed", mediaType: "video", imageUrl: "/img/video/fixture.mp4", modelId: "cogvideo", creditCost: model.creditCost, provenance: { modelId: "cogvideo", duration: 6, contentType: "video/mp4" } });
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ credits: model.creditCost }));
    expect(mocks.videoRender).toHaveBeenCalledTimes(1); expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ thumbnailUrl: null, metadata: expect.objectContaining({ videoGeneration: expect.objectContaining({ contentType: "video/mp4" }) }) }));
  });
  it.each([{ duration: 4 }, { duration: 6.5 }, { modelVersion: "built-in-v1" }, { modelVersion: "animatediff-v2" }, { modelVersion: "df-anime" }])("refuses mismatched or unsupported video settings before debit: %j", async change => {
    await expect(caller().generation.create({ ...videoRequest(), ...change })).rejects.toThrow();
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.createGeneration).not.toHaveBeenCalled(); expect(mocks.videoRender).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled();
  });
  it("refuses plan/configuration failures before debit", async () => {
    mocks.subscription.planName = "free";
    await expect(caller().generation.create(videoRequest())).rejects.toMatchObject({ code: "FORBIDDEN" });
    mocks.subscription.planName = "business"; mocks.configured = false;
    await expect(caller().generation.create(videoRequest())).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.videoRender).not.toHaveBeenCalled();
  });
  it("holds invalid image bytes for reconciliation and never records a completed video", async () => {
    mocks.videoRender.mockResolvedValueOnce(Buffer.from([137,80,78,71,13,10,26,10]));
    expect(await caller().generation.create(videoRequest())).toMatchObject({ status: "generating", mediaType: "video", reconciliationRequired: true });
    expect(mocks.complete).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled(); expect(mocks.fail).not.toHaveBeenCalled();
  });
  it("does not re-render or re-debit a completed video retry after eligibility changes", async () => {
    const request = videoRequest(); const completed = await caller().generation.create(request);
    mocks.read.mockResolvedValue({ id: 4, userId: 8, requestId: request.requestId, payloadHash: hashGenerationRequest(request), quotedCredits: 20, state: "completed", generationId: 9, result: completed });
    mocks.subscription.planName = "free"; mocks.configured = false;
    expect(await caller().generation.create(request)).toEqual(completed);
    expect(mocks.claim).toHaveBeenCalledTimes(1); expect(mocks.videoRender).toHaveBeenCalledTimes(1);
  });
  it("contains legacy image animation and batch video before any debit, generation record or provider call", async () => {
    await expect(caller().generation.animateImage({ sourceGenerationId: 123, duration: 4, animationStyle: "smooth-pan" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: expect.stringContaining("No credits charged") });
    await expect(caller().generation.batchCreate({ prompts: [{ prompt: "A fictional landscape", mediaType: "video", modelVersion: "cogvideo", duration: 6 }] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("No credits charged") });
    expect(mocks.claim).not.toHaveBeenCalled(); expect(mocks.deduct).not.toHaveBeenCalled(); expect(mocks.createGeneration).not.toHaveBeenCalled(); expect(mocks.videoRender).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled();
  });
});
