import sharp from "sharp";

export const DIRECT_IMAGE_MODELS = {
  "gpt-image-2.5-flare": { provider: "openai", model: "gpt-image-2.5-flare-2026-09-08" },
  "gpt-image-2.5-sunburst": { provider: "openai", model: "gpt-image-2.5-sunburst-2026-09-08" },
  "grok-imagine-image-2.0": { provider: "xai", model: "grok-imagine-image-2.0" },
} as const;

export type DirectImageModelId = keyof typeof DIRECT_IMAGE_MODELS;
export type DirectImageProvider = "openai" | "xai";
type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536";
const XAI_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "2:1", "1:2", "19.5:9", "9:19.5", "20:9", "9:20", "21:9", "5:2"] as const;
type XaiAspectRatio = typeof XAI_RATIOS[number];
export type DirectImageOutputControls = { size: OpenAIImageSize } | { resolution: "1k"; aspect_ratio: XaiAspectRatio };
export interface DirectImagePlan {
  modelId: DirectImageModelId;
  provider: DirectImageProvider;
  providerModel: string;
  requestedSize: { width: number; height: number };
  outputControls: DirectImageOutputControls;
  quality: "medium";
  n: 1;
}
export interface DirectImageInput {
  modelId: DirectImageModelId;
  prompt: string;
  width: number;
  height: number;
  /** Supplied by a server caller; this module never loads or stores credentials. */
  apiKey: string;
}
export interface DirectImageResult {
  buffer: Buffer;
  mimeType: "image/png";
  provenance: {
    provider: DirectImageProvider;
    requestedModelId: DirectImageModelId;
    providerModel: string;
    providerRequestId?: string;
    requestedSize: { width: number; height: number };
    /** Request controls are not a claim about what the provider actually served. */
    request: { model: string; quality: "medium"; n: 1 } & DirectImageOutputControls;
    response?: { model?: string; quality?: string; resolution?: string; size?: string };
    decodedSize: { width: number; height: number };
    sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  };
  usage?: Record<string, unknown>;
}

const REJECTION_STATUSES = new Set([401, 403, 404, 429]);
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 8_294_400;

/** A bounded terminal refusal of this POST; this does not certify provider cost. */
export class DirectImageConfirmedRejection extends Error {
  readonly outcome = "confirmed_rejection" as const;
  constructor(readonly provider: DirectImageProvider, readonly model: string, readonly status: number, readonly providerRequestId?: string) {
    if (!REJECTION_STATUSES.has(status)) throw new Error("This HTTP status cannot certify a generation rejection.");
    super(`${provider} rejected the image request (HTTP ${status}).`);
    this.name = "DirectImageConfirmedRejection";
  }
}

/** Never authorize another render or refund solely from an ambiguous outcome. */
export class DirectImageOutcomeUncertain extends Error {
  readonly outcome = "uncertain" as const;
  constructor(readonly provider: DirectImageProvider, readonly model: string, readonly reason: "network" | "timeout" | "cancelled" | "http_error" | "invalid_response", readonly status?: number, readonly providerRequestId?: string) {
    super(`${provider} image outcome is uncertain; reconcile the original request before retrying.`);
    this.name = "DirectImageOutcomeUncertain";
  }
}

export function isConfirmedDirectImageRejection(error: unknown): error is DirectImageConfirmedRejection {
  return error instanceof DirectImageConfirmedRejection && REJECTION_STATUSES.has(error.status);
}

export class DirectImageInputError extends Error {
  constructor(message: string) { super(message); this.name = "DirectImageInputError"; }
}

function nearestRatio<T extends string>(width: number, height: number, choices: readonly T[]): T {
  const target = Math.log(width / height);
  return choices.reduce((best, candidate) => {
    const [cw, ch] = candidate.split(":").map(Number);
    const [bw, bh] = best.split(":").map(Number);
    return Math.abs(Math.log(cw / ch) - target) < Math.abs(Math.log(bw / bh) - target) ? candidate : best;
  });
}

/** Presets are deliberately bounded; callers can display the mapping before billing. */
export function prepareDirectImageRequest(input: Pick<DirectImageInput, "modelId" | "width" | "height">): DirectImagePlan {
  if (!Object.hasOwn(DIRECT_IMAGE_MODELS, input.modelId)) throw new DirectImageInputError("Choose a supported direct image model.");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 256 || input.height < 256 || input.width > 1536 || input.height > 1536) {
    throw new DirectImageInputError("Image dimensions must be whole numbers from 256 to 1536 pixels.");
  }
  const model = DIRECT_IMAGE_MODELS[input.modelId];
  const ratio = nearestRatio(input.width, input.height, ["1:1", "3:2", "2:3"] as const);
  const size: OpenAIImageSize = ratio === "1:1" ? "1024x1024" : ratio === "3:2" ? "1536x1024" : "1024x1536";
  return {
    modelId: input.modelId, provider: model.provider, providerModel: model.model,
    requestedSize: { width: input.width, height: input.height }, quality: "medium", n: 1,
    outputControls: model.provider === "openai" ? { size } : { resolution: "1k", aspect_ratio: nearestRatio(input.width, input.height, XAI_RATIOS) },
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function safeField(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:\/-]{0,199}$/.test(value) ? value : undefined;
}
function safeUsage(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!isRecord(value) || depth > 3) return undefined;
  const retained: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 32)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key)) continue;
    if (entry === null || typeof entry === "number" && Number.isFinite(entry) && entry >= 0) retained[key] = entry;
    else {
      const nested = safeUsage(entry, depth + 1);
      if (nested) retained[key] = nested;
    }
  }
  return Object.keys(retained).length ? retained : undefined;
}

async function decodePng(value: unknown) {
  if (typeof value !== "string") throw new Error("Missing image bytes.");
  const encoded = value.trim();
  if (!encoded || encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error("Invalid image encoding.");
  const source = Buffer.from(encoded, "base64");
  if (!source.length || source.length > MAX_IMAGE_BYTES || source.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) throw new Error("Invalid image encoding.");
  const image = sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: "warning" });
  const metadata = await image.metadata();
  if (!metadata.format || !["png", "jpeg", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image output.");
  // Decode completely so a truncated successful output remains uncertain. The
  // parent PNG storage/watermark path receives accurately typed PNG bytes.
  const output = await image.rotate().png().toBuffer({ resolveWithObject: true });
  if (!output.data.length || !output.info.width || !output.info.height) throw new Error("Empty image output.");
  return { buffer: output.data, size: { width: output.info.width, height: output.info.height }, sourceMimeType: `image/${metadata.format}` as "image/png" | "image/jpeg" | "image/webp" };
}

/** One POST, one explicit model, no fallback, retry, asset download or storage IO. */
export async function generateDirectImage(input: DirectImageInput, options: { fetch?: typeof fetch; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<DirectImageResult> {
  const plan = prepareDirectImageRequest(input);
  if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 16_000) throw new DirectImageInputError("A nonempty image prompt of at most 16000 characters is required.");
  if (typeof input.apiKey !== "string" || !input.apiKey.trim()) throw new DirectImageInputError("The selected image provider is not configured.");
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000) throw new DirectImageInputError("Invalid image request timeout.");
  const controller = new AbortController();
  const timeoutReason = Symbol("direct-image-timeout");
  const abortExternal = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortExternal, { once: true });
  const timer = setTimeout(() => controller.abort(timeoutReason), timeoutMs);
  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new DirectImageOutcomeUncertain(plan.provider, plan.providerModel, controller.signal.reason === timeoutReason ? "timeout" : "cancelled"));
    controller.signal.addEventListener("abort", onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
  });
  const attempt = async (): Promise<DirectImageResult> => {
    const request = { model: plan.providerModel, n: plan.n, quality: plan.quality, ...plan.outputControls };
    let response: Response;
    try {
      response = await (options.fetch ?? globalThis.fetch)(plan.provider === "openai" ? "https://api.openai.com/v1/images/generations" : "https://api.x.ai/v1/images/generations", {
        method: "POST", redirect: "error", headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` }, signal: controller.signal,
        body: JSON.stringify({ ...request, prompt: input.prompt, ...(plan.provider === "openai" ? { output_format: "png" } : { response_format: "b64_json" }) }),
      });
    } catch { throw new DirectImageOutcomeUncertain(plan.provider, plan.providerModel, "network"); }
    const providerRequestId = safeField(response.headers.get("x-request-id"));
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      if (REJECTION_STATUSES.has(response.status)) throw new DirectImageConfirmedRejection(plan.provider, plan.providerModel, response.status, providerRequestId);
      throw new DirectImageOutcomeUncertain(plan.provider, plan.providerModel, "http_error", response.status, providerRequestId);
    }
    try {
      const body: unknown = await response.json();
      if (!isRecord(body) || !Array.isArray(body.data) || body.data.length !== 1 || !isRecord(body.data[0])) throw new Error("Unexpected image response.");
      const output = await decodePng(body.data[0].b64_json);
      const reported = Object.fromEntries(["model", "quality", "resolution", "size"].flatMap((key) => {
        const value = safeField(body[key]); return value ? [[key, value]] : [];
      }));
      return {
        buffer: output.buffer, mimeType: "image/png",
        provenance: {
          provider: plan.provider, requestedModelId: plan.modelId, providerModel: plan.providerModel,
          ...(providerRequestId || safeField(body.request_id) ? { providerRequestId: providerRequestId ?? safeField(body.request_id) } : {}),
          requestedSize: plan.requestedSize, request, ...(Object.keys(reported).length ? { response: reported } : {}),
          decodedSize: output.size, sourceMimeType: output.sourceMimeType,
        },
        ...(safeUsage(body.usage) ? { usage: safeUsage(body.usage) } : {}),
      };
    } catch { throw new DirectImageOutcomeUncertain(plan.provider, plan.providerModel, "invalid_response", response.status, providerRequestId); }
  };
  try {
    return await Promise.race([controller.signal.aborted ? aborted : attempt(), aborted]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortExternal);
    controller.signal.removeEventListener("abort", onAbort!);
  }
}
