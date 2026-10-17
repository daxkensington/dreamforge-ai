import { describe, expect, it } from "vitest";
import { hashGenerationRequest, replayGenerationResponse } from "./generationRequest";
import type { GenerationRequestRecord } from "./generationBilling";

const input = { prompt: "A crystal mountain", mediaType: "image" as const, width: 768, height: 768, duration: 4, modelVersion: "built-in-v1", uncensored: false };
const record = (state: GenerationRequestRecord["state"], extra = {}) => ({
  id: 1, userId: 1, requestId: "114bdd89-cd2b-4b77-8ad3-857220ed45ed", payloadHash: hashGenerationRequest(input), quotedCredits: 5,
  state, generationId: null, result: null, errorCode: null, debitedAt: null, refundedAt: null,
  createdAt: new Date(), updatedAt: new Date(), ...extra,
} as GenerationRequestRecord);

describe("generation request replay contract", () => {
  it("binds each meaningful input and ignores tag order and duplicates", () => {
    expect(hashGenerationRequest({ ...input, tagIds: [2, 1, 2] })).toBe(hashGenerationRequest({ ...input, tagIds: [1, 2] }));
    for (const changed of [{ prompt: "Another prompt" }, { modelVersion: "flux-pro" }, { width: 1024 }, { negativePrompt: "Fog" }, { uncensored: true }, { tagIds: [3] }]) {
      expect(hashGenerationRequest({ ...input, ...changed })).not.toBe(hashGenerationRequest(input));
    }
  });
  it("rejects a reused identity with different content", () => {
    expect(() => replayGenerationResponse(record("rendering"), "different", "image")).toThrow("different generation");
  });
  it("binds custom model identity while preserving existing untrained request hashes", () => {
    expect(hashGenerationRequest({...input,trainedModelId:1})).not.toBe(hashGenerationRequest(input));
    expect(hashGenerationRequest({...input,trainedModelId:1})).not.toBe(hashGenerationRequest({...input,trainedModelId:2}));
    expect(hashGenerationRequest({...input,trainedModelId:undefined})).toBe(hashGenerationRequest(input));
  });
  it("replays the saved completed result without a new quote", () => {
    const result = { id: 3, status: "completed", imageUrl: "https://assets.example/image.png", mediaType: "image", creditCost: 5, newAchievements: [] };
    expect(replayGenerationResponse(record("completed", { generationId: 3, result }), hashGenerationRequest(input), "image")).toEqual({ ...result, requestId: record("completed").requestId });
  });
  it("never converts a corrupt completion into a new generation", () => {
    expect(() => replayGenerationResponse(record("completed"), hashGenerationRequest(input), "image")).toThrow("reconciliation");
  });
  it("returns terminal failures for uncharged rejection and completed refund", () => {
    expect(replayGenerationResponse(record("rejected"), hashGenerationRequest(input), "image")).toMatchObject({ status: "failed", error: expect.stringContaining("No credits charged") });
    expect(replayGenerationResponse(record("refunded"), hashGenerationRequest(input), "image")).toMatchObject({ status: "failed", error: expect.stringContaining("refunded") });
  });
  it("keeps unlinked, rendering and reconciliation requests pending", () => {
    for (const state of ["reserved", "rendering", "reconciliation"] as const) {
      expect(replayGenerationResponse(record(state), hashGenerationRequest(input), "image")).toMatchObject({ status: "generating", retryAfterMs: 3000, reconciliationRequired: state === "reconciliation" });
    }
  });
});
