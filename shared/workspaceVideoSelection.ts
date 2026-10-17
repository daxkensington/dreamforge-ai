import { hasWorkspaceModelAccess } from "./workspaceModelSelection";

export interface WorkspaceVideoModel {
  id: string;
  creditCost: number;
  requiredTier: string;
  isConfigured: boolean;
  supportedDurations: readonly number[];
}
export function initialWorkspaceVideoModel<T extends WorkspaceVideoModel>(catalog: readonly T[] | undefined, tier: string): T | undefined {
  return catalog?.filter(model => model.isConfigured && hasWorkspaceModelAccess(tier, model.requiredTier))
    .sort((left, right) => left.creditCost - right.creditCost)[0];
}
export function workspaceVideoSelectionError(input: {
  catalog: readonly WorkspaceVideoModel[] | undefined;
  catalogReady: boolean;
  planReady: boolean;
  userTier: string;
  modelId: string;
  duration: number;
}): string | null {
  if (!input.catalogReady) return "Load the current video model catalog before generating.";
  if (!input.planReady) return "Your subscription is still being checked. Please try again.";
  const model = input.catalog?.find(item => item.id === input.modelId);
  if (!model) return "Choose a video model from the current catalog.";
  if (!model.isConfigured) return "This video model is unavailable. Choose another model.";
  if (!hasWorkspaceModelAccess(input.userTier, model.requiredTier)) return "This video model requires a higher subscription tier.";
  if (!Number.isSafeInteger(model.creditCost) || model.creditCost <= 0) return "A valid video credit quote is required.";
  if (!model.supportedDurations.includes(input.duration)) return "Choose a supported duration for this video model.";
  return null;
}
