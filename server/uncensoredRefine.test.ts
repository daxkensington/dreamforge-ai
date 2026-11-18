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
  newRow: any;
  completionError: boolean;
  claimed: boolean;
  receipt: boolean;
} = { user: null, generation: null, debited: 0, refunded: 0, refineCalls: 0, newRow: null, completionError: false, claimed: true, receipt: false };

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (state.user ? [state.user] : []) }) }) }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => {
      if (state.completionError) throw new Error("completion acknowledgement lost");
      return state.claimed ? [{ id: 999 }] : [];
    } }) }) }),
    insert: () => ({ values: async () => undefined }),
  })),
  getGenerationById: vi.fn(async (id: number) => id === 999 ? state.newRow : state.generation),
  createGeneration: vi.fn(async () => 999),
  updateGeneration: vi.fn(async () => undefined),
}));

vi.mock("./stripe", () => ({
  deductCredits: vi.fn(async (_u: number, amount: number) => {
    state.debited += amount;
    return { success: true, balance: 500, needed: amount, transactionId: 123, purchasedCreditsDebited: 3 };
  }),
  refundCredits: vi.fn(async (_u: number, amount: number) => {
    state.refunded += amount;
  }),
}));

vi.mock("./_core/walletAccounting", () => ({
  failLegacyJobAndRefund: vi.fn(async (input: { amount: number }) => { state.refunded += input.amount; return true; }),
  hasWalletRefundReceipt: vi.fn(async () => state.receipt),
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
import { createGeneration, getGenerationById } from "./db";
import { refineUnfiltered } from "./_core/imageGeneration";
import { failLegacyJobAndRefund } from "./_core/walletAccounting";

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
    state.newRow = null; state.completionError = false; state.claimed = true; state.receipt = false;
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

  it("atomically claims a known provider failure with exact purchased provenance", async () => {
    withActivePass(); state.generation = ownUncensoredImage();
    vi.mocked(refineUnfiltered).mockRejectedValueOnce(new Error("provider failed"));
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/credits were returned/i);
    expect(failLegacyJobAndRefund).toHaveBeenCalledWith(expect.objectContaining({ id: 999, userId: OWNER, amount: 10, purchasedCredits: 3 }));
    expect(state.refunded).toBe(10);
    expect(createGeneration).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ cost: 10, purchasedCreditsDebited: 3, walletDebitTransactionId: 123 }) }));
  });

  it("does not blindly refund an insert with an unknown acknowledgement", async () => {
    withActivePass(); state.generation = ownUncensoredImage();
    vi.mocked(createGeneration).mockRejectedValueOnce(new Error("insert acknowledgement lost"));
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/contact support/i);
    expect(failLegacyJobAndRefund).not.toHaveBeenCalled();
    expect(state.refunded).toBe(0);
    expect(state.refineCalls).toBe(0);
  });

  it("returns a confirmed completed image after a lost completion acknowledgement", async () => {
    withActivePass(); state.generation = ownUncensoredImage();
    state.completionError = true;
    state.newRow = ownUncensoredImage({ id: 999, imageUrl: "https://dreamforgex.ai/img/generations/new.png" });
    const result = await uncensoredRouter.createCaller(ctx()).refineImage(input);
    expect(result).toMatchObject({ generationId: 999, url: state.newRow.imageUrl });
    expect(getGenerationById).toHaveBeenCalledWith(999);
    expect(state.refunded).toBe(0);
  });

  it("does not overwrite a recovery-refunded failed row", async () => {
    withActivePass(); state.generation = ownUncensoredImage();
    state.claimed = false; state.receipt = true;
    state.newRow = ownUncensoredImage({ id: 999, status: "failed", imageUrl: null });
    await expect(uncensoredRouter.createCaller(ctx()).refineImage(input)).rejects.toThrow(/credits were returned/i);
    expect(failLegacyJobAndRefund).not.toHaveBeenCalled();
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

describe("blendMasked — inpaint mask compositing", () => {
  it("preserves unpainted black-mask pixels from source and blends white-mask pixels from painted", async () => {
    const sharp = (await import("sharp")).default;
    const { blendMasked } = await import("./routers/uncensored");

    const width = 20;
    const height = 20;
    const src = await sharp({
      create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const painted = await sharp({
      create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .png()
      .toBuffer();

    // Opaque black RGBA canvas with a white painted square in the center (8..12, 8..12)
    const maskRaw = Buffer.alloc(width * height * 4, 0);
    for (let i = 0; i < width * height; i++) {
      maskRaw[i * 4 + 3] = 255;
    }
    for (let y = 8; y <= 12; y++) {
      for (let x = 8; x <= 12; x++) {
        const idx = (y * width + x) * 4;
        maskRaw[idx] = 255;
        maskRaw[idx + 1] = 255;
        maskRaw[idx + 2] = 255;
      }
    }
    const mask = await sharp(maskRaw, { raw: { width, height, channels: 4 } }).png().toBuffer();

    const resultPng = await blendMasked(src, painted, mask);
    const { data, info } = await sharp(resultPng).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    // Unpainted top-left corner (0,0) must stay pure red (255, 0, 0)
    expect([data[0], data[1], data[2]]).toEqual([255, 0, 0]);

    // Painted center (10,10) must be pure blue (0, 0, 255)
    const centerIdx = (10 * info.width + 10) * info.channels;
    expect([data[centerIdx], data[centerIdx + 1], data[centerIdx + 2]]).toEqual([0, 0, 255]);
  });
});

