import { TRPCError } from "@trpc/server";
import { TOOL_CREDIT_COSTS } from "../../shared/creditCosts";
import { getTierConfig, resolveTierName } from "../../shared/tiers";
import type { ImageExecutionKey } from "../../shared/imageModels";
import { generateImage, isAutomaticImageConfigured } from "./imageGeneration";
import { canAccessModel, listModels, type AIModel } from "./modelRegistry";

/** Standard text-to-image choices are derived from the executable registry. */
function creationModels(): AIModel[] {
  return listModels({ type: "image" }).filter(
    (model) => model.imageExecution && model.capabilities.includes("text-to-image"),
  );
}

export function listImageCreationModels() {
  const models = creationModels();
  return [
    {
      id: "built-in-v1",
      name: "Automatic",
      provider: "auto",
      description: "Automatically choose an available image model at the displayed credit price.",
      creditCost: TOOL_CREDIT_COSTS["text-to-image"],
      requiredTier: "free",
      isConfigured: isAutomaticImageConfigured(),
      maxResolution: { width: 1536, height: 1536 },
    },
    ...models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.imageExecution?.providerLabel ?? model.provider,
      description: model.description,
      creditCost: model.creditCost.base,
      requiredTier: model.tier,
      // Configuration is intentionally distinct from proven render health.
      isConfigured: model.isAvailable,
      maxResolution: { ...model.maxResolution },
    })),
  ];
}

export interface ImageCreationPlan {
  readonly requestedModelId: string;
  readonly modelId: string;
  readonly executionKey: ImageExecutionKey | "auto";
  readonly userTier: string;
  readonly width: number;
  readonly height: number;
  readonly creditCost: number;
  readonly billableModelId?: string;
}

/** Validate and quote before the caller changes a wallet or creates a record. */
export function prepareImageCreation(request: {
  modelId: string;
  userTier: string;
  width: number;
  height: number;
}): ImageCreationPlan {
  if (!Number.isInteger(request.width) || !Number.isInteger(request.height) || request.width < 256 || request.height < 256 || request.width > 1536 || request.height > 1536) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Image dimensions must be whole numbers from 256 to 1536 pixels." });
  }
  const userTier = resolveTierName(request.userTier);
  const tierConfig = getTierConfig(userTier);
  if (request.width > tierConfig.maxImageResolution || request.height > tierConfig.maxImageResolution) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Your plan supports image settings up to ${tierConfig.maxImageResolution}×${tierConfig.maxImageResolution}.` });
  }
  const models = creationModels();
  const automatic = request.modelId === "auto" || request.modelId === "built-in-v1";
  const model = automatic
    ? undefined
    : models.find(
        (candidate) => candidate.id === request.modelId ||
          candidate.imageExecution?.aliases?.includes(request.modelId),
      );

  if (!automatic && !model) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a supported image creation model from the current catalog.",
    });
  }
  if (model && !canAccessModel(userTier, model.tier)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${model.name} requires a ${model.tier} or higher subscription.`,
    });
  }
  if (automatic ? !isAutomaticImageConfigured() : !model?.isAvailable) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "This image model is currently unavailable. No credits charged.",
    });
  }
  if (model && (request.width > model.maxResolution.width || request.height > model.maxResolution.height)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${model.name} supports settings up to ${model.maxResolution.width}×${model.maxResolution.height}. Choose a smaller image size.`,
    });
  }
  return Object.freeze({
    requestedModelId: request.modelId,
    modelId: model?.id ?? "built-in-v1",
    executionKey: model?.imageExecution?.key ?? "auto",
    userTier,
    width: request.width,
    height: request.height,
    creditCost: model?.creditCost.base ?? TOOL_CREDIT_COSTS["text-to-image"],
    billableModelId: model?.id,
  });
}

/** Keep the established moderation, watermark and storage pipeline. */
export async function executeImageCreation(plan: ImageCreationPlan, input: { prompt: string }) {
  const result = await generateImage({
    prompt: input.prompt,
    model: plan.executionKey,
    size: `${plan.width}x${plan.height}`,
    userTier: plan.userTier,
  });
  if (!result.url?.trim()) {
    throw new Error("The image provider returned no downloadable image.");
  }
  return {
    ...result,
    provenance: result.provenance ? { ...result.provenance, requestedModel: plan.requestedModelId } : undefined,
  };
}
