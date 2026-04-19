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

vi.mock("./stripe", async () => {
  const actual = await vi.importActual<any>("./stripe");
  return {
    ...actual,
    deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 500, needed: 31 }),
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
import { deductCredits } from "./stripe";
import { requireToolActive } from "./_core/toolStatus";

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
});
