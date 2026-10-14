import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configuration = vi.hoisted(() => ({
  falApiKey: "test-fal-not-a-real-key",
  openaiApiKey: "",
  grokApiKey: "test-grok-not-a-real-key",
  stabilityApiKey: "",
  replicateApiToken: "",
  togetherApiKey: "",
  geminiApiKey: "",
  cfAiToken: "",
  cfAccountId: "",
  runpodApiKey: "",
  runpodFluxEndpointId: "",
}));

// Use the real registry and gateway, with synthetic configuration and no IO.
vi.mock("./_core/env", () => ({
  ENV: new Proxy({}, {
    get(_target, property) {
      return configuration[property as keyof typeof configuration] ?? "";
    },
  }),
}));
vi.mock("./_core/runpod", () => ({ isRunPodAvailable: () => false }));
vi.mock("./_core/imageGeneration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/imageGeneration")>();
  return { ...actual, generateImage: vi.fn() };
});

import { generateImage } from "./_core/imageGeneration";
import { executeImageCreation, listImageCreationModels, prepareImageCreation } from "./_core/imageGateway";

const render = vi.mocked(generateImage);
const request = (modelId: string, userTier = "studio", width = 768, height = 768) => ({ modelId, userTier, width, height });

beforeEach(() => {
  Object.assign(configuration, {
    falApiKey: "test-fal-not-a-real-key", grokApiKey: "test-grok-not-a-real-key",
    openaiApiKey: "", stabilityApiKey: "", replicateApiToken: "", togetherApiKey: "",
    geminiApiKey: "", cfAiToken: "", cfAccountId: "", runpodApiKey: "", runpodFluxEndpointId: "",
  });
  vi.stubEnv("IMAGEN_ENABLED", "false");
  render.mockReset().mockResolvedValue({ url: "https://cdn.example.com/gateway.png" });
});
afterEach(() => vi.unstubAllEnvs());

describe("standard image creation gateway", () => {
  it("lists only executable creation choices with unique IDs and explicit quotes", () => {
    const catalog = listImageCreationModels();
    expect(new Set(catalog.map(model => model.id)).size).toBe(catalog.length);
    expect(catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "built-in-v1", creditCost: 5, requiredTier: "free", isConfigured: true }),
      expect.objectContaining({ id: "grok-image", creditCost: 5, requiredTier: "creator", isConfigured: true }),
      expect.objectContaining({ id: "flux-pro", creditCost: 15, requiredTier: "pro", isConfigured: true }),
    ]));
    expect(catalog.map(model => model.id)).not.toContain("fal-flux-kontext");
    expect(catalog.map(model => model.id)).not.toContain("gpt-4o-mini");
    expect(render).not.toHaveBeenCalled();
  });

  it.each(["built-in-v1", "auto"])("quotes %s at the fixed automatic price", modelId => {
    expect(prepareImageCreation(request(modelId, "free"))).toMatchObject({
      requestedModelId: modelId, modelId: "built-in-v1", executionKey: "auto", creditCost: 5,
    });
  });

  it("resolves a legacy alias to its canonical registry identity and executor", () => {
    expect(prepareImageCreation(request("grok", "creator"))).toMatchObject({
      requestedModelId: "grok", modelId: "grok-image", executionKey: "grok",
      billableModelId: "grok-image", creditCost: 5,
    });
  });

  it.each(["some-future-model", "gpt-4o-mini", "fal-flux-kontext"])("rejects unsupported creation choice %s without rendering", modelId => {
    expect(() => prepareImageCreation(request(modelId))).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects a model the subscriber cannot access", () => {
    expect(() => prepareImageCreation(request("flux-pro", "free"))).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects an unconfigured explicit choice even when Automatic has another provider", () => {
    configuration.grokApiKey = "";
    expect(listImageCreationModels().find(model => model.id === "built-in-v1")?.isConfigured).toBe(true);
    expect(() => prepareImageCreation(request("grok-image"))).toThrow(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
    expect(render).not.toHaveBeenCalled();
  });

  it("fails closed when no image executor is configured", () => {
    configuration.grokApiKey = "";
    configuration.falApiKey = "";
    expect(listImageCreationModels().find(model => model.id === "built-in-v1")?.isConfigured).toBe(false);
    expect(() => prepareImageCreation(request("auto"))).toThrow(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
    expect(render).not.toHaveBeenCalled();
  });

  it("does not advertise Automatic when only Together is configured outside its fallback chain", () => {
    configuration.grokApiKey = "";
    configuration.falApiKey = "";
    configuration.togetherApiKey = "test-together-not-a-real-key";
    expect(listImageCreationModels().find(model => model.id === "together-flux")?.isConfigured).toBe(true);
    expect(listImageCreationModels().find(model => model.id === "built-in-v1")?.isConfigured).toBe(false);
    expect(() => prepareImageCreation(request("auto"))).toThrow(expect.objectContaining({ code: "SERVICE_UNAVAILABLE" }));
    expect(render).not.toHaveBeenCalled();
  });

  it("rejects dimensions beyond the selected model's limit", () => {
    expect(() => prepareImageCreation(request("grok-image", "studio", 1536, 1024)))
      .toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it.each([255, 256.5, Number.NaN])("rejects invalid image dimension %s", width => {
    expect(() => prepareImageCreation(request("auto", "studio", width, 768)))
      .toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it("keeps the quoted selection immutable and executes exactly its canonical key", async () => {
    const plan = prepareImageCreation(request("grok", "creator", 768, 1024));
    expect(Object.isFrozen(plan)).toBe(true);
    await expect(executeImageCreation(plan, { prompt: "A mountain lake" })).resolves.toMatchObject({ url: "https://cdn.example.com/gateway.png" });
    expect(render).toHaveBeenCalledExactlyOnceWith({
      prompt: "A mountain lake", model: "grok", size: "768x1024", userTier: "creator",
    });
  });

  it("propagates selected-provider failure without trying another model", async () => {
    render.mockRejectedValueOnce(new Error("selected provider unavailable"));
    const plan = prepareImageCreation(request("grok-image", "creator"));
    await expect(executeImageCreation(plan, { prompt: "A mountain lake" })).rejects.toThrow("selected provider unavailable");
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ model: "grok" }));
  });

  it("keeps the caller's exact requested identity alongside the actual successful provider", async () => {
    render.mockResolvedValueOnce({
      url: "https://cdn.example.com/grok.png",
      provenance: { provider: "grok", model: "grok-imagine-image", requestedModel: "grok", fallbackUsed: false },
    });
    const plan = prepareImageCreation(request("grok-image", "creator"));
    await expect(executeImageCreation(plan, { prompt: "A mountain lake" })).resolves.toMatchObject({
      provenance: { provider: "grok", model: "grok-imagine-image", requestedModel: "grok-image", fallbackUsed: false },
    });
  });

  it.each([undefined, "", "   "])("rejects a completed response without a downloadable URL (%s)", url => {
    render.mockResolvedValueOnce({ url });
    const plan = prepareImageCreation(request("auto", "free"));
    return expect(executeImageCreation(plan, { prompt: "A mountain lake" })).rejects.toThrow(/no downloadable image/i);
  });
});
