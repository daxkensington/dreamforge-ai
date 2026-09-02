/**
 * The uncensored img2img rails must ask the worker for the SAME Flux base the
 * text-to-image path uses (Schnell), on both the async submit rail and the
 * sync refine rail. Before 2026-09-03 the worker hardcoded Dev for img2img:
 * a character-lock render on a worker already holding Schnell tried to fit a
 * second ~34GB model on a 48GB card, and the Schnell realism LoRA was being
 * fused onto a Dev base. Nobody had exercised the path in prod yet.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const runpodSubmit = vi.fn(async () => "job-1");
const runpodFluxImg2Img = vi.fn(async () => Buffer.from("png"));

vi.mock("./_core/runpod", () => ({
  runpodSubmit: (...a: any[]) => (runpodSubmit as any)(...a),
  runpodJobStatus: vi.fn(),
  getImageEndpointId: () => "ep-image",
  isRunPodAvailable: () => true,
  runpodFluxDev: vi.fn(),
  runpodFluxSchnell: vi.fn(),
  runpodFluxImg2Img: (...a: any[]) => (runpodFluxImg2Img as any)(...a),
}));
vi.mock("./storage", () => ({ storagePut: vi.fn(), generateStorageKey: vi.fn(() => "k") }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/replicate", () => ({ replicatePredict: vi.fn(), downloadBuffer: vi.fn() }));
vi.mock("./_core/promptModeration", () => ({
  checkPrompt: vi.fn(() => ({ allowed: true })),
  logModerationBlock: vi.fn(),
  PromptBlockedError: class extends Error {},
}));

import { submitUnfilteredImageJob } from "./_core/imageGenerationUncensored";
import { refineUnfiltered, UNCENSORED_IMG2IMG_STEPS } from "./_core/imageGeneration";

beforeEach(() => {
  runpodSubmit.mockClear();
  runpodFluxImg2Img.mockClear();
});

describe("uncensored img2img asks for the Schnell base", () => {
  it("async submit: character-lock img2img carries model=schnell and the shared step count", async () => {
    await submitUnfilteredImageJob({
      prompt: "p",
      width: 832,
      height: 1216,
      imageB64: "AAAA",
      strength: 0.45,
      loraId: "some/lora::file.safetensors",
    } as any);
    expect(runpodSubmit).toHaveBeenCalledTimes(1);
    const [input, opts] = runpodSubmit.mock.calls[0] as any;
    expect(input.task).toBe("flux-img2img");
    expect(input.model).toBe("schnell");
    expect(input.num_inference_steps).toBe(UNCENSORED_IMG2IMG_STEPS);
    expect(input).not.toHaveProperty("guidance_scale");
    expect(input.lora_id).toBe("some/lora::file.safetensors");
    expect(opts.endpointId).toBe("ep-image");
  });

  it("async submit: plain text-to-image does not send a model field (the task already names it)", async () => {
    await submitUnfilteredImageJob({ prompt: "p", width: 832, height: 1216 } as any);
    const [input] = runpodSubmit.mock.calls[0] as any;
    expect(input.task).toBe("flux-schnell");
    expect(input).not.toHaveProperty("model");
  });

  it("sync refine: runpodFluxImg2Img gets the same base and step count", async () => {
    await refineUnfiltered("AAAA", "p", { strength: 0.4, loraId: "l" });
    expect(runpodFluxImg2Img).toHaveBeenCalledTimes(1);
    const args = runpodFluxImg2Img.mock.calls[0] as any[];
    // (imageB64, prompt, strength, steps, guidance, loraId, seed, model)
    expect(args[3]).toBe(UNCENSORED_IMG2IMG_STEPS);
    expect(args[5]).toBe("l");
    expect(args[7]).toBe("schnell");
  });
});

describe("warmUnfilteredImageWorker", () => {
  it("submits a warm task for Schnell with the LoRA and does not wait for a result", async () => {
    const { warmUnfilteredImageWorker } = await import("./_core/imageGenerationUncensored");
    const ok = await warmUnfilteredImageWorker("some/lora::file.safetensors");
    expect(ok).toBe(true);
    const [input, opts] = runpodSubmit.mock.calls[0] as any;
    expect(input).toEqual({ task: "warm", model: "schnell", lora_id: "some/lora::file.safetensors" });
    expect(opts.endpointId).toBe("ep-image");
  });
});
