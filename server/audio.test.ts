import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the audio generation backend
vi.mock("./_core/audioGeneration", () => ({
  generateAudio: vi
    .fn()
    .mockResolvedValue({
      audioUrl: "https://cdn.example.com/audio.wav",
      model: "audiogen",
      duration: 3,
      metadata: {},
    }),
  syncAudioToVideo: vi.fn().mockResolvedValue("https://cdn.example.com/merged.mp4"),
}));

// Mock the Sync Labs provider (lip sync)
vi.mock("./_core/providers/synclabs", () => ({
  SyncLabsProvider: class {
    get isAvailable() {
      return true;
    }
    async generate() {
      return { url: "https://cdn.example.com/lipsync.mp4" };
    }
  },
}));

// Mock the tool kill-switch
vi.mock("./_core/toolStatus", () => ({
  requireToolActive: vi.fn().mockResolvedValue(undefined),
  getAllToolStatus: vi.fn().mockResolvedValue([]),
  getFailureStats: vi.fn().mockResolvedValue([]),
  logToolFailure: vi.fn().mockResolvedValue(undefined),
  setToolStatus: vi.fn().mockResolvedValue(undefined),
  clearToolStatus: vi.fn().mockResolvedValue(undefined),
  runAutoDegradeScan: vi.fn().mockResolvedValue({ flipped: [] }),
}));

// Mock the credit ledger
vi.mock("./stripe", async () => {
  const actual = await vi.importActual<any>("./stripe");
  return {
    ...actual,
    deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 100, needed: 2 }),
    refundCredits: vi.fn().mockResolvedValue(undefined),
  };
});

// DB mock covers the audio-generation insert + background status updates,
// plus the ownership select in mergeAudioVideo.
vi.mock("./db", () => {
  const chain: any = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 55 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: 7, status: "complete", audioUrl: "https://cdn.example.com/audio.wav" }]),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rows: [{ current_hits: 0, allowed: true }] }),
  };
  return {
    getDb: vi.fn().mockResolvedValue(chain),
  };
});

import { audioRouter } from "./routers/audio";
import { deductCredits, refundCredits } from "./stripe";
import { generateAudio, syncAudioToVideo } from "./_core/audioGeneration";

const authCtx = { user: { id: 9, email: "audio@test" } as any, session: null, ip: "1.2.3.4" };

describe("audio.generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deducts the audio cost and starts a background job", async () => {
    const caller = audioRouter.createCaller(authCtx);
    const res = await caller.generate({
      type: "sfx",
      prompt: "a creaky door slamming shut",
      duration: 3,
    });
    expect(res).toEqual({ id: 55, status: "generating" });
    // CREDIT_COSTS["audio-sfx"] = 2 (registered by the router at module load)
    expect(deductCredits).toHaveBeenCalledWith(9, 2, expect.stringContaining("Audio sfx"));
    // Success path — no refund.
    await vi.waitFor(() => expect(generateAudio).toHaveBeenCalledTimes(1));
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("refunds the exact charge once when the background job fails", async () => {
    vi.mocked(generateAudio).mockRejectedValueOnce(new Error("provider down"));
    const caller = audioRouter.createCaller(authCtx);
    const res = await caller.generate({
      type: "sfx",
      prompt: "a creaky door slamming shut",
      duration: 3,
    });
    expect(res.status).toBe("generating");
    await vi.waitFor(() => expect(refundCredits).toHaveBeenCalledTimes(1));
    expect(refundCredits).toHaveBeenCalledWith(9, 2, expect.stringContaining("Refund"));
  });

  it("does not deduct when the request is invalid", async () => {
    const caller = audioRouter.createCaller(authCtx);
    await expect(
      caller.generate({ type: "sfx", prompt: "", duration: 3 }),
    ).rejects.toThrow();
    expect(deductCredits).not.toHaveBeenCalled();
    expect(refundCredits).not.toHaveBeenCalled();
  });
});

describe("audio.mergeAudioVideo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refunds the merge charge when the merge fails", async () => {
    vi.mocked(syncAudioToVideo).mockRejectedValueOnce(new Error("ffmpeg exploded"));
    const caller = audioRouter.createCaller(authCtx);
    await expect(
      caller.mergeAudioVideo({ audioId: 7, videoUrl: "https://cdn.example.com/clip.mp4" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    // "audio-merge" = 2 credits — refund exactly that, exactly once.
    expect(deductCredits).toHaveBeenCalledWith(9, 2, expect.stringContaining("Merge"));
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(refundCredits).toHaveBeenCalledWith(9, 2, expect.stringContaining("Refund"));
  });

  it("does not refund when the merge succeeds", async () => {
    const caller = audioRouter.createCaller(authCtx);
    const res = await caller.mergeAudioVideo({
      audioId: 7,
      videoUrl: "https://cdn.example.com/clip.mp4",
    });
    expect(res.status).toBe("complete");
    expect(refundCredits).not.toHaveBeenCalled();
  });
});

describe("audio.lipSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refunds the lip-sync charge when the provider fails", async () => {
    const { SyncLabsProvider } = await import("./_core/providers/synclabs");
    const original = SyncLabsProvider.prototype.generate;
    SyncLabsProvider.prototype.generate = vi.fn().mockRejectedValueOnce(new Error("sync failed")) as any;
    try {
      const caller = audioRouter.createCaller(authCtx);
      await expect(
        caller.lipSync({
          videoUrl: "https://cdn.example.com/clip.mp4",
          audioUrl: "https://cdn.example.com/audio.wav",
        }),
      ).rejects.toThrow("sync failed");
      // "video-lipsync" = 50 credits.
      expect(deductCredits).toHaveBeenCalledWith(9, 50, expect.stringContaining("Lip sync"));
      expect(refundCredits).toHaveBeenCalledTimes(1);
      expect(refundCredits).toHaveBeenCalledWith(9, 50, expect.stringContaining("Refund"));
    } finally {
      SyncLabsProvider.prototype.generate = original;
    }
  });
});
