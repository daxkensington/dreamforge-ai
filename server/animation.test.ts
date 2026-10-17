import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  status: vi.fn(),
  imported: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("./_core/imageAnimation", () => ({
  imageAnimationService: { start: mocks.start, status: mocks.status },
  registerUploadedAnimationSource: mocks.imported,
}));
vi.mock("./rate-limit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("./_core/env", () => ({ ENV: { falApiKey: "mock-only-not-live" } }));
vi.mock("./_core/privateStorage", () => ({
  privateStorageAvailable: vi.fn(async () => true),
}));
import { animationRouter } from "./routers/animation";
import { privateStorageAvailable } from "./_core/privateStorage";
const requestId = "11111111-1111-4111-8111-111111111111";
const input = {
  requestId,
  generationId: 41,
  prompt: "Slow camera movement",
  expectedCreditCost: 1293,
};
const caller = (user: unknown = { id: 7, role: "user" }) =>
  animationRouter.createCaller({
    user,
    session: null,
    ip: "127.0.0.1",
  } as never);
describe("owned animation API contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(privateStorageAvailable).mockResolvedValue(true);
    mocks.rate.mockResolvedValue(undefined);
    mocks.start.mockResolvedValue({
      status: "generating",
      requestId,
      mediaType: "video",
    });
    mocks.status.mockResolvedValue({
      status: "generating",
      requestId,
      mediaType: "video",
    });
    mocks.imported.mockResolvedValue({
      generationId: 41,
      imageUrl: "/api/media/uploaded.png",
    });
  });
  it("publishes the exact pinned model, duration, resolution, configuration and quote without requiring a session", async () => {
    expect(await caller(null).policy()).toEqual({
      modelId: "fal-ai/wan-25-preview/image-to-video",
      name: "Wan 2.5 image animation",
      duration: 5,
      resolution: "480p",
      creditCost: 1293,
      requiredTier: "creator",
      isConfigured: true,
    });
  });
  it("marks the provider unavailable when private storage cannot be verified", async () => {
    vi.mocked(privateStorageAvailable).mockResolvedValue(false);
    expect(await caller(null).policy()).toMatchObject({
      creditCost: 1293,
      isConfigured: false,
    });
  });
  it("scopes start/status/import to the authenticated user, with bounded independent rate limits", async () => {
    await caller().start(input);
    await caller().status({ requestId });
    await caller().importSource({ key: "uploads/7/image.png" });
    expect(mocks.start).toHaveBeenCalledExactlyOnceWith(7, input);
    expect(mocks.status).toHaveBeenCalledExactlyOnceWith(7, requestId);
    expect(mocks.imported).toHaveBeenCalledExactlyOnceWith(
      7,
      "uploads/7/image.png"
    );
    expect(mocks.rate).toHaveBeenCalledWith(
      "animation:start:7",
      10,
      60_000,
      expect.any(String)
    );
    expect(mocks.rate).toHaveBeenCalledWith(
      "animation:status:7",
      30,
      60_000,
      expect.any(String)
    );
    expect(mocks.rate).toHaveBeenCalledWith(
      "animation:import:7",
      12,
      3_600_000,
      expect.any(String)
    );
  });
  it.each([
    { ...input, generationId: 1.5 },
    { ...input, generationId: 0 },
    { ...input, prompt: " " },
    { ...input, expectedCreditCost: 0 },
    { ...input, requestId: "not-a-uuid" },
  ])(
    "rejects malformed input before the service can debit or submit",
    async value => {
      await expect(caller().start(value)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(mocks.start).not.toHaveBeenCalled();
    }
  );
  it("requires an active account for both paid generation and free import", async () => {
    for (const user of [null, { id: 7, loginMethod: "deleted" }]) {
      await expect(caller(user).start(input)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(caller(user).status({ requestId })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(
        caller(user).importSource({ key: "uploads/7/image.png" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.imported).not.toHaveBeenCalled();
  });
});
