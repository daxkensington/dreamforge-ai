import { describe, expect, it } from "vitest";
import {
  validateSafetensors,
  validateTrainingQueueUrl,
  fetchTrainingWeights,
} from "./modelTraining";
describe("training provider boundaries", () => {
  it("accepts only returned trainer queue URLs bound to the exact receipt", () => {
    expect(
      validateTrainingQueueUrl(
        "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/abc/status",
        "abc",
        "/status"
      )
    ).toContain("/abc/status");
    for (const url of [
      "https://evil.example/fal-ai/flux-lora-fast-training/requests/abc/status",
      "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/other/status",
      "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/abc/status?redirect=1",
    ])
      expect(() => validateTrainingQueueUrl(url, "abc", "/status")).toThrow();
  });
  it("rejects arbitrary weight URLs before any fetch", async () => {
    for (const url of [
      "http://127.0.0.1/a",
      "https://fal.media.evil.example/a",
      "https://user:pass@fal.media/a",
    ])
      await expect(fetchTrainingWeights(url)).rejects.toThrow();
  });
  it("rejects executable/invalid/mis-sized model files", () => {
    expect(() => validateSafetensors(Buffer.from("pickle data"))).toThrow();
    const header = Buffer.from(
        JSON.stringify({
          weights: { dtype: "F32", shape: [1], data_offsets: [0, 99] },
        })
      ),
      length = Buffer.alloc(8);
    length.writeBigUInt64LE(BigInt(header.length));
    expect(() =>
      validateSafetensors(Buffer.concat([length, header, Buffer.alloc(4)]))
    ).toThrow();
  });
  it("checks tensor byte size, complete layout and duplicate JSON fields", () => {
    const file = (header: string, bytes = 4) => {
      const text = Buffer.from(header),
        length = Buffer.alloc(8);
      length.writeBigUInt64LE(BigInt(text.length));
      return Buffer.concat([length, text, Buffer.alloc(bytes)]);
    };
    expect(() =>
      validateSafetensors(
        file('{"weight":{"dtype":"F32","shape":[1],"data_offsets":[0,4]}}')
      )
    ).not.toThrow();
    expect(() =>
      validateSafetensors(
        file('{"weight":{"dtype":"F32","shape":[2],"data_offsets":[0,4]}}')
      )
    ).toThrow();
    expect(() =>
      validateSafetensors(
        file('{"weight":{"dtype":"F32","shape":[1],"data_offsets":[4,8]}}', 8)
      )
    ).toThrow();
    expect(() =>
      validateSafetensors(
        file(
          '{"weight":{"dtype":"F32","shape":[1],"data_offsets":[0,4]},"weight":{"dtype":"F32","shape":[1],"data_offsets":[0,4]}}'
        )
      )
    ).toThrow();
  });
});
