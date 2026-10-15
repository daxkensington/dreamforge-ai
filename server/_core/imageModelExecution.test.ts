import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | boolean>,
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

import { generateImage, hasTypographyIntent, isAutomaticImageConfigured } from "./imageGeneration";
import { getModelById, listModels } from "./modelRegistry";
import { DIRECT_IMAGE_MODELS, DirectImageConfirmedRejection, DirectImageInputError, DirectImageOutcomeUncertain } from "./directImageProviders";
import { describeSketchBufferFast, removeBackgroundBufferSharp, upscaleBufferSharp, vectorizeBufferToSvg } from "./svgVectorize";

const fetchMock = vi.fn();
const bytes = Buffer.from("generated image bytes");
const b64 = bytes.toString("base64");
let validJpeg: Buffer;
beforeAll(async () => { validJpeg = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#336699" } }).jpeg().toBuffer(); });
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
    expect(executable).toHaveLength(18);
    expect(new Set(executable.map(model => model.imageExecution!.key)).size).toBe(18);
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
    for (const id of ["flux-pro", "flux-schnell", "together-flux", "ultra", "musicgen"]) {
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
      name: "GPT Image 1", creditCost: { base: 325, hd: 325 },
      maxResolution: { width: 1536, height: 1536 },
    });
  });

  it("quotes Grok Image 2.0 at the fixed Medium/1K price and Pro entitlement", () => {
    expect(getModelById("grok-imagine-image-2.0")).toMatchObject({
      tier: "pro", creditCost: { base: 310 }, maxResolution: { width: 1536, height: 1536 }, isAvailable: false,
    });
    mocks.env.grokApiKey = "fixture-grok";
    expect(getModelById("grok-imagine-image-2.0")?.isAvailable).toBe(true);
    expect(getModelById("grok-imagine-image-2.0")?.costInfo).toContain("1K");
  });

  it("keeps both new GPT snapshots gated by the enable flag and credentials", () => {
    mocks.env.openaiApiKey = "fixture-openai";
    for (const modelId of ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"] as const) {
      expect(getModelById(modelId)).toMatchObject({ tier: "pro", creditCost: { base: 900 }, isAvailable: false });
      expect(getModelById(modelId)?.imageExecution?.aliases).toEqual([DIRECT_IMAGE_MODELS[modelId].model]);
    }
    mocks.env.openaiImage25Enabled = true;
    expect(getModelById("gpt-image-2.5-flare")?.isAvailable).toBe(true);
    expect(getModelById("gpt-image-2.5-sunburst")?.isAvailable).toBe(true);
    delete mocks.env.openaiApiKey;
    expect(getModelById("gpt-image-2.5-flare")?.isAvailable).toBe(false);
  });
});

describe("successful image execution provenance", () => {
  it.each(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "grok-imagine-image-2.0"] as const)("routes explicit %s through one pinned POST and stores real PNG with direct provenance", async (modelId) => {
    Object.assign(mocks.env, { openaiApiKey: "fixture-openai", openaiImage25Enabled: true, grokApiKey: "fixture-grok", falApiKey: "fixture-fal", replicateApiToken: "fixture-replicate", cfAiToken: "fixture-cf", cfAccountId: "fixture-account" });
    const providerModel = DIRECT_IMAGE_MODELS[modelId].model;
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: validJpeg.toString("base64") }], model: providerModel, quality: "medium", usage: { cost_in_usd_ticks: 600_000_000 } }));
    const result = await generateImage({ prompt: "A fictional lighthouse", model: modelId, size: "512x768", quality: "hd", userTier: "pro" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: providerModel, n: 1, quality: "medium" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject(modelId === "grok-imagine-image-2.0" ? { resolution: "1k", aspect_ratio: "2:3", response_format: "b64_json" } : { size: "1024x1536", output_format: "png" });
    expect(result.provenance).toMatchObject({ provider: modelId === "grok-imagine-image-2.0" ? "grok" : "openai", model: providerModel, requestedModel: modelId, fallbackUsed: false, usage: { cost_in_usd_ticks: 600_000_000 }, direct: { requestedSize: { width: 512, height: 768 }, decodedSize: { width: 16, height: 12 }, sourceMimeType: "image/jpeg", request: { model: providerModel, quality: "medium" }, response: { model: providerModel, quality: "medium" } } });
    expect(mocks.store).toHaveBeenCalledTimes(1);
    expect(mocks.store.mock.calls[0][0]).toBe("generations/test.png");
    expect(mocks.store.mock.calls[0][2]).toBe("image/png");
    expect((await sharp(mocks.store.mock.calls[0][1]).metadata()).format).toBe("png");
    expect(mocks.watermark).not.toHaveBeenCalled();
    expect(mocks.runpodDev).not.toHaveBeenCalled();
    expect(mocks.predict).not.toHaveBeenCalled();
  });

  it.each(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"] as const)("refuses %s in the executor when its flag is disabled even if a key exists", async (model) => {
    Object.assign(mocks.env, { openaiApiKey: "fixture-openai", grokApiKey: "fixture-grok" });
    await expect(generateImage({ prompt: "A lighthouse", model, userTier: "pro" })).rejects.toBeInstanceOf(DirectImageInputError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });

  it.each([401, 429, 400, 422, 503])("preserves typed direct HTTP %i errors without cross-model fallback or storage", async (status) => {
    Object.assign(mocks.env, { grokApiKey: "fixture-grok", openaiApiKey: "fixture-openai", falApiKey: "fixture-fal", replicateApiToken: "fixture-replicate" });
    fetchMock.mockResolvedValue(response({ error: "Provider refused" }, status));
    await expect(generateImage({ prompt: "A lighthouse", model: "grok-imagine-image-2.0", userTier: "pro" })).rejects.toBeInstanceOf(status === 401 || status === 429 ? DirectImageConfirmedRejection : DirectImageOutcomeUncertain);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.store).not.toHaveBeenCalled();
    expect(mocks.predict).not.toHaveBeenCalled();
    expect(mocks.runpodSchnell).not.toHaveBeenCalled();
  });

  it("keeps the parent free watermark and PNG storage after direct generation", async () => {
    mocks.env.grokApiKey = "fixture-grok";
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: validJpeg.toString("base64") }] }));
    const result = await generateImage({ prompt: "A lighthouse", model: "grok-imagine-image-2.0", userTier: "free" });
    expect(mocks.watermark).toHaveBeenCalledTimes(1);
    expect((await sharp(mocks.watermark.mock.calls[0][0]).metadata()).format).toBe("png");
    expect(mocks.store).toHaveBeenCalledWith("generations/test.png", Buffer.from("watermarked image bytes"), "image/png");
    expect(result.provenance?.direct?.sourceMimeType).toBe("image/jpeg");
  });

  it("keeps Auto on its existing Grok model when the new options are configured", async () => {
    Object.assign(mocks.env, { grokApiKey: "fixture-grok", openaiApiKey: "fixture-openai", openaiImage25Enabled: true });
    fetchMock.mockResolvedValue(response({ data: [{ b64_json: b64 }] }));
    const result = await generateImage({ prompt: "A lighthouse", userTier: "pro" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("grok-imagine-image");
    expect(result.provenance?.direct).toBeUndefined();
  });

  it.each(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "grok-imagine-image-2.0"] as const)("prevents %s from bypassing its explicit route through legacy original-image or unfiltered generation", async (model) => {
    mocks.runpodAvailable = true;
    for (const options of [{ originalImages: [{ url: "https://input.example/image.png" }] }, { unfiltered: true }]) {
      await expect(generateImage({ prompt: "A lighthouse", model, userTier: "pro", ...options })).rejects.toBeInstanceOf(DirectImageInputError);
    }
    expect(mocks.runpodImg2Img).not.toHaveBeenCalled();
    expect(mocks.runpodSchnell).not.toHaveBeenCalled();
    expect(mocks.vision).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.store).not.toHaveBeenCalled();
  });

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

  it("fails over explicit runpod-flux-dev to fal.ai flux/dev when RunPod endpoint is paused", async () => {
    mocks.runpodAvailable = true;
    mocks.runpodDev.mockRejectedValue(new Error("RunPod run failed (409): ENDPOINT_PAUSED max_workers=0"));
    mocks.env.falApiKey = "test-fal";
    fetchMock.mockResolvedValueOnce(response({ request_id: "job", status_url: "https://queue.example/status", response_url: "https://queue.example/result" }))
      .mockResolvedValueOnce(response({ status: "COMPLETED" }))
      .mockResolvedValueOnce(response({ images: [{ url: "https://output.example/image.png" }] }))
      .mockResolvedValueOnce(new Response(bytes.toString("utf8")));
    const pending = generateImage({ prompt: "A lighthouse", model: "runpod-flux-dev", userTier: "pro" });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await pending;
    expect(result.provenance).toEqual({ provider: "fal", model: "fal-ai/flux/dev", requestedModel: "runpod-flux-dev", fallbackUsed: true });
  });

  it("fails over explicit dall-e-3 to fal.ai flux-pro/v1.1-ultra when OpenAI quota is exhausted", async () => {
    mocks.env.openaiApiKey = "test-openai";
    mocks.env.falApiKey = "test-fal";
    fetchMock.mockResolvedValueOnce(response({ error: { code: "credit_balance_exhausted", message: "Billing hard limit" } }, 429))
      .mockResolvedValueOnce(response({ request_id: "job", status_url: "https://queue.example/status", response_url: "https://queue.example/result" }))
      .mockResolvedValueOnce(response({ status: "COMPLETED" }))
      .mockResolvedValueOnce(response({ images: [{ url: "https://output.example/image.png" }] }))
      .mockResolvedValueOnce(new Response(bytes.toString("utf8")));
    const pending = generateImage({ prompt: "A lighthouse", model: "dall-e-3", userTier: "pro" });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await pending;
    expect(result.provenance).toEqual({ provider: "fal", model: "fal-ai/flux-pro/v1.1-ultra", requestedModel: "dall-e-3", fallbackUsed: true });
  });

  it("detects typography prompts and routes Auto to fal.ai Flux Schnell with typography guidance", async () => {
    expect(hasTypographyIntent('A neon sign that reads "DREAMFORGE" at night')).toBe(true);
    expect(hasTypographyIntent("A serene mountain lake at dawn")).toBe(false);
    Object.assign(mocks.env, { cfAiToken: "test-cf", cfAccountId: "test-account", falApiKey: "test-fal" });
    fetchMock.mockResolvedValueOnce(response({ request_id: "job", status_url: "https://queue.example/status", response_url: "https://queue.example/result" }))
      .mockResolvedValueOnce(response({ status: "COMPLETED" }))
      .mockResolvedValueOnce(response({ images: [{ url: "https://output.example/image.png" }] }))
      .mockResolvedValueOnce(new Response(bytes.toString("utf8")));
    const pending = generateImage({ prompt: 'A neon sign that reads "DREAMFORGE"', userTier: "pro" });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await pending;
    expect(result.provenance).toEqual({ provider: "fal", model: "fal-ai/flux/schnell", requestedModel: "auto", fallbackUsed: false });
    expect(fetchMock.mock.calls[0][0]).toBe("https://queue.fal.run/fal-ai/flux/schnell");
  });

  it("vectorizes raster buffers into valid SVG, describes sketch layout fast, and runs sharp upscale/cutout fallbacks", async () => {
    const svg = await vectorizeBufferToSvg(validJpeg, 4);
    expect(svg).toContain("<svg xmlns=\"http://www.w3.org/2000/svg\"");
    expect(svg).toContain("viewBox=\"0 0 16 12\"");
    const sketchBuf = await sharp({ create: { width: 48, height: 48, channels: 3, background: "#ff2200" } }).png().toBuffer();
    const layout = await describeSketchBufferFast(sketchBuf);
    expect(layout).toContain("Composition layout from user sketch:");

    const upscaled = await upscaleBufferSharp(validJpeg, 2);
    const upMeta = await sharp(upscaled).metadata();
    expect(upMeta.width).toBe(32);
    expect(upMeta.height).toBe(24);

    const cutout = await removeBackgroundBufferSharp(validJpeg);
    const cutRaw = await sharp(cutout).ensureAlpha().raw().toBuffer();
    expect(cutRaw[3]).toBe(0);
  });
});

