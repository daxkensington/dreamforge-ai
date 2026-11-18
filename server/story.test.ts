import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/scene.png" }),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: "The Lighthouse Keeper",
            synopsis: "A lighthouse keeper learns their tower speaks.",
            mood: "contemplative",
            musicMood: "gentle cinematic",
            scenes: [
              { sceneNumber: 1, narration: "Dawn breaks over the lighthouse.", visual: "A tall stone lighthouse at dawn.", mood: "still" },
              { sceneNumber: 2, narration: "A voice whispers from the stones.", visual: "Close-up of glowing lighthouse lens.", mood: "mysterious" },
              { sceneNumber: 3, narration: "Secrets spill into the night.", visual: "Night sky with the lighthouse beam cutting across.", mood: "revelatory" },
              { sceneNumber: 4, narration: "The keeper sets out at dawn.", visual: "Keeper silhouetted against sunrise sea.", mood: "resolute" },
            ],
          }),
        },
      },
    ],
  }),
}));

vi.mock("./_core/toolStatus", () => ({
  requireToolActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/audioGeneration", () => ({
  generateMusic: vi.fn().mockResolvedValue({ audioUrl: "https://cdn.example.com/music.wav", duration: 30, model: "mg", metadata: {} }),
}));

vi.mock("./dbExtended", () => ({
  getCharacter: vi.fn().mockResolvedValue(null),
}));

vi.mock("./_core/walletAccounting", () => ({
  hasWalletRefundReceipt: vi.fn().mockResolvedValue(false),
  failLegacyJobAndRefund: vi.fn(),
}));

vi.mock("./stripe", async () => {
  const actual = await vi.importActual<any>("./stripe");
  return {
    ...actual,
    deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 500, needed: 31, transactionId: 123, purchasedCreditsDebited: 0 }),
    refundCredits: vi.fn(async (_user: number, amount: number) => ({ success: true, refunded: amount })),
  };
});

// DB mock covers the audio-generation insert + updates.
// Note: vi.mock factories are hoisted — no outer variables allowed inside.
vi.mock("./db", () => {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 777 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    getDb: vi.fn().mockResolvedValue(chain),
    getGenerationById: vi.fn().mockResolvedValue(null),
  };
});

import { storyRouter } from "./routers/story";
import { deductCredits, refundCredits } from "./stripe";
import { requireToolActive } from "./_core/toolStatus";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { getDb } from "./db";

const authCtx = { user: { id: 7, email: "a@b" } as any, session: null, ip: "1.2.3.4" };

describe("story.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gates on kill-switch, deducts bundled credits, returns scenes with images", async () => {
    const caller = storyRouter.createCaller(authCtx);
    const res = await caller.create({
      idea: "A lighthouse keeper discovers their tower can speak.",
      sceneCount: 4,
      style: "cinematic",
      aspectRatio: "16:9",
      withMusic: true,
    });
    expect(requireToolActive).toHaveBeenCalledWith("storyboard");
    expect(deductCredits).toHaveBeenCalledWith(7, 31, expect.stringContaining("One-Click Story"));
    expect(res.status).toBe("completed");
    expect(res.scenes).toHaveLength(4);
    expect(res.scenes[0].imageUrl).toBe("https://cdn.example.com/scene.png");
    expect(res.title).toBe("The Lighthouse Keeper");
    expect(res.audioGenerationId).toBe(777);
  });

  it("skips music-gen row when withMusic=false", async () => {
    const caller = storyRouter.createCaller(authCtx);
    const res = await caller.create({
      idea: "A story without music.",
      sceneCount: 3,
      style: "noir",
      aspectRatio: "16:9",
      withMusic: false,
    });
    expect(res.audioGenerationId).toBeNull();
    // Cost breakdown: 5 (storyboard) + 3*5 (images) + 0 (no music) = 20
    expect(deductCredits).toHaveBeenCalledWith(7, 20, expect.any(String));
  });

  it("throws PAYMENT_REQUIRED when credits insufficient", async () => {
    (deductCredits as any).mockResolvedValueOnce({ success: false, balance: 5, needed: 31 });
    const caller = storyRouter.createCaller(authCtx);
    await expect(
      caller.create({
        idea: "A story needing credits.",
        sceneCount: 4,
        style: "cinematic",
        aspectRatio: "16:9",
        withMusic: true,
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });

  it("refunds the whole bundle when the storyboard LLM step fails", async () => {
    vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM provider down"));
    const caller = storyRouter.createCaller(authCtx);
    await expect(
      caller.create({
        idea: "A story that will never be written.",
        sceneCount: 4,
        style: "cinematic",
        aspectRatio: "16:9",
        withMusic: true,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    // 5 (storyboard) + 4*5 (images) + 6 (music) = 31 — the user received nothing.
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits).toHaveBeenCalledWith(7, 31, expect.stringContaining("Refund"), expect.any(Object));
  });

  it("refunds the per-scene image cost for scenes that fail to render", async () => {
    vi.mocked(generateImage).mockRejectedValueOnce(new Error("scene render failed"));
    const caller = storyRouter.createCaller(authCtx);
    const res = await caller.create({
      idea: "A story with one broken scene.",
      sceneCount: 4,
      style: "noir",
      aspectRatio: "16:9",
      withMusic: false,
    });
    expect(res.status).toBe("completed");
    expect(res.scenes).toHaveLength(4);
    expect(res.scenes.filter((s: any) => s.imageUrl === null)).toHaveLength(1);
    // Exactly one of the four 5-credit scene images failed → refund 5, once.
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits).toHaveBeenCalledWith(7, 5, expect.stringContaining("Refund"), expect.any(Object));
  });

  it("preserves partial scenes and warns if their refund cannot be verified", async () => {
    vi.mocked(generateImage).mockRejectedValueOnce(new Error("scene render failed"));
    vi.mocked(refundCredits).mockRejectedValueOnce(new Error("refund unavailable"));
    const res = await storyRouter.createCaller(authCtx).create({ idea: "A story with a broken scene.", sceneCount: 4, style: "noir", aspectRatio: "16:9", withMusic: false });
    expect(res.scenes).toHaveLength(4);
    expect(res.billingWarning).toMatch(/contact support/i);
  });

  it("signals support rather than an unverified full refund", async () => {
    vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM down"));
    vi.mocked(refundCredits).mockRejectedValueOnce(new Error("refund unavailable"));
    await expect(storyRouter.createCaller(authCtx).create({ idea: "A story with no storyboard.", sceneCount: 4, style: "noir", aspectRatio: "16:9", withMusic: false })).rejects.toThrow(/contact support/i);
  });

  it("rejects malformed storyboard scenes and refunds before image work", async () => {
    vi.mocked(invokeLLM).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ scenes: "not an array" }) } }] } as any);
    await expect(storyRouter.createCaller(authCtx).create({ idea: "A malformed storyboard test.", sceneCount: 4, style: "noir", aspectRatio: "16:9", withMusic: false })).rejects.toThrow("Storyboard generation failed");
    expect(generateImage).not.toHaveBeenCalled();
    expect(refundCredits).toHaveBeenCalledWith(7, 25, expect.any(String), expect.objectContaining({ operationKey: expect.stringContaining("story-refund:123:25:") }));
  });

  it("does not refund ambiguously acknowledged music insertion", async () => {
    const db = await getDb();
    vi.mocked(db!.insert).mockImplementationOnce(() => { throw new Error("lost insert acknowledgement"); });
    const res = await storyRouter.createCaller(authCtx).create({ idea: "A story with an uncertain soundtrack.", sceneCount: 4, style: "noir", aspectRatio: "16:9", withMusic: true });
    expect(res.scenes).toHaveLength(4);
    expect(res.billingWarning).toMatch(/contact support/i);
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("does not refund when every scene renders", async () => {
    const caller = storyRouter.createCaller(authCtx);
    const res = await caller.create({
      idea: "A story where everything works.",
      sceneCount: 3,
      style: "anime",
      aspectRatio: "16:9",
      withMusic: false,
    });
    expect(res.status).toBe("completed");
    expect(res.scenes.every((s: any) => s.imageUrl !== null)).toBe(true);
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("limits provider work to the number of scenes the user paid for", async () => {
    const res = await storyRouter.createCaller(authCtx).create({ idea: "A short three scene story.", sceneCount: 3, style: "anime", aspectRatio: "16:9", withMusic: false });
    expect(res.scenes).toHaveLength(3);
    expect(generateImage).toHaveBeenCalledTimes(3);
  });

  it("refunds music setup failure without discarding the completed story", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    const res = await storyRouter.createCaller(authCtx).create({ idea: "A story whose soundtrack cannot start.", sceneCount: 4, style: "noir", aspectRatio: "16:9", withMusic: true });
    expect(res.scenes).toHaveLength(4);
    expect(res.audioGenerationId).toBeNull();
    expect(refundCredits).toHaveBeenCalledWith(7, 6, expect.stringContaining("music could not be started"), expect.objectContaining({ operationKey: expect.stringContaining("story-refund:123:6:") }));
  });

  it("retains the completed story and warns if a music refund is unverified", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    vi.mocked(refundCredits).mockRejectedValueOnce(new Error("refund unavailable"));
    const res = await storyRouter.createCaller(authCtx).create({ idea: "A story whose soundtrack cannot start.", sceneCount: 4, style: "noir", aspectRatio: "16:9", withMusic: true });
    expect(res.scenes).toHaveLength(4);
    expect(res.billingWarning).toMatch(/contact support/i);
  });
});
