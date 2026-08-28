/**
 * Safety + billing tests for uncensored.generate — the paid image studio.
 *
 * Character lock has the same ownership gate as Refine: it may only img2img
 * the caller's own uncensored generations. A hole here becomes a nudify tool.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: {
  user: any;
  generation: any;
  debited: number;
  refunded: number;
  genCalls: number;
  refineCalls: number;
  created: any[];
} = { user: null, generation: null, debited: 0, refunded: 0, genCalls: 0, refineCalls: 0, created: [] };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (state.user ? [state.user] : []),
          orderBy: () => ({ limit: async () => [] }),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: () => ({ values: async () => undefined }),
  })),
  getGenerationById: vi.fn(async () => state.generation),
  createGeneration: vi.fn(async (row: any) => {
    state.created.push(row);
    return 100 + state.created.length;
  }),
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
  generateImage: vi.fn(async () => {
    state.genCalls++;
    return { url: "https://dreamforgex.ai/img/generations/new.png" };
  }),
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
  storagePut: vi.fn(async () => ({ url: "https://dreamforgex.ai/img/generations/char.png" })),
  generateStorageKey: vi.fn(() => "generations/char.png"),
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

function withActivePass() {
  state.user = { uncensoredUntil: new Date(Date.now() + 864e5), ageConfirmedAt: new Date() };
}

function ownUncensoredImage(overrides?: Record<string, unknown>) {
  return {
    id: 42,
    userId: OWNER,
    mediaType: "image",
    status: "completed",
    imageUrl: "https://dreamforgex.ai/img/generations/src.png",
    width: 832,
    height: 1216,
    metadata: { uncensored: true, style: "realistic" },
    ...overrides,
  };
}

describe("uncensored.generate — paid studio", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.debited = 0;
    state.refunded = 0;
    state.genCalls = 0;
    state.refineCalls = 0;
    state.created = [];
    vi.clearAllMocks();
  });

  it("requires an active pass", async () => {
    state.user = { uncensoredUntil: null, ageConfirmedAt: new Date() };
    await expect(
      uncensoredRouter.createCaller(ctx()).generate({ prompt: "a cinematic portrait of a woman" }),
    ).rejects.toThrow(/pass/i);
    expect(state.genCalls).toBe(0);
    expect(state.debited).toBe(0);
  });

  it("generates a portrait-default image and charges the fast rate", async () => {
    withActivePass();
    const res = await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "a cinematic portrait of a woman in neon rain",
    });
    expect(res.images).toHaveLength(1);
    expect(res.cost).toBe(5);
    expect(state.genCalls).toBe(1);
    expect(state.debited).toBe(5);
    expect(state.created[0].width).toBe(832);
    expect(state.created[0].height).toBe(1216);
    expect(state.created[0].metadata.uncensored).toBe(true);
  });

  it("quality tier charges 12 credits", async () => {
    withActivePass();
    const res = await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "a cinematic portrait of a woman in neon rain",
      quality: "quality",
    });
    expect(res.cost).toBe(12);
    expect(state.debited).toBe(12);
  });

  it("variations multiply the cost", async () => {
    withActivePass();
    const res = await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "a cinematic portrait of a woman in neon rain",
      count: 4,
    });
    expect(res.images).toHaveLength(4);
    expect(res.cost).toBe(20);
    expect(state.debited).toBe(20);
  });
});

describe("uncensored.generate — character lock ownership", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.debited = 0;
    state.refunded = 0;
    state.genCalls = 0;
    state.refineCalls = 0;
    state.created = [];
    vi.clearAllMocks();
  });

  it("locks to the caller's own uncensored image via img2img", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    const res = await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "same woman, red silk dress, balcony at night",
      characterGenerationId: 42,
    });
    expect(res.images).toHaveLength(1);
    expect(state.refineCalls).toBe(1);
    expect(state.genCalls).toBe(0);
    expect(state.debited).toBe(10);
  });

  it("REJECTS locking someone else's image, spending nothing", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    await expect(
      uncensoredRouter.createCaller(ctx()).generate({
        prompt: "same woman, red silk dress",
        characterGenerationId: 42,
      }),
    ).rejects.toThrow(/isn't available/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });

  it("REJECTS a SFW generation as a character lock", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ metadata: {} });
    await expect(
      uncensoredRouter.createCaller(ctx()).generate({
        prompt: "same woman, red silk dress",
        characterGenerationId: 42,
      }),
    ).rejects.toThrow(/uncensored/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });
});
