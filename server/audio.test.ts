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
vi.mock("./_core/walletAccounting", () => ({ hasWalletRefundReceipt: vi.fn().mockResolvedValue(false), failLegacyJobAndRefund: vi.fn(async (input:any)=>{
  await refundCredits(input.userId,input.amount,input.reason,{purchasedCredits:input.purchasedCredits}); return true;
}) }));
vi.mock("./stripe", async () => {
  const actual = await vi.importActual<any>("./stripe");
  return {
    ...actual,
    deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 100, needed: 2, transactionId: 123, purchasedCreditsDebited: 0 }),
    refundCredits: vi.fn().mockResolvedValue({ success: true, refunded: 2 }),
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
import { getDb } from "./db";

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
    expect(refundCredits).toHaveBeenCalledWith(9, 2, expect.stringContaining("Refund"), expect.any(Object));
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
    expect(refundCredits).toHaveBeenCalledWith(9, 2, expect.stringContaining("Refund"), { purchasedCredits: 0, operationKey: "usage-refund:123" });
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

  it("does not debit when the audio is missing or not owned", async () => {
    const db = await getDb();
    (db as any).where.mockResolvedValueOnce([]);
    const caller = audioRouter.createCaller(authCtx);
    await expect(caller.mergeAudioVideo({ audioId: 7, videoUrl: "https://cdn.example.com/clip.mp4" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deductCredits).not.toHaveBeenCalled();
    expect(syncAudioToVideo).not.toHaveBeenCalled();
  });

  it("does not debit when the audio is not complete", async () => {
    const db = await getDb();
    (db as any).where.mockResolvedValueOnce([{ id: 7, status: "generating", audioUrl: null }]);
    const caller = audioRouter.createCaller(authCtx);
    await expect(caller.mergeAudioVideo({ audioId: 7, videoUrl: "https://cdn.example.com/clip.mp4" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("rejects private video URLs before debit or provider invocation", async () => {
    const caller = audioRouter.createCaller(authCtx);
    await expect(caller.mergeAudioVideo({ audioId: 7, videoUrl: "http://127.0.0.1/clip.mp4" })).rejects.toThrow();
    expect(deductCredits).not.toHaveBeenCalled();
    expect(syncAudioToVideo).not.toHaveBeenCalled();
  });

  it("does not claim a refund succeeded when it cannot be verified", async () => {
    vi.mocked(syncAudioToVideo).mockRejectedValueOnce(new Error("merge failed"));
    vi.mocked(refundCredits).mockRejectedValueOnce(new Error("database unavailable"));
    const caller = audioRouter.createCaller(authCtx);
    await expect(caller.mergeAudioVideo({ audioId: 7, videoUrl: "https://cdn.example.com/clip.mp4" })).rejects.toThrow("contact support");
  });

  it("refunds a response with no merged video", async () => {
    vi.mocked(syncAudioToVideo).mockResolvedValueOnce("");
    const caller = audioRouter.createCaller(authCtx);
    await expect(caller.mergeAudioVideo({ audioId: 7, videoUrl: "https://cdn.example.com/clip.mp4" })).rejects.toThrow("Merge failed");
    expect(refundCredits).toHaveBeenCalledWith(9, 2, expect.any(String), { purchasedCredits: 0, operationKey: "usage-refund:123" });
  });
});

describe("audio.lipSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refunds the lip-sync charge when the provider fails", async () => {
    vi.mocked(refundCredits).mockResolvedValueOnce({ success: true, refunded: 50 });
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
      expect(refundCredits).toHaveBeenCalledWith(9, 50, expect.stringContaining("Refund"), { purchasedCredits: 0, operationKey: "usage-refund:123" });
    } finally {
      SyncLabsProvider.prototype.generate = original;
    }
  });

  it("does not debit when the provider is unavailable", async () => {
    const { SyncLabsProvider } = await import("./_core/providers/synclabs");
    const available = vi.spyOn(SyncLabsProvider.prototype, "isAvailable", "get").mockReturnValue(false);
    try {
      await expect(audioRouter.createCaller(authCtx).lipSync({ videoUrl: "https://cdn.example.com/clip.mp4", audioUrl: "https://cdn.example.com/audio.wav" })).rejects.toThrow("not configured");
      expect(deductCredits).not.toHaveBeenCalled();
      expect(refundCredits).not.toHaveBeenCalled();
    } finally { available.mockRestore(); }
  });

  it("rejects private URL forms before debit", async () => {
    await expect(audioRouter.createCaller(authCtx).lipSync({ videoUrl: "https://127.0.0.1/clip.mp4", audioUrl: "https://cdn.example.com/audio.wav" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("directs the user to support if a failed refund cannot be verified", async () => {
    const { SyncLabsProvider } = await import("./_core/providers/synclabs");
    const generate = vi.spyOn(SyncLabsProvider.prototype, "generate").mockRejectedValueOnce(new Error("sync failed"));
    vi.mocked(refundCredits).mockRejectedValueOnce(new Error("database unavailable"));
    try {
      await expect(audioRouter.createCaller(authCtx).lipSync({ videoUrl: "https://cdn.example.com/clip.mp4", audioUrl: "https://cdn.example.com/audio.wav" })).rejects.toThrow("contact support");
      expect(refundCredits).toHaveBeenCalledWith(9, 50, expect.any(String), { purchasedCredits: 0, operationKey: "usage-refund:123" });
    } finally { generate.mockRestore(); }
  });

  it("refunds when the provider returns no output URL", async () => {
    const { SyncLabsProvider } = await import("./_core/providers/synclabs");
    const generate = vi.spyOn(SyncLabsProvider.prototype, "generate").mockResolvedValueOnce({ url: "" } as any);
    vi.mocked(refundCredits).mockResolvedValueOnce({ success: true, refunded: 50 });
    try {
      await expect(audioRouter.createCaller(authCtx).lipSync({ videoUrl: "https://cdn.example.com/clip.mp4", audioUrl: "https://cdn.example.com/audio.wav" })).rejects.toThrow("no video");
      expect(refundCredits).toHaveBeenCalledTimes(1);
    } finally { generate.mockRestore(); }
  });
});
