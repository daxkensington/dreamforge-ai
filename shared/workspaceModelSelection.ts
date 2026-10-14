import { getTierConfig, resolveTierName, type TierName } from "./tiers";

export const WORKSPACE_AUTO_IMAGE_MODEL = "built-in-v1";
export const WORKSPACE_AUTO_VIDEO_MODEL = "animatediff-v2";

/** Public catalog metadata only; provider credentials never reach the picker. */
export interface WorkspaceImageModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  creditCost: number;
  requiredTier: string;
  isConfigured: boolean;
  maxResolution: { width: number; height: number };
}

const TIER_ORDER: TierName[] = ["free", "creator", "pro", "studio", "business", "agency"];

export function hasWorkspaceModelAccess(userTier: string, requiredTier: string): boolean {
  // Unknown requirements must not accidentally become Free through tier fallback.
  if (!TIER_ORDER.includes(requiredTier as TierName)) return false;
  return TIER_ORDER.indexOf(resolveTierName(userTier)) >= TIER_ORDER.indexOf(requiredTier as TierName);
}

/** Recheck immediately before submission, including after catalog refreshes. */
export function getWorkspaceImageSelectionError(input: {
  modelId: string;
  catalog: readonly WorkspaceImageModel[] | undefined;
  catalogReady: boolean;
  userTier: string;
  planReady: boolean;
  width: number;
  height: number;
}): string | null {
  if (![input.width, input.height].every((size) => Number.isInteger(size) && size >= 256 && size <= 1536)) {
    return "Choose whole-pixel image dimensions between 256 and 1536.";
  }
  const plan = getTierConfig(input.planReady ? input.userTier : "free");
  if (input.width > plan.maxImageResolution || input.height > plan.maxImageResolution) {
    return `${plan.displayName} supports images up to ${plan.maxImageResolution} × ${plan.maxImageResolution}. Choose a smaller image size.`;
  }
  const isAuto = input.modelId === WORKSPACE_AUTO_IMAGE_MODEL;
  if (!input.catalogReady) {
    return isAuto ? null : "Refresh the image models before using this model, or choose Auto.";
  }

  const model = input.catalog?.find((entry) => entry.id === input.modelId);
  if (!model) return "This image model is no longer available. Choose Auto or another model.";
  if (!model.isConfigured) return "This image model is currently unavailable. Choose another model or refresh the list.";

  if (model.requiredTier !== "free" && !input.planReady) {
    return "Your subscription is still being checked. Try again or choose Auto.";
  }
  if (!hasWorkspaceModelAccess(input.userTier, model.requiredTier)) {
    return `${model.name} requires ${getTierConfig(model.requiredTier).displayName} or higher.`;
  }
  if (input.width > model.maxResolution.width || input.height > model.maxResolution.height) {
    return `${model.name} supports up to ${model.maxResolution.width} × ${model.maxResolution.height}. Choose a smaller image size.`;
  }
  return null;
}
