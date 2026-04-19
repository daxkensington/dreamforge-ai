import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/viral.png" }),
}));
vi.mock("./_core/toolStatus", () => ({
  requireToolActive: vi.fn().mockResolvedValue(undefined),
  getAllToolStatus: vi.fn().mockResolvedValue([]),
  getFailureStats: vi.fn().mockResolvedValue({}),
  setToolStatus: vi.fn().mockResolvedValue(undefined),
  clearToolStatus: vi.fn().mockResolvedValue(undefined),
  logToolFailure: vi.fn().mockResolvedValue(undefined),
  runAutoDegradeScan: vi.fn().mockResolvedValue({ flipped: 0 }),
}));
vi.mock("./stripe", async () => {
  const actual = await vi.importActual<any>("./stripe");
  return {
    ...actual,
    deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 90, needed: 10 }),
  };
});

import { viralRouter } from "./routers/viral";
import { deductCredits } from "./stripe";
import { requireToolActive } from "./_core/toolStatus";

const authCtx = { user: { id: 42, email: "u@test" } as any, session: null, ip: "1.2.3.4" };

describe("viral.transform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deducts credits via the preset's own key before generating", async () => {
    const caller = viralRouter.createCaller(authCtx);
    const res = await caller.transform({
      preset: "action-figure",
      imageUrl: "https://cdn.example.com/face.jpg",
    });
    expect(res.status).toBe("completed");
    expect(res.url).toContain("cdn.example.com");
    expect(deductCredits).toHaveBeenCalledWith(
      42,
      expect.any(Number),
      expect.stringContaining("Action Figure"),
    );
    expect(requireToolActive).toHaveBeenCalledWith("action-figure");
  });

  it("fails loudly when credits insufficient (no refund loophole)", async () => {
    (deductCredits as any).mockResolvedValueOnce({ success: false, balance: 2, needed: 10 });
    const caller = viralRouter.createCaller(authCtx);
    await expect(
      caller.transform({
        preset: "funko-pop",
        imageUrl: "https://cdn.example.com/face.jpg",
      }),
    ).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });

  it("honors kill-switch — doesn't deduct when tool is offline", async () => {
    (requireToolActive as any).mockRejectedValueOnce(new Error("Tool offline"));
    const caller = viralRouter.createCaller(authCtx);
    await expect(
      caller.transform({
        preset: "chibi-figure",
        imageUrl: "https://cdn.example.com/face.jpg",
      }),
    ).rejects.toThrow();
    expect(deductCredits).not.toHaveBeenCalled();
  });

  it("passes the preset-specific prompt template to generateImage", async () => {
    const { generateImage } = await import("./_core/imageGeneration");
    const caller = viralRouter.createCaller(authCtx);
    await caller.transform({
      preset: "pet-to-person",
      imageUrl: "https://cdn.example.com/pet.jpg",
      note: "grumpy orange cat energy",
    });
    const call = (generateImage as any).mock.calls.at(-1)[0];
    expect(call.prompt).toMatch(/human/i);
    expect(call.prompt).toContain("grumpy orange cat energy");
    expect(call.originalImages?.[0]?.url).toBe("https://cdn.example.com/pet.jpg");
  });
});
