import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    falApiKey: "test-fal-key",
    runpodApiKey: "test-runpod-key",
    runpodEndpointId: "ep-default",
    runpodImageEndpointId: "ep-image",
  },
}));

vi.mock("./_core/runpod", () => ({
  isRunPodAvailable: vi.fn(() => true),
  getImageEndpointId: vi.fn(() => "ep-image"),
  runpodSubmit: vi.fn(),
  runpodJobStatus: vi.fn(),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(),
  generateWithFal: vi.fn(),
}));

vi.mock("./_core/watermark", () => ({
  addImageWatermark: vi.fn(async (buf: Buffer) => Buffer.concat([buf, Buffer.from("-wm")])),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ url: `https://dreamforgex.ai/img/${key}` })),
  generateStorageKey: vi.fn(() => "generations/rescued.png"),
}));

vi.mock("./_core/moderationLog", () => ({
  logModerationBlock: vi.fn(async () => undefined),
}));

import { collectUnfilteredImageJob } from "./_core/imageGenerationUncensored";
import { runpodJobStatus } from "./_core/runpod";
import { generateWithFal } from "./_core/imageGeneration";
import { addImageWatermark } from "./_core/watermark";
import { storagePut } from "./storage";

describe("collectUnfilteredImageJob — cold-start & failure rescue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps polling when RunPod job is <10s old and IN_QUEUE", async () => {
    vi.mocked(runpodJobStatus).mockResolvedValueOnce({ status: "IN_QUEUE" });

    const res = await collectUnfilteredImageJob("job-fresh", {
      watermark: true,
      fallback: {
        prompt: "sensual portrait in soft candlelight",
        width: 832,
        height: 1216,
        createdAt: new Date(Date.now() - 3_000),
      },
    });

    expect(res).toEqual({ status: "processing" });
    expect(generateWithFal).not.toHaveBeenCalled();
  });

  it("rescues with unfiltered fal-ai/flux/schnell + watermark when RunPod cold-starts >10s", async () => {
    vi.mocked(runpodJobStatus).mockResolvedValueOnce({ status: "IN_QUEUE" });
    vi.mocked(generateWithFal).mockResolvedValueOnce(Buffer.from("png-bytes"));

    const res = await collectUnfilteredImageJob("job-cold", {
      watermark: true,
      fallback: {
        prompt: "sensual portrait in soft candlelight",
        width: 832,
        height: 1216,
        seed: 42,
        createdAt: new Date(Date.now() - 15_000),
      },
    });

    expect(generateWithFal).toHaveBeenCalledWith(
      "sensual portrait in soft candlelight",
      "fal-ai/flux/schnell",
      832,
      1216,
      { enable_safety_checker: false, seed: 42 },
    );
    expect(addImageWatermark).toHaveBeenCalledTimes(1);
    expect(storagePut).toHaveBeenCalledWith(
      "generations/rescued.png",
      Buffer.from("png-bytes-wm"),
      "image/png",
    );
    expect(res).toEqual({
      status: "completed",
      url: "https://dreamforgex.ai/img/generations/rescued.png",
      key: "generations/rescued.png",
    });
  });

  it("rescues immediately without watermark for paid Studio jobs when RunPod returns FAILED (e.g. 404 expired)", async () => {
    vi.mocked(runpodJobStatus).mockResolvedValueOnce({
      status: "FAILED",
      error: "RunPod job expired or not found (404)",
    });
    vi.mocked(generateWithFal).mockResolvedValueOnce(Buffer.from("paid-png"));

    const res = await collectUnfilteredImageJob("job-expired-404", {
      watermark: false,
      fallback: {
        prompt: "cinematic noir bedroom scene",
        width: 1024,
        height: 1024,
        createdAt: new Date(Date.now() - 2_000),
      },
    });

    expect(generateWithFal).toHaveBeenCalledTimes(1);
    expect(addImageWatermark).not.toHaveBeenCalled();
    expect(res).toEqual({
      status: "completed",
      url: "https://dreamforgex.ai/img/generations/rescued.png",
      key: "generations/rescued.png",
    });
  });
});
