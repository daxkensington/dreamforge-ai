/**
 * Generation Engine — routes generation requests to the correct provider
 * based on the selected model, after validating tier access.
 *
 * Supports automatic fallback: if the requested provider fails,
 * the engine can try other available providers of the same type.
 */

import type { AIModel } from "./modelRegistry";
import { canAccessModel, getModelById, listModels } from "./modelRegistry";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./providers/base";
import { GrokProvider } from "./providers/grok";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";

// ─── Provider Instances (lazy singletons) ─────────────────────────────────

let _providers: Record<string, ProviderAdapter> | null = null;

function getProviders(): Record<string, ProviderAdapter> {
  if (!_providers) {
    _providers = {
      grok: new GrokProvider(),
      openai: new OpenAIProvider(),
      gemini: new GeminiProvider(),
    };
  }
  return _providers;
}

// ─── Engine Request / Result types ─────────────────────────────────────────

export interface EngineGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  modelId: string;
  userTier: AIModel["tier"];
  quality?: "standard" | "hd";
  style?: "natural" | "vivid";
  /** If true, try other providers when the selected one fails. Default: true. */
  autoFallback?: boolean;
  options?: Record<string, unknown>;
}

export interface EngineGenerationResult extends GenerationResult {
  creditCost: number;
}

// ─── Main entry point ──────────────────────────────────────────────────────

export async function runGeneration(
  request: EngineGenerationRequest,
): Promise<EngineGenerationResult> {
  // 1. Look up the model
  const model = getModelById(request.modelId);
  if (!model) {
    throw new Error(`Unknown model: ${request.modelId}`);
  }

  // 2. Check availability
  if (!model.isAvailable) {
    throw new Error(`Model "${model.name}" is currently unavailable (API key not configured)`);
  }

  // 3. Check tier access
  if (!canAccessModel(request.userTier, model.tier)) {
    throw new Error(
      `Your "${request.userTier}" tier does not have access to "${model.name}". ` +
        `Upgrade to "${model.tier}" or higher to use this model.`,
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
        `${model.maxResolution.width}x${model.maxResolution.height}`,
    );
  }

  // 5. Route to the correct provider
  const providers = getProviders();
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
    quality: request.quality ?? (request.options?.quality as "standard" | "hd" | undefined),
    style: request.style ?? (request.options?.style as "natural" | "vivid" | undefined),
    options: request.options,
  };

  try {
    const result = await adapter.generate(genRequest);
    const creditCost = calculateCreditCost(model, request);
    return { ...result, creditCost };
  } catch (primaryError: any) {
    // 6. Auto-fallback to other available providers of the same type
    if (request.autoFallback !== false) {
      const fallbackResult = await tryFallbackProviders(
        model,
        genRequest,
        request,
        primaryError,
      );
      if (fallbackResult) return fallbackResult;
    }

    throw primaryError;
  }
}

// ─── Fallback Logic ────────────────────────────────────────────────────────

async function tryFallbackProviders(
  originalModel: AIModel,
  genRequest: GenerationRequest,
  engineRequest: EngineGenerationRequest,
  primaryError: Error,
): Promise<EngineGenerationResult | null> {
  const providers = getProviders();

  // Find other available models of the same type
  const fallbackModels = listModels({
    type: originalModel.type,
    availableOnly: true,
  }).filter((m) => m.id !== originalModel.id);

  for (const fallbackModel of fallbackModels) {
    const adapter = providers[fallbackModel.provider];
    if (!adapter || !adapter.isAvailable) continue;

    // Check tier access for fallback
    if (!canAccessModel(engineRequest.userTier, fallbackModel.tier)) continue;

    try {
      console.warn(
        `[Engine] ${originalModel.name} failed (${primaryError.message}), trying ${fallbackModel.name}...`,
      );

      const fallbackRequest = { ...genRequest, model: fallbackModel.id };
      const result = await adapter.generate(fallbackRequest);
      const creditCost = calculateCreditCost(fallbackModel, engineRequest);

      return { ...result, creditCost };
    } catch (err: any) {
      console.warn(`[Engine] Fallback ${fallbackModel.name} also failed: ${err.message}`);
    }
  }

  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function calculateCreditCost(
  model: AIModel,
  request: EngineGenerationRequest,
): number {
  const quality =
    request.quality ?? (request.options?.quality as string | undefined);

  if (quality === "ultra" && model.creditCost.ultra) {
    return model.creditCost.ultra;
  }
  if (quality === "hd" && model.creditCost.hd) {
    return model.creditCost.hd;
  }
  return model.creditCost.base;
}
