import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { GenerationRequestRecord } from "./generationBilling";

export interface GenerationRequestInput {
  prompt: string;
  negativePrompt?: string;
  mediaType: "image" | "video";
  width: number;
  height: number;
  duration: number;
  modelVersion: string;
  tagIds?: number[];
  uncensored: boolean;
  uncensoredStyle?: string;
}

export interface CompletedGenerationResponse {
  id: number;
  status: "completed";
  requestId: string;
  mediaType: "image" | "video";
  imageUrl: string;
  newAchievements: unknown[];
  modelId?: string;
  creditCost?: number;
  provenance?: unknown;
}

/** Hash the normalized request, excluding the independently scoped UUID. */
export function hashGenerationRequest(input: GenerationRequestInput) {
  return createHash("sha256").update(JSON.stringify({
    prompt: input.prompt,
    negativePrompt: input.negativePrompt ?? null,
    mediaType: input.mediaType,
    width: input.width,
    height: input.height,
    duration: input.duration,
    modelVersion: input.modelVersion,
    tagIds: [...new Set(input.tagIds ?? [])].sort((a, b) => a - b),
    uncensored: input.uncensored,
    uncensoredStyle: input.uncensoredStyle ?? null,
  })).digest("hex");
}

export function pendingGenerationResponse(requestId: string, mediaType: "image" | "video", request?: GenerationRequestRecord) {
  return {
    id: request?.generationId ?? undefined,
    status: "generating" as const,
    requestId,
    mediaType,
    retryAfterMs: 3000,
    reconciliationRequired: request?.state === "reconciliation",
  };
}

export function replayGenerationResponse(request: GenerationRequestRecord, payloadHash: string, mediaType: "image" | "video") {
  if (request.payloadHash !== payloadHash) {
    throw new TRPCError({ code: "CONFLICT", message: "This request ID already belongs to a different generation. Start a new request." });
  }
  if (request.state === "completed") {
    const result = request.result;
    if (!result || result.status !== "completed" || typeof result.imageUrl !== "string" || !result.imageUrl.trim() || result.id !== request.generationId || result.mediaType !== mediaType || (result.creditCost !== undefined && result.creditCost !== request.quotedCredits)) {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Your generation result needs reconciliation. This request will not be charged or rendered again." });
    }
    const response: CompletedGenerationResponse = {
      id: request.generationId!, status: "completed", requestId: request.requestId,
      mediaType, imageUrl: result.imageUrl,
      newAchievements: Array.isArray(result.newAchievements) ? result.newAchievements : [],
      ...(typeof result.modelId === "string" ? { modelId: result.modelId } : {}),
      ...(typeof result.creditCost === "number" ? { creditCost: result.creditCost } : {}),
      ...(result.provenance !== undefined ? { provenance: result.provenance } : {}),
    };
    return response;
  }
  if (request.state === "rejected" || request.state === "refunded") {
    return {
      id: request.generationId ?? undefined,
      status: "failed" as const,
      requestId: request.requestId,
      mediaType,
      error: request.state === "rejected"
        ? `Insufficient credits. This generation needs ${request.quotedCredits} credits. No credits charged.`
        : "Generation failed. The credits charged for this request were refunded.",
      creditCost: 0,
      quotedCredits: request.quotedCredits,
      refundedCredits: request.state === "refunded" ? request.quotedCredits : 0,
    };
  }
  return pendingGenerationResponse(request.requestId, mediaType, request);
}
