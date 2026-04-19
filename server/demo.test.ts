import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/demo.png" }),
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
vi.mock("./rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  enforceIpRateLimit: vi.fn().mockResolvedValue(undefined),
  enforceUserRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { demoRouter } from "./routers/demo";
import { enforceIpRateLimit } from "./rate-limit";

describe("demo.generate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates one image per IP per 24h using the IP rate limiter", async () => {
    const caller = demoRouter.createCaller({ user: null, session: null, ip: "1.2.3.4" });
    const res = await caller.generate({ prompt: "a cat on a spaceship" });
    expect(res.status).toBe("completed");
    expect(res.url).toContain("cdn.example.com");
    expect(enforceIpRateLimit).toHaveBeenCalledWith(
      "demo.generate",
      "1.2.3.4",
      1,
      24 * 60 * 60 * 1000,
      expect.any(String),
    );
  });

  it("denies demo generation when IP cannot be determined (abuse gate)", async () => {
    const caller = demoRouter.createCaller({ user: null, session: null, ip: null });
    await expect(caller.generate({ prompt: "anything" })).rejects.toThrow(/sign up/i);
    expect(enforceIpRateLimit).not.toHaveBeenCalled();
  });

  it("propagates rate-limit denial when quota already used", async () => {
    (enforceIpRateLimit as any).mockRejectedValueOnce(new Error("rate limited"));
    const caller = demoRouter.createCaller({ user: null, session: null, ip: "1.2.3.4" });
    await expect(caller.generate({ prompt: "x" })).rejects.toThrow();
  });
});
