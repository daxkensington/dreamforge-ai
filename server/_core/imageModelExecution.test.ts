import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string>,
  runpodAvailable: false,
  runpodDev: vi.fn(),
  runpodSchnell: vi.fn(),
  runpodImg2Img: vi.fn(),
  predict: vi.fn(),
  download: vi.fn(),
  store: vi.fn(),
  watermark: vi.fn(),
  moderation: vi.fn(),
  logBlock: vi.fn(),
  vision: vi.fn(),
  guard: vi.fn(),
  guardedFetch: vi.fn(),
}));
vi.mock("./env", () => ({ ENV: mocks.env }));
vi.mock("./runpod", () => ({
  isRunPodAvailable: () => mocks.runpodAvailable,
  runpodFluxDev: mocks.runpodDev,
  runpodFluxSchnell: mocks.runpodSchnell,
  runpodFluxImg2Img: mocks.runpodImg2Img,
}));
vi.mock("./replicate", () => ({ replicatePredict: mocks.predict, downloadBuffer: mocks.download }));
vi.mock("../storage", () => ({ storagePut: mocks.store, generateStorageKey: () => "generations/test.png" }));
vi.mock("./watermark", () => ({ addImageWatermark: mocks.watermark }));
vi.mock("./llm", () => ({ invokeLLM: mocks.vision }));
vi.mock("./imageUrlGuard", () => ({ assertSafeImageUrl: mocks.guard, fetchGuardedImage: mocks.guardedFetch }));
vi.mock("./promptModeration", () => ({
  checkPrompt: mocks.moderation,
  logModerationBlock: mocks.logBlock,
  PromptBlockedError: class extends Error { constructor() { super("Blocked prompt"); } },
}));

import { generateImage, isAutomaticImageConfigured } from "./imageGeneration";
import { getModelById, listModels } from "./modelRegistry";

const fetchMock = vi.fn();
const bytes = Buffer.from("generated image bytes");
const b64 = bytes.toString("base64");
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  for (const key of Object.keys(mocks.env)) delete mocks.env[key];
  mocks.runpodAvailable = false;
  mocks.store.mockResolvedValue({ url: "https://cdn.example/output.png" });
  mocks.watermark.mockResolvedValue(Buffer.from("watermarked image bytes"));
  mocks.runpodDev.mockReset().mockResolvedValue(Buffer.from(bytes));
  mocks.runpodSchnell.mockReset().mockResolvedValue(Buffer.from(bytes));
  mocks.runpodImg2Img.mockReset().mockResolvedValue(Buffer.from(bytes));
  mocks.predict.mockReset().mockResolvedValue("https://upstream.example/output.png");
  mocks.download.mockReset().mockResolvedValue(Buffer.from(bytes));
  mocks.moderation.mockReturnValue({ allowed: true });
  mocks.logBlock.mockResolvedValue(undefined);
  mocks.vision.mockResolvedValue({ choices: [{ message: { content: "Source description" } }] });
  mocks.guardedFetch.mockResolvedValue({ buffer: Buffer.from(bytes) });
  vi.stubEnv("IMAGEN_ENABLED", "false");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("executable image registry", () => {
  it("does not advertise Auto from a Together-only configuration", () => {
    expect(isAutomaticImageConfigured()).toBe(false);
    mocks.env.togetherApiKey = "test-together";
    expect(getModelById("together-flux")?.isAvailable).toBe(true);
    expect(isAutomaticImageConfigured()).toBe(false);
    mocks.env.falApiKey = "test-fal";
    expect(isAutomaticImageConfigured()).toBe(true);
  });

  it("uses complete Cloudflare configuration and the opt-in Gemini flag for Auto", () => {
    mocks.env.cfAiToken = "test-cf";
    expect(isAutomaticImageConfigured()).toBe(false);
    mocks.env.cfAccountId = "test-account";
    expect(isAutomaticImageConfigured()).toBe(true);
    delete mocks.env.cfAiToken;
    delete mocks.env.cfAccountId;
    mocks.env.geminiApiKey = "test-gemini";
    expect(isAutomaticImageConfigured()).toBe(false);
    vi.stubEnv("IMAGEN_ENABLED", "true");
    expect(isAutomaticImageConfigured()).toBe(true);
  });

  it("advertises only existing standard creation executors, with unique keys and legacy aliases", () => {
    const executable = listModels().filter(model => model.imageExecution);
    expect(executable).toHaveLength(15);
    expect(new Set(executable.map(model => model.imageExecution!.key)).size).toBe(15);
    expect(executable.every(model => model.type === "image" && model.capabilities.includes("text-to-image"))).toBe(true);
    for (const id of ["fal-flux-kontext", "runpod-esrgan", "runpod-rmbg", "veo-3", "openai-tts"]) {
      expect(getModelById(id)?.imageExecution).toBeUndefined();
    }
    expect(getModelById("grok-image")?.imageExecution).toEqual({ key: "grok", aliases: ["grok"] });
    expect(getModelById("gemini-image")?.imageExecution).toEqual({ key: "gemini", aliases: ["gemini"] });
    expect(getModelById("together-flux")?.imageExecution).toMatchObject({ key: "together", aliases: ["together"] });
    expect(getModelById("cf-flux-schnell")?.imageExecution).toEqual({ key: "cloudflare", aliases: ["cloudflare"] });
  });

  it("reflects fal routes without requiring Replicate credentials", () => {
    mocks.env.falApiKey = "test-fal";
    for (const id of ["flux-pro", "flux-schnell", "together-flux", "ultra"]) {
      expect(getModelById(id)?.isAvailable).toBe(true);
    }
    expect(getModelById("minimax-video")?.isAvailable).toBe(false);
  });

  it("requires Cloudflare account and token and respects the existing Gemini gate", () => {
    mocks.env.cfAiToken = "test-cf";
    expect(getModelById("cf-flux-schnell")?.isAvailable).toBe(false);
    mocks.env.cfAccountId = "test-account";
    expect(getModelById("cf-flux-schnell")?.isAvailable).toBe(true);
    mocks.env.geminiApiKey = "test-gemini";
    expect(getModelById("gemini-image")?.isAvailable).toBe(false);
    vi.stubEnv("IMAGEN_ENABLED", "true");
    expect(getModelById("gemini-image")?.isAvailable).toBe(true);
  });

  it("uses the existing RunPod configuration predicate and retains registry prices", () => {
    mocks.runpodAvailable = true;
    expect(getModelById("runpod-flux-dev")?.isAvailable).toBe(true);
    expect(getModelById("runpod-flux-schnell")?.isAvailable).toBe(true);
    expect(getModelById("ultra")?.isAvailable).toBe(true);
    expect(getModelById("dall-e-3")).toMatchObject({
      name: "GPT Image 1", creditCost: { base: 15, hd: 25 },
      maxResolution: { width: 1536, height: 1536 },
    });
  });
});

describe("successful image execution provenance", () => {
  it("reports GPT Image for the legacy DALL-E selection and preserves free watermark/storage", async () => {
    mocks.env.openaiApiKey = "test-openai";
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: b64 }] }));
    const result = await generateImage({ prompt: "A lighthouse", model: "dall-e-3", userTier: "free" });
    expect(result.provenance).toEqual({ provider: "openai", model: "gpt-image-1", requestedModel: "dall-e-3", fallbackUsed: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: "gpt-image-1", quality: "medium" });
    expect(mocks.watermark).toHaveBeenCalledWith(bytes);
    expect(mocks.store).toHaveBeenCalledWith("generations/test.png", Buffer.from("watermarked image bytes"), "image/png");
  });

  it("returns first eligible Auto success without calling it a fallback", async () => {
    mocks.env.cfAiToken = "test-cf";
    mocks.env.cfAccountId = "test-account";
    fetchMock.mockResolvedValue(response({ result: { image: b64 } }));
    const result = await generateImage({ prompt: "A lighthouse", userTier: "pro" });
    expect(result.provenance).toEqual({ provider: "cloudflare", model: "@cf/black-forest-labs/flux-1-schnell", requestedModel: "auto", fallbackUsed: false });
    expect(mocks.watermark).not.toHaveBeenCalled();
    expect(mocks.store.mock.calls[0][1]).toEqual(bytes);
  });

  it("records the actual Auto fallback and excludes failed provider details", async () => {
    Object.assign(mocks.env, { cfAiToken: "test-cf", cfAccountId: "test-account", grokApiKey: "test-grok" });
    fetchMock.mockResolvedValueOnce(response({ error: "private upstream diagnostic" }, 503))
      .mockResolvedValueOnce(response({ data: [{ b64_json: b64 }] }));
    const result = await generateImage({ prompt: "A lighthouse", userTier: "pro" });
    expect(result.provenance).toEqual({ provider: "grok", model: "grok-imagine-image", requestedModel: "auto", fallbackUsed: true });
    expect(JSON.stringify(result)).not.toContain("private upstream diagnostic");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips incomplete Cloudflare configuration without claiming a failed eligible attempt", async () => {
    Object.assign(mocks.env, { cfAiToken: "test-cf", grokApiKey: "test-grok" });
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: b64 }] }));
    const result = await generateImage({ prompt: "A lighthouse", userTier: "pro" });
    expect(result.provenance).toEqual({ provider: "grok", model: "grok-imagine-image", requestedModel: "auto", fallbackUsed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.x.ai/v1/images/generations");
  });

  it("preserves same-model Flux failover from fal to Replicate", async () => {
    Object.assign(mocks.env, { falApiKey: "test-fal", replicateApiToken: "test-replicate" });
    fetchMock.mockResolvedValue(response({ error: "Unavailable" }, 503));
    const result = await generateImage({ prompt: "A lighthouse", model: "flux-pro", userTier: "pro" });
    expect(result.provenance).toEqual({ provider: "replicate", model: "black-forest-labs/flux-1.1-pro", requestedModel: "flux-pro", fallbackUsed: true });
    expect(mocks.predict).toHaveBeenCalledWith(expect.objectContaining({ model: "black-forest-labs/flux-1.1-pro" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not silently switch an explicit Grok selection to another model", async () => {
    Object.assign(mocks.env, { grokApiKey: "test-grok", openaiApiKey: "test-openai" });
    fetchMock.mockResolvedValue(response({ error: "Unavailable" }, 503));
    await expect(generateImage({ prompt: "A lighthouse", model: "grok", userTier: "pro" })).rejects.toThrow("Grok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.store).not.toHaveBeenCalled();
  });

  it("records an explicit fal model from its successful returned queue URLs", async () => {
    mocks.env.falApiKey = "test-fal";
    fetchMock.mockResolvedValueOnce(response({ request_id: "job", status_url: "https://queue.example/status", response_url: "https://queue.example/result" }))
      .mockResolvedValueOnce(response({ status: "COMPLETED" }))
      .mockResolvedValueOnce(response({ images: [{ url: "https://output.example/image.png" }] }))
      .mockResolvedValueOnce(new Response(bytes.toString("utf8")));
    const pending = generateImage({ prompt: "A lighthouse", model: "fal-seedream", userTier: "pro" });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await pending;
    expect(result.provenance).toEqual({ provider: "fal", model: "fal-ai/seedream-3.0", requestedModel: "fal-seedream", fallbackUsed: false });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      "https://queue.fal.run/fal-ai/seedream-3.0", "https://queue.example/status", "https://queue.example/result", "https://output.example/image.png",
    ]);
  });

  it("reports the successful Ultra leaf after a failed self-hosted attempt", async () => {
    mocks.runpodAvailable = true;
    mocks.runpodDev.mockRejectedValue(new Error("GPU unavailable"));
    mocks.env.openaiApiKey = "test-openai";
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: b64 }] }));
    const result = await generateImage({ prompt: "A lighthouse", model: "ultra", userTier: "studio" });
    expect(result.provenance).toEqual({ provider: "openai", model: "gpt-image-1", requestedModel: "ultra", fallbackUsed: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).quality).toBe("high");
  });

  it("preserves the unfiltered safety gate before provider work", async () => {
    mocks.runpodAvailable = true;
    mocks.moderation.mockReturnValue({ allowed: false, category: "csam" });
    await expect(generateImage({ prompt: "Blocked input", unfiltered: true })).rejects.toThrow("Blocked prompt");
    expect(mocks.logBlock).toHaveBeenCalled();
    expect(mocks.runpodSchnell).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });

  it("keeps paid unfiltered images unwatermarked and on their existing self-hosted path", async () => {
    mocks.runpodAvailable = true;
    const result = await generateImage({ prompt: "A lighthouse", unfiltered: true, userTier: "pro" });
    expect(result.provenance).toEqual({ provider: "runpod", model: "flux-schnell", requestedModel: "auto", fallbackUsed: false });
    expect(mocks.watermark).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves guarded image input and marks failed img2img before replacement rendering", async () => {
    mocks.runpodAvailable = true;
    mocks.runpodImg2Img.mockRejectedValue(new Error("Image edit unavailable"));
    mocks.env.grokApiKey = "test-grok";
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: b64 }] }));
    const result = await generateImage({ prompt: "A lighthouse", model: "grok", userTier: "pro", originalImages: [{ url: "https://input.example/image.png" }] });
    expect(mocks.guard).toHaveBeenCalledWith("https://input.example/image.png");
    expect(mocks.guardedFetch).toHaveBeenCalledWith("https://input.example/image.png");
    expect(result.provenance).toEqual({ provider: "grok", model: "grok-imagine-image", requestedModel: "grok", fallbackUsed: true });
  });
});
