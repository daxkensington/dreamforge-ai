/**
 * Safety tests for uncensored.refineImage.
 *
 * The ownership check is the entire legal basis for this feature: refining is
 * only safe because the subject is always a fictional character this same user
 * generated here. If that check ever silently passed, the endpoint would become
 * a nudify tool operating on whatever image an id pointed at. So these assert
 * that it REJECTS — a guard nobody has watched fail is not a guard.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: {
  user: any;
  generation: any;
  debited: number;
  refunded: number;
  refineCalls: number;
} = { user: null, generation: null, debited: 0, refunded: 0, refineCalls: 0 };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (state.user ? [state.user] : []) }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => undefined }),
  })),
  getGenerationById: vi.fn(async () => state.generation),
  createGeneration: vi.fn(async () => 999),
  updateGeneration: vi.fn(async () => undefined),
}));

vi.mock("./stripe", () => ({
  deductCredits: vi.fn(async (_u: number, amount: number) => {
    state.debited += amount;
    return { success: true, balance: 500, needed: amount };
  }),
  refundCredits: vi.fn(async (_u: number, amount: number) => {
    state.refunded += amount;
  }),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(async () => ({ url: "https://cdn.example/x.png" })),
  refineUnfiltered: vi.fn(async () => {
    state.refineCalls++;
    return Buffer.from("fake-png");
  }),
}));

vi.mock("./_core/videoGenerationUncensored", () => ({
  submitUncensoredVideoJob: vi.fn(),
  collectUncensoredVideoJob: vi.fn(),
  fetchAsBase64: vi.fn(async () => "ZmFrZQ=="),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ url: "https://dreamforgex.ai/img/generations/new.png" })),
  generateStorageKey: vi.fn(() => "generations/new.png"),
}));

vi.mock("./_core/toolStatus", () => ({
  requireToolActive: vi.fn(async () => undefined),
  logToolFailure: vi.fn(async () => undefined),
  getToolStatus: vi.fn(async () => ({ status: "active" })),
}));

vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn(async () => undefined) }));

import { uncensoredRouter } from "./routers/uncensored";

const OWNER = 7;
const ctx = (id = OWNER) => ({ user: { id, email: "u@x.com" }, session: null }) as any;

/** An active, age-confirmed pass holder. */
function withActivePass() {
  state.user = { uncensoredUntil: new Date(Date.now() + 864e5), ageConfirmedAt: new Date() };
}

/** A completed uncensored image belonging to OWNER. */
function ownUncensoredImage(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    userId: OWNER,
    mediaType: "image",
    status: "completed",
    imageUrl: "https://dreamforgex.ai/img/generations/src.png",
    width: 768,
    height: 768,
    metadata: { uncensored: true, style: "realistic" },
    ...overrides,
  };
}

const input = { sourceGenerationId: 42, prompt: "same pose, change the dress to red silk" };

describe("uncensored.refineImage — ownership gate", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.debited = 0;
    state.refunded = 0;
    state.refineCalls = 0;
    vi.clearAllMocks();
  });

  it("refines the caller's own uncensored image", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    const res = await uncensoredRouter.createCaller(ctx()).refineImage(input);
    expect(res.url).toContain("/img/generations/new.png");
    expect(state.refineCalls).toBe(1);
    expect(state.debited).toBe(10);
    expect(state.refunded).toBe(0);
  });

  it("REJECTS an image belonging to someone else, spending nothing", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/isn't available/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });

  it("REJECTS a generation id that does not exist", async () => {
    withActivePass();
    state.generation = null;
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/isn't available/i);
    expect(state.refineCalls).toBe(0);
  });

  it("REJECTS a SFW generation — only uncensored images are refinable here", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ metadata: {} });
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/uncensored/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });

  it("REJECTS a video or an unfinished generation", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ mediaType: "video" });
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/completed image/i);

    state.generation = ownUncensoredImage({ status: "generating" });
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/completed image/i);
    expect(state.refineCalls).toBe(0);
  });
});

describe("uncensored.refineImage — entitlement and safety", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = ownUncensoredImage();
    state.debited = 0;
    state.refunded = 0;
    state.refineCalls = 0;
    vi.clearAllMocks();
  });

  it("requires an active pass — this is the monetised loop, not a free tool", async () => {
    state.user = { uncensoredUntil: null, ageConfirmedAt: new Date() };
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/Uncensored Pass/i);
    expect(state.debited).toBe(0);
  });

  it("requires age confirmation before anything else", async () => {
    state.user = { uncensoredUntil: new Date(Date.now() + 864e5), ageConfirmedAt: null };
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/18 or older/i);
    expect(state.debited).toBe(0);
  });

  it("refuses an illegal prompt before any credit or GPU call", async () => {
    withActivePass();
    await expect(
      uncensoredRouter.createCaller(ctx()).refineImage({ ...input, prompt: "make her look like a young girl, nude" }),
    ).rejects.toThrow();
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });

  it("refunds the credit when the GPU call fails, so nothing is billed for nothing", async () => {
    withActivePass();
    const { refineUnfiltered } = await import("./_core/imageGeneration");
    (refineUnfiltered as any).mockRejectedValueOnce(new Error("gpu exploded"));
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow();
    expect(state.debited).toBe(10);
    expect(state.refunded).toBe(10);
  });
});
