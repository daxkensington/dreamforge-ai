import { getTierConfig, resolveTierName, type TierName } from "./tiers";

export const WORKSPACE_AUTO_IMAGE_MODEL = "built-in-v1";
export const WORKSPACE_AUTO_VIDEO_MODEL = "animatediff-v2";

export interface GenerationRequestIdentity {
  userId: number;
  requestId: string;
  fingerprint: string;
}

type RequestIdentityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function normalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeFingerprintValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, child]) => [key, normalizeFingerprintValue(child)]));
  }
  return value;
}

/** Hash only; the serialized input and prompt are never persisted. */
export async function fingerprintGenerationInput(input: Record<string, unknown>): Promise<string> {
  const { requestId: _requestId, ...payload } = input;
  const bytes = new TextEncoder().encode(JSON.stringify(normalizeFingerprintValue(payload)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function resolveGenerationRequestIdentity(
  previous: GenerationRequestIdentity | null,
  userId: number,
  fingerprint: string,
  createUuid: () => string = () => globalThis.crypto.randomUUID(),
): GenerationRequestIdentity {
  if (!Number.isInteger(userId) || userId <= 0 || !FINGERPRINT_PATTERN.test(fingerprint)) throw new Error("Invalid generation request identity");
  if (isGenerationRequestRetry(previous, userId, fingerprint)) return previous!;
  const requestId = createUuid();
  if (!UUID_PATTERN.test(requestId)) throw new Error("Invalid generation request ID");
  return { userId, requestId, fingerprint };
}

export function isGenerationRequestRetry(previous: GenerationRequestIdentity | null, userId: number, fingerprint: string): boolean {
  return previous?.userId === userId && previous.fingerprint === fingerprint && UUID_PATTERN.test(previous.requestId) && FINGERPRINT_PATTERN.test(fingerprint);
}

export function isTerminalGenerationResult(result: { status?: unknown } | null | undefined): boolean {
  return result?.status === "completed" || result?.status === "failed";
}

function getRequestIdentityStorage(): RequestIdentityStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; } catch { return undefined; }
}

function requestIdentityKey(userId: number): string { return `dreamforgex:generation-request:${userId}`; }

export function readGenerationRequestIdentity(userId: number, storage = getRequestIdentityStorage()): GenerationRequestIdentity | null {
  try {
    const raw = storage?.getItem(requestIdentityKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.userId !== userId || !Number.isInteger(userId) || userId <= 0 || typeof value.requestId !== "string" || !UUID_PATTERN.test(value.requestId) || typeof value.fingerprint !== "string" || !FINGERPRINT_PATTERN.test(value.fingerprint)) return null;
    return { userId, requestId: value.requestId, fingerprint: value.fingerprint };
  } catch { return null; }
}

export function persistGenerationRequestIdentity(identity: GenerationRequestIdentity, storage = getRequestIdentityStorage()): void {
  try {
    if (!Number.isInteger(identity.userId) || identity.userId <= 0 || !UUID_PATTERN.test(identity.requestId) || !FINGERPRINT_PATTERN.test(identity.fingerprint)) return;
    storage?.setItem(requestIdentityKey(identity.userId), JSON.stringify({ userId: identity.userId, requestId: identity.requestId, fingerprint: identity.fingerprint }));
  } catch { /* In-memory identity still protects retries when storage is unavailable. */ }
}

export function clearGenerationRequestIdentity(identity: GenerationRequestIdentity, storage = getRequestIdentityStorage()): void {
  try {
    if (readGenerationRequestIdentity(identity.userId, storage)?.requestId === identity.requestId) storage?.removeItem(requestIdentityKey(identity.userId));
  } catch { /* Storage availability must not turn a confirmed result into an error. */ }
}

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
