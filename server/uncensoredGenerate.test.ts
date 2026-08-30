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
  characters: any[];
  debited: number;
  refunded: number;
  genCalls: number;
  refineCalls: number;
  created: any[];
} = { user: null, generation: null, characters: [], debited: 0, refunded: 0, genCalls: 0, refineCalls: 0, created: [] };

function rowsFor(table: any) {
  if (table && "styleNotes" in table && "referenceImages" in table) return state.characters;
  if (table && ("uncensoredUntil" in table || "ageConfirmedAt" in table)) return state.user ? [state.user] : [];
  return [];
}

function query(rows: any[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: async () => rows,
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return q;
}

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: (table: any) => query(rowsFor(table)),
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
    insert: (table: any) => ({
      values: (v: any) => {
        if (table && "styleNotes" in table) {
          const row = { id: state.characters.length + 1, createdAt: new Date(), ...v };
          state.characters.push(row);
          return { returning: async () => [{ id: row.id }] };
        }
        return { returning: async () => [{ id: 1 }] };
      },
    }),
    delete: () => ({
      where: async () => {
        state.characters = [];
      },
    }),
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

vi.mock("./_core/runpod", () => ({
  isRunPodAvailable: vi.fn(() => true),
  runpodUpscale: vi.fn(async () => Buffer.from("upscaled-png")),
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
import { uncensoredCharacterRef } from "../shared/uncensoredStudio";
import { submitUncensoredVideoJob } from "./_core/videoGenerationUncensored";
import { refineUnfiltered } from "./_core/imageGeneration";
import { updateGeneration } from "./db";

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
    state.characters = [];
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
    expect(typeof res.images[0].seed).toBe("number");
  });

  it("stores the selected pose on the generation", async () => {
    withActivePass();
    await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "a cinematic portrait of a woman in neon rain",
      pose: "reclining",
    });
    expect(state.created[0].metadata.pose).toBe("reclining");
  });

  it("stores camera and lighting on the generation", async () => {
    withActivePass();
    await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "a cinematic portrait of a woman in neon rain",
      camera: "low",
      lighting: "neon",
    });
    expect(state.created[0].metadata.camera).toBe("low");
    expect(state.created[0].metadata.lighting).toBe("neon");
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
    state.characters = [];
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

  it("upscales the caller's own uncensored image", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })) as any,
    );
    const res = await uncensoredRouter.createCaller(ctx()).upscale({ sourceGenerationId: 42, scale: "2x" });
    expect(res.url).toContain("/img/generations/");
    expect(state.debited).toBe(8);
  });

  it("REJECTS upscaling someone else's image", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    await expect(
      uncensoredRouter.createCaller(ctx()).upscale({ sourceGenerationId: 42, scale: "2x" }),
    ).rejects.toThrow(/isn't available/i);
    expect(state.debited).toBe(0);
  });

  it("rejects an unpainted (all-black) inpaint mask", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    const sharp = (await import("sharp")).default;
    const black = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    await expect(
      uncensoredRouter.createCaller(ctx()).inpaint({
        sourceGenerationId: 42,
        prompt: "red silk dress in the painted region",
        maskDataUrl: `data:image/png;base64,${black.toString("base64")}`,
      }),
    ).rejects.toThrow(/paint/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });

  it("REJECTS inpaint on someone else's image before GPU", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    await expect(
      uncensoredRouter.createCaller(ctx()).inpaint({
        sourceGenerationId: 42,
        prompt: "red silk dress in the painted region",
        maskDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
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

  it("locks via a named character that points at the caller's own uncensored gen", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    state.characters = [
      {
        id: 9,
        userId: OWNER,
        name: "Luna",
        referenceImages: ["https://dreamforgex.ai/img/generations/src.png"],
        styleNotes: uncensoredCharacterRef(42),
      },
    ];
    const res = await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "same woman, red silk dress, balcony at night",
      savedCharacterId: 9,
    });
    expect(res.images).toHaveLength(1);
    expect(state.refineCalls).toBe(1);
    expect(state.debited).toBe(10);
    expect(state.created[0].metadata.savedCharacterId).toBe(9);
    expect(state.created[0].metadata.characterStrength).toBe(0.45);
  });

  it("honours character lock strength", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    await uncensoredRouter.createCaller(ctx()).generate({
      prompt: "same woman, red silk dress, balcony at night",
      characterGenerationId: 42,
      characterStrength: 0.3,
    });
    expect(vi.mocked(refineUnfiltered).mock.calls[0][2]).toMatchObject({ strength: 0.3 });
    expect(state.created[0].metadata.characterStrength).toBe(0.3);
  });

  it("REJECTS a named character that points at someone else's generation", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    state.characters = [
      {
        id: 9,
        userId: OWNER,
        name: "Stolen",
        styleNotes: uncensoredCharacterRef(42),
      },
    ];
    await expect(
      uncensoredRouter.createCaller(ctx()).generate({
        prompt: "same woman, red silk dress",
        savedCharacterId: 9,
      }),
    ).rejects.toThrow(/isn't available/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });
});

describe("uncensored.saveCharacter", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.characters = [];
    state.debited = 0;
    state.refunded = 0;
    state.genCalls = 0;
    state.refineCalls = 0;
    state.created = [];
    vi.clearAllMocks();
  });

  it("saves a named character from the caller's own uncensored image", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ prompt: "neon rain portrait" });
    const res = await uncensoredRouter.createCaller(ctx()).saveCharacter({
      name: "Luna",
      sourceGenerationId: 42,
    });
    expect(res.name).toBe("Luna");
    expect(res.generationId).toBe(42);
    expect(state.characters[0].styleNotes).toBe(uncensoredCharacterRef(42));
  });

  it("REJECTS saving someone else's image as a character", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    await expect(
      uncensoredRouter.createCaller(ctx()).saveCharacter({
        name: "Nope",
        sourceGenerationId: 42,
      }),
    ).rejects.toThrow(/isn't available/i);
    expect(state.characters).toHaveLength(0);
  });
});

describe("uncensored.generateVideo — duration", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.characters = [];
    state.debited = 0;
    state.refunded = 0;
    state.created = [];
    vi.clearAllMocks();
  });

  it("passes 8s frame count to Wan and charges 1.5×", async () => {
    withActivePass();
    vi.mocked(submitUncensoredVideoJob).mockResolvedValue({ jobId: "job_1" });
    const res = await uncensoredRouter.createCaller(ctx()).generateVideo({
      prompt: "slow turn toward camera, hair blowing in the wind",
      duration: "8s",
    });
    expect(res.status).toBe("processing");
    expect(state.debited).toBe(75);
    expect(submitUncensoredVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({ numFrames: 121, fps: 16 }),
    );
    expect(state.created[0].duration).toBe(8);
  });

  it("appends motion language to the Wan prompt", async () => {
    withActivePass();
    vi.mocked(submitUncensoredVideoJob).mockResolvedValue({ jobId: "job_2" });
    await uncensoredRouter.createCaller(ctx()).generateVideo({
      prompt: "natural motion",
      motion: "hair",
    });
    expect(submitUncensoredVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringMatching(/hair blowing/i) }),
    );
    expect(state.created[0].metadata.motion).toBe("hair");
  });

  it("passes a seed through to Wan", async () => {
    withActivePass();
    vi.mocked(submitUncensoredVideoJob).mockResolvedValue({ jobId: "job_3" });
    await uncensoredRouter.createCaller(ctx()).generateVideo({
      prompt: "slow turn toward camera",
      seed: 12345,
    });
    expect(submitUncensoredVideoJob).toHaveBeenCalledWith(expect.objectContaining({ seed: 12345 }));
    expect(state.created[0].metadata.seed).toBe(12345);
  });
});

describe("uncensored.deleteGeneration", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.characters = [];
    state.debited = 0;
    vi.clearAllMocks();
  });

  it("hides the caller's own uncensored generation", async () => {
    withActivePass();
    state.generation = ownUncensoredImage();
    const res = await uncensoredRouter.createCaller(ctx()).deleteGeneration({ id: 42 });
    expect(res.ok).toBe(true);
    expect(updateGeneration).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ metadata: expect.objectContaining({ deleted: true, uncensored: true }) }),
    );
  });

  it("REJECTS deleting someone else's generation", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    await expect(
      uncensoredRouter.createCaller(ctx()).deleteGeneration({ id: 42 }),
    ).rejects.toThrow(/isn't available/i);
    expect(updateGeneration).not.toHaveBeenCalled();
  });

  it("REJECTS locking a deleted generation as a character", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ metadata: { uncensored: true, deleted: true } });
    await expect(
      uncensoredRouter.createCaller(ctx()).generate({
        prompt: "same woman, red silk dress",
        characterGenerationId: 42,
      }),
    ).rejects.toThrow(/isn't available/i);
    expect(state.refineCalls).toBe(0);
    expect(state.debited).toBe(0);
  });
});

describe("uncensored.updateCharacter", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.characters = [];
    state.debited = 0;
    vi.clearAllMocks();
  });

  it("retargets the reference to a new own uncensored gen", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({
      id: 99,
      prompt: "better face, golden hour",
      imageUrl: "https://dreamforgex.ai/img/generations/better.png",
    });
    state.characters = [
      {
        id: 9,
        userId: OWNER,
        name: "Luna",
        referenceImages: ["https://dreamforgex.ai/img/generations/src.png"],
        styleNotes: uncensoredCharacterRef(42),
      },
    ];
    const res = await uncensoredRouter.createCaller(ctx()).updateCharacter({
      id: 9,
      sourceGenerationId: 99,
    });
    expect(res.generationId).toBe(99);
    expect(res.imageUrl).toContain("better.png");
  });

  it("REJECTS retargeting to someone else's image", async () => {
    withActivePass();
    state.generation = ownUncensoredImage({ userId: OWNER + 1 });
    state.characters = [
      {
        id: 9,
        userId: OWNER,
        name: "Luna",
        styleNotes: uncensoredCharacterRef(42),
      },
    ];
    await expect(
      uncensoredRouter.createCaller(ctx()).updateCharacter({
        id: 9,
        sourceGenerationId: 42,
      }),
    ).rejects.toThrow(/isn't available/i);
  });
});
