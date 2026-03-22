/**
 * Generation Engine — routes generation requests to the correct provider
 * based on the selected model, after validating tier access.
 */

import type { AIModel } from "./modelRegistry";
import { canAccessModel, getModelById } from "./modelRegistry";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./providers/base";
import { ForgeProvider } from "./providers/forge";
import { OpenAIProvider } from "./providers/openai";
import { ReplicateProvider } from "./providers/replicate";
import { StabilityProvider } from "./providers/stability";

// ─── Provider Instances (singletons) ───────────────────────────────────────

const providers: Record<string, ProviderAdapter> = {
  forge: new ForgeProvider(),
  stability: new StabilityProvider(),
  openai: new OpenAIProvider(),
  replicate: new ReplicateProvider(),
};

// ─── Engine Request / Result types ─────────────────────────────────────────

export interface EngineGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  modelId: string;
  userTier: AIModel["tier"];
  options?: Record<string, unknown>;
}

export interface EngineGenerationResult extends GenerationResult {
  creditCost: number;
}

// ─── Main entry point ──────────────────────────────────────────────────────

export async function runGeneration(
  request: EngineGenerationRequest
): Promise<EngineGenerationResult> {
  // 1. Look up the model
  const model = getModelById(request.modelId);
  if (!model) {
    throw new Error(`Unknown model: ${request.modelId}`);
  }

  // 2. Check availability
  if (!model.isAvailable) {
    throw new Error(`Model "${model.name}" is currently unavailable`);
  }

  // 3. Check tier access
  if (!canAccessModel(request.userTier, model.tier)) {
    throw new Error(
      `Your "${request.userTier}" tier does not have access to "${model.name}". ` +
        `Upgrade to "${model.tier}" or higher to use this model.`
    );
  }

  // 4. Validate resolution against model limits
  const width = request.width ?? model.maxResolution.width;
  const height = request.height ?? model.maxResolution.height;
  if (
    model.maxResolution.width > 0 &&
    (width > model.maxResolution.width || height > model.maxResolution.height)
  ) {
    throw new Error(
      `Requested resolution ${width}x${height} exceeds "${model.name}" max of ` +
        `${model.maxResolution.width}x${model.maxResolution.height}`
    );
  }

  // 5. Route to the correct provider
  const adapter = providers[model.provider];
  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${model.provider}`);
  }

  const genRequest: GenerationRequest = {
    prompt: request.prompt,
    negativePrompt: request.negativePrompt,
    width,
    height,
    steps: request.steps,
    model: request.modelId,
    options: request.options,
  };

  const result = await adapter.generate(genRequest);

  // 6. Calculate credit cost
  const creditCost = calculateCreditCost(model, request);

  return {
    ...result,
    creditCost,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function calculateCreditCost(
  model: AIModel,
  request: EngineGenerationRequest
): number {
  const quality = request.options?.quality as string | undefined;

  if (quality === "ultra" && model.creditCost.ultra) {
    return model.creditCost.ultra;
  }
  if (quality === "hd" && model.creditCost.hd) {
    return model.creditCost.hd;
  }
  return model.creditCost.base;
}
