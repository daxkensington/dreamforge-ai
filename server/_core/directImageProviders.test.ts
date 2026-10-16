import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  DIRECT_IMAGE_MODELS, DirectImageConfirmedRejection, DirectImageInputError, DirectImageOutcomeUncertain,
  generateDirectImage, isConfirmedDirectImageRejection, prepareDirectImageRequest, type DirectImageInput, type DirectImageModelId,
} from "./directImageProviders";

let png: Buffer;
let jpeg: Buffer;
beforeAll(async () => {
  const pixel = { create: { width: 16, height: 12, channels: 3 as const, background: "#336699" } };
  png = await sharp(pixel).png().toBuffer();
  jpeg = await sharp(pixel).jpeg().toBuffer();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const input = (modelId: DirectImageModelId = "gpt-image-2.5-flare"): DirectImageInput => ({ modelId, prompt: "A fictional glass dragon", width: 1024, height: 1024, apiKey: "fixture-key-only" });
const fetchResult = (value: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "x-request-id": "req_fixture" } }));
const goodBody = () => ({ data: [{ b64_json: png.toString("base64") }] });

describe("direct image provider contract", () => {
  it.each(["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"] as const)("uses only the pinned %s snapshot and supported GPT image parameters", async (modelId) => {
    const transport = fetchResult({ ...goodBody(), model: DIRECT_IMAGE_MODELS[modelId].model, quality: "medium", size: "1024x1024", usage: { input_tokens: 12, output_tokens: 100, total_tokens: 112, input_tokens_details: { text_tokens: 12, image_tokens: 0 } } });
    const result = await generateDirectImage(input(modelId), { fetch: transport });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe("https://api.openai.com/v1/images/generations");
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({ model: DIRECT_IMAGE_MODELS[modelId].model, prompt: input().prompt, n: 1, quality: "medium", size: "1024x1024", output_format: "png" });
    expect(result.provenance.providerModel).toBe(DIRECT_IMAGE_MODELS[modelId].model);
    expect(result.provenance.providerRequestId).toBe("req_fixture");
    expect(result.provenance.response).toEqual({ model: DIRECT_IMAGE_MODELS[modelId].model, quality: "medium", size: "1024x1024" });
    expect(result.usage?.input_tokens_details).toEqual({ text_tokens: 12, image_tokens: 0 });
    expect(result.mimeType).toBe("image/png");
    expect((await sharp(result.buffer).metadata()).format).toBe("png");
  });

  it.each([[512, 768, "1024x1536"], [768, 512, "1536x1024"], [1024, 1024, "1024x1024"], [1152, 1024, "1024x1024"]] as const)("maps requested %i×%i to the declared OpenAI preset %s", (width, height, size) => {
    const plan = prepareDirectImageRequest({ modelId: "gpt-image-2.5-flare", width, height });
    expect(plan.outputControls).toEqual({ size });
    expect(plan.requestedSize).toEqual({ width, height });
  });

  it("pins xAI medium/1k, uses aspect_ratio instead of size, and normalizes JPEG bytes to PNG", async () => {
    const transport = fetchResult({ data: [{ b64_json: jpeg.toString("base64"), mime_type: "image/jpeg" }], model: "grok-imagine-image-2.0", quality: "medium", resolution: "1k", usage: { cost_in_usd_ticks: 600_000_000, input_tokens: null } });
    const result = await generateDirectImage({ ...input("grok-imagine-image-2.0"), width: 512, height: 768 }, { fetch: transport });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][0]).toBe("https://api.x.ai/v1/images/generations");
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toEqual({ model: "grok-imagine-image-2.0", prompt: input().prompt, n: 1, quality: "medium", resolution: "1k", aspect_ratio: "2:3", response_format: "b64_json" });
    expect(result.provenance.sourceMimeType).toBe("image/jpeg");
    expect(result.provenance.decodedSize).toEqual({ width: 16, height: 12 });
    expect(result.provenance.response).toEqual({ model: "grok-imagine-image-2.0", quality: "medium", resolution: "1k" });
    expect(result.usage).toEqual({ cost_in_usd_ticks: 600_000_000, input_tokens: null });
    expect(result.mimeType).toBe("image/png");
    expect((await sharp(result.buffer).metadata()).format).toBe("png");
  });

  it.each([[1024, 1024, "1:1"], [1024, 768, "4:3"], [768, 1024, "3:4"], [1536, 864, "16:9"], [864, 1536, "9:16"], [1280, 512, "5:2"]] as const)("maps xAI %i×%i to the explicit %s preset", (width, height, aspect_ratio) => {
    expect(prepareDirectImageRequest({ modelId: "grok-imagine-image-2.0", width, height }).outputControls).toEqual({ resolution: "1k", aspect_ratio });
  });

  it("does not invent reported settings when the response has no provenance", async () => {
    const result = await generateDirectImage(input(), { fetch: fetchResult(goodBody()) });
    expect(result.provenance.request).toMatchObject({ model: "gpt-image-2.5-flare-2026-09-08", quality: "medium", size: "1024x1024" });
    expect(result.provenance.response).toBeUndefined();
    expect(result.usage).toBeUndefined();
    expect(JSON.stringify(result.provenance)).not.toContain(input().prompt);
    expect(JSON.stringify(result.provenance)).not.toContain(input().apiKey);
  });

  it("retains differing provider reports separately from pinned request controls", async () => {
    const result = await generateDirectImage(input(), { fetch: fetchResult({ ...goodBody(), model: "provider-reported-model", quality: "low", resolution: "2k" }) });
    expect(result.provenance.request.model).toBe("gpt-image-2.5-flare-2026-09-08");
    expect(result.provenance.response).toEqual({ model: "provider-reported-model", quality: "low", resolution: "2k" });
  });

  it.each([401, 403, 404, 429])("classifies the bounded terminal HTTP %i refusal", async (status) => {
    const transport = fetchResult({ error: { message: `Do not log ${input().apiKey} or ${input().prompt}` } }, status);
    const error = await generateDirectImage(input(), { fetch: transport }).catch((value) => value);
    expect(error).toBeInstanceOf(DirectImageConfirmedRejection);
    expect(isConfirmedDirectImageRejection(error)).toBe(true);
    expect(error).toMatchObject({ status, outcome: "confirmed_rejection", providerRequestId: "req_fixture" });
    expect(String(error)).not.toContain(input().apiKey);
    expect(String(error)).not.toContain(input().prompt);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([400, 408, 409, 422, 500, 502, 503, 504])("holds HTTP %i uncertain without retry or fallback", async (status) => {
    const transport = fetchResult({ error: "upstream outcome unknown" }, status);
    const error = await generateDirectImage(input(), { fetch: transport }).catch((value) => value);
    expect(error).toBeInstanceOf(DirectImageOutcomeUncertain);
    expect(isConfirmedDirectImageRejection(error)).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([null, {}, { data: [] }, { data: [{ url: "https://example.invalid/provider-output.png" }] }, { data: [{ b64_json: "" }] }, { data: [{ b64_json: "not base64!!" }] }, { data: [{ b64_json: "YQ==" }] }, { data: [{ b64_json: "YQ==" }, { b64_json: "YQ==" }] }])("keeps empty or malformed successful payloads uncertain (%j)", async (body) => {
    const transport = fetchResult(body);
    const error = await generateDirectImage(input(), { fetch: transport }).catch((value) => value);
    expect(error).toBeInstanceOf(DirectImageOutcomeUncertain);
    expect(error.reason).toBe("invalid_response");
    expect(isConfirmedDirectImageRejection(error)).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("keeps a truncated image and invalid success JSON uncertain", async () => {
    for (const response of [new Response(JSON.stringify({ data: [{ b64_json: png.subarray(0, 24).toString("base64") }] })), new Response("<html>invalid success</html>")]) {
      const transport = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(generateDirectImage(input(), { fetch: transport })).rejects.toBeInstanceOf(DirectImageOutcomeUncertain);
      expect(transport).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps network errors uncertain without exposing credentials or retrying", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new Error(`Connection lost ${input().apiKey}`));
    const error = await generateDirectImage(input(), { fetch: transport }).catch((value) => value);
    expect(error).toBeInstanceOf(DirectImageOutcomeUncertain);
    expect(error.reason).toBe("network");
    expect(String(error)).not.toContain(input().apiKey);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("blocks a native fetch 307 redirect from issuing a second POST", async () => {
    let posts = 0;
    const server = createServer((request, response) => {
      if (request.method === "POST") posts++;
      response.setHeader("connection", "close");
      if (request.url === "/redirected") {
        response.setHeader("content-type", "application/json"); response.end(JSON.stringify(goodBody()));
      } else {
        response.writeHead(307, { location: "/redirected" }); response.end();
      }
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    try {
      const port = (server.address() as AddressInfo).port;
      // The real fetch transport reaches only this local fixture with fake credentials.
      const transport = vi.fn<typeof fetch>().mockImplementation((_url, options) => globalThis.fetch(`http://127.0.0.1:${port}/start`, options));
      await expect(generateDirectImage(input(), { fetch: transport })).rejects.toBeInstanceOf(DirectImageOutcomeUncertain);
      expect(transport.mock.calls[0][1]?.redirect).toBe("error");
      expect(posts).toBe(1);
      expect(transport).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("aborts a timed-out POST and retains an uncertain outcome", async () => {
    vi.useFakeTimers();
    const transport = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("transport abort")), { once: true })));
    const promise = generateDirectImage(input(), { fetch: transport, timeoutMs: 25 });
    const assertion = expect(promise).rejects.toMatchObject({ outcome: "uncertain", reason: "timeout" });
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("honors an already cancelled caller without invoking a provider", async () => {
    const controller = new AbortController(); controller.abort();
    const transport = vi.fn<typeof fetch>();
    await expect(generateDirectImage(input(), { fetch: transport, signal: controller.signal })).rejects.toMatchObject({ outcome: "uncertain", reason: "cancelled" });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([{ modelId: "auto" }, { width: 511.5 }, { height: 0 }, { width: 2048 }, { apiKey: "" }, { prompt: " " }])("rejects invalid local input before a POST (%j)", async (change) => {
    const transport = vi.fn<typeof fetch>();
    const error = await generateDirectImage({ ...input(), ...change } as DirectImageInput, { fetch: transport }).catch((value) => value);
    expect(error).toBeInstanceOf(DirectImageInputError);
    expect(isConfirmedDirectImageRejection(error)).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });
});
