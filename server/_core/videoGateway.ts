import { TRPCError } from "@trpc/server";
import { getTierConfig, resolveTierName } from "../../shared/tiers";
import { ENV } from "./env";
import { canAccessModel, listModels } from "./modelRegistry";
import { storagePut, generateStorageKey } from "../storage";
import { fetchGuardedMedia } from "./imageUrlGuard";

// Only executable text-to-video paths belong in the prompt workspace.
// Gen-4 Turbo, Stable Video and fal Kling require an input image.
const DURATIONS: Record<string, readonly number[]> = {
  cogvideo: [6],
  "minimax-video": [6],
  "runway-gen4.5": [5, 8],
  "kling-2.0": [5],
  "kling-1.6": [5],
  "fal-wan-video": [5],
};

export function listVideoCreationModels() {
  return listModels({ type: "video" })
    .filter(model => Object.hasOwn(DURATIONS, model.id) && model.capabilities.includes("text-to-video"))
    .map(model => ({
      id: model.id,
      name: model.id === "minimax-video" ? "MiniMax Hailuo 02" : model.id === "fal-wan-video" ? "Wan 2.5" : model.name,
      provider: model.id === "minimax-video" ? "fal" : model.provider,
      description: model.id === "minimax-video" ? "Six-second text-to-video through fal.ai." : model.description,
      creditCost: model.creditCost.base,
      requiredTier: model.tier,
      isConfigured: model.id === "minimax-video" ? !!ENV.falApiKey : model.isAvailable,
      maxResolution: { ...model.maxResolution },
      supportedDurations: [...DURATIONS[model.id]!],
      outputInfo: model.id === "cogvideo"
        ? "About 6 seconds, fixed 720 × 480 landscape output. Image size controls do not change this model's output."
        : model.id === "fal-wan-video"
          ? "5-second 480p video; portrait, landscape or square framing."
          : "Video uses the selected model's output resolution; width and height select the nearest supported framing.",
    }));
}

export interface VideoCreationPlan {
  readonly modelId: string;
  readonly creditCost: number;
  readonly duration: number;
  readonly aspectRatio: "16:9" | "9:16" | "1:1";
}

export function prepareVideoCreation(input: {
  modelId: string; userTier: string; width: number; height: number; duration: number;
}): VideoCreationPlan {
  const model = listVideoCreationModels().find(candidate => candidate.id === input.modelId);
  if (!model) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a supported video model from the current catalog." });
  const tier = resolveTierName(input.userTier);
  if (!canAccessModel(tier, model.requiredTier as "free" | "creator" | "pro" | "studio")) {
    throw new TRPCError({ code: "FORBIDDEN", message: `${model.name} requires a ${model.requiredTier} or higher subscription.` });
  }
  if (!model.isConfigured) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "This video model is currently unavailable. No credits charged." });
  if (![input.width, input.height].every(size => Number.isInteger(size) && size >= 256 && size <= 1536)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose whole-pixel dimensions between 256 and 1536." });
  }
  const tierLimit = getTierConfig(tier).maxImageResolution;
  if (input.width > tierLimit || input.height > tierLimit) throw new TRPCError({ code: "FORBIDDEN", message: `Your plan supports size settings up to ${tierLimit} pixels.` });
  if (!model.supportedDurations.includes(input.duration)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${model.name} supports ${model.supportedDurations.join(" or ")} seconds. Choose one of those durations.` });
  }
  return Object.freeze({ modelId: model.id, creditCost: model.creditCost, duration: input.duration,
    aspectRatio: input.width === input.height ? "1:1" : input.width > input.height ? "16:9" : "9:16" });
}

/** Refuse images and arbitrary downloads even if a provider labels them video. */
export function videoContainerType(buffer: Buffer): "video/mp4" | "video/webm" {
  let hasVideoTrack = false;
  let hasMediaData = false;
  let hasVideoBrand = false;
  const videoBrands = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V ", "MSNV", "qt  "]);
  const boxes = (start: number, end: number, depth: number): boolean => {
    if (depth > 4) return false;
    let offset = start;
    while (offset < end) {
      if (end - offset < 8) return false;
      let length = buffer.readUInt32BE(offset);
      let header = 8;
      if (length === 1) {
        if (end - offset < 16) return false;
        const extended = buffer.readBigUInt64BE(offset + 8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) return false;
        length = Number(extended); header = 16;
      } else if (length === 0) length = end - offset;
      if (length < header || offset + length > end) return false;
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const data = offset + header;
      if (depth === 0 && type === "ftyp" && length >= header + 8) {
        // AVIF/HEIC use the same ftyp box. Require a video major brand.
        hasVideoBrand = videoBrands.has(buffer.toString("ascii", data, data + 4));
      }
      if (depth === 0 && type === "mdat" && length > header) hasMediaData = true;
      if (depth === 3 && type === "hdlr" && length >= header + 12 && buffer.toString("ascii", data + 8, data + 12) === "vide") hasVideoTrack = true;
      if (["moov", "trak", "mdia"].includes(type) && !boxes(data, offset + length, depth + 1)) return false;
      offset += length;
    }
    return offset === end;
  };
  if (buffer.length >= 40 && boxes(0, buffer.length, 0) && hasVideoBrand && hasVideoTrack && hasMediaData) return "video/mp4";
  // The executable model catalog currently produces MP4. Reject WebM until
  // we have an EBML parser that can prove it contains a complete video track.
  throw new Error("The video provider returned an unsupported or invalid video file.");
}

export async function executeVideoCreation(plan: VideoCreationPlan, input: { prompt: string; negativePrompt?: string }) {
  let buffer: Buffer;
  if (plan.modelId === "cogvideo") {
    const { runpodCogVideo } = await import("./runpod");
    buffer = await runpodCogVideo(input.prompt, 49, 50, 6.0);
  } else {
    let remoteUrl: string | undefined;
    if (plan.modelId === "minimax-video" || plan.modelId === "fal-wan-video") {
      const { falRun } = await import("./fal");
      const response = await falRun<{ video?: { url?: string } }>(
        plan.modelId === "minimax-video"
          ? "fal-ai/minimax/hailuo-02/standard/text-to-video"
          : "fal-ai/wan-25-preview/text-to-video",
        { prompt: input.prompt, duration: String(plan.duration),
          ...(plan.modelId === "minimax-video" ? { prompt_optimizer: true, enable_safety_checker: true }
            : { resolution: "480p", aspect_ratio: plan.aspectRatio, enable_safety_checker: true }) },
        { pollInterval: 5000, maxPolls: 120 },
      );
      remoteUrl = response.video?.url;
    } else if (plan.modelId === "runway-gen4.5") {
      const { RunwayProvider } = await import("./providers/runway");
      remoteUrl = (await new RunwayProvider().generate({ prompt: input.prompt, model: plan.modelId,
        options: { duration: plan.duration, ratio: plan.aspectRatio === "9:16" ? "720:1280" : "1280:720" } })).url;
    } else if (plan.modelId === "kling-2.0" || plan.modelId === "kling-1.6") {
      const { KlingProvider } = await import("./providers/kling");
      remoteUrl = (await new KlingProvider().generate({ prompt: input.prompt, negativePrompt: input.negativePrompt,
        model: plan.modelId, options: { duration: plan.duration, aspectRatio: plan.aspectRatio } })).url;
    } else {
      throw new Error("Unsupported video execution plan.");
    }
    if (!remoteUrl) throw new Error("The video provider returned no downloadable video.");
    ({ buffer } = await fetchGuardedMedia(remoteUrl, { kind: "video", maxBytes: 100 * 1024 * 1024 }));
  }
  const contentType = videoContainerType(buffer);
  const { url } = await storagePut(generateStorageKey("video", contentType === "video/mp4" ? "mp4" : "webm"), buffer, contentType);
  return { url, provenance: { modelId: plan.modelId, duration: plan.duration,
    requestedAspectRatio: plan.aspectRatio,
    ...(plan.modelId === "cogvideo" ? { outputWidth: 720, outputHeight: 480 }
      : plan.modelId === "runway-gen4.5" ? { outputAspectRatio: plan.aspectRatio === "9:16" ? "9:16" : "16:9" } : {}), contentType } };
}
