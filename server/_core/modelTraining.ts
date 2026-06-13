/**
 * Custom Model Training — LoRA fine-tuning via fal.ai (primary) or Replicate.
 *
 * Users upload 5-20 images of a subject (face, product, style).
 * fal-ai/flux-lora-fast-training trains a Flux LoRA from a zip of the images;
 * the trained safetensors URL is then usable with fal-ai/flux-lora.
 * Replicate (ostris/flux-dev-lora-trainer) is kept as the fallback path for
 * when its token is rotated — fal IDs are namespaced "fal:<request_id>" so
 * status polling routes to the right provider.
 *
 * NOTE: not yet wired to any router — Agency-tier copy promises custom LoRAs
 * but the feature was never exposed. This module is provider-ready for when
 * it is.
 */

import JSZip from "jszip";
import { ENV } from "./env";
import { storagePut } from "../storage";
import { falRun, isFalAvailable, type FalFile } from "./fal";

export interface TrainingRequest {
  /** User-provided name for this model */
  name: string;
  /** Type of training: face consistency, style, product, object */
  type: "face" | "style" | "product" | "object";
  /** URLs of uploaded training images (5-20) */
  imageUrls: string[];
  /** Trigger word that activates the LoRA */
  triggerWord: string;
  /** Training steps (more = better quality but slower) */
  steps?: number;
}

export interface TrainingResult {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed";
  modelUrl?: string;
  version?: string;
  error?: string;
  logs?: string;
}

const REPLICATE_API = "https://api.replicate.com/v1";
const FAL_TRAINER = "fal-ai/flux-lora-fast-training";

/**
 * Start a LoRA training job. fal.ai first, Replicate fallback.
 * Returns the training ID for status polling.
 */
export async function startTraining(request: TrainingRequest): Promise<TrainingResult> {
  if (!isFalAvailable() && !ENV.replicateApiToken) {
    throw new Error("No training provider configured (need FAL_API_KEY or REPLICATE_API_TOKEN)");
  }

  if (request.imageUrls.length < 5) {
    throw new Error("At least 5 training images required");
  }
  if (request.imageUrls.length > 20) {
    throw new Error("Maximum 20 training images allowed");
  }

  if (isFalAvailable()) {
    return startFalTraining(request);
  }
  return startReplicateTraining(request);
}

/** fal trainer needs ONE zip archive URL, not a list of image URLs. */
async function startFalTraining(request: TrainingRequest): Promise<TrainingResult> {
  const zip = new JSZip();
  for (let i = 0; i < request.imageUrls.length; i++) {
    const resp = await fetch(request.imageUrls[i]);
    if (!resp.ok) throw new Error(`Failed to fetch training image ${i + 1} (${resp.status})`);
    const ext = (resp.headers.get("content-type") ?? "").includes("png") ? "png" : "jpg";
    zip.file(`image_${String(i + 1).padStart(2, "0")}.${ext}`, await resp.arrayBuffer());
  }
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const { url: archiveUrl } = await storagePut(
    `training/archive_${Date.now()}.zip`,
    zipBuffer,
    "application/zip",
  );

  const submitResponse = await fetch(`https://queue.fal.run/${FAL_TRAINER}`, {
    method: "POST",
    headers: { Authorization: `Key ${ENV.falApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      images_data_url: archiveUrl,
      trigger_word: request.triggerWord,
      steps: request.steps || (request.type === "face" ? 1200 : 800),
      is_style: request.type === "style",
      create_masks: request.type === "face",
    }),
  });
  if (!submitResponse.ok) {
    const detail = await submitResponse.text().catch(() => "");
    throw new Error(`Training failed to start: ${detail}`);
  }
  const submitted = (await submitResponse.json()) as { request_id?: string };
  if (!submitted.request_id) throw new Error("fal.ai returned no request_id");

  return { id: `fal:${submitted.request_id}`, status: "starting" };
}

async function startReplicateTraining(request: TrainingRequest): Promise<TrainingResult> {
  const steps = request.steps || (request.type === "face" ? 1200 : 800);

  // Use Replicate's Flux LoRA training
  const response = await fetch(`${REPLICATE_API}/models/ostris/flux-dev-lora-trainer/versions`, {
    headers: { Authorization: `Bearer ${ENV.replicateApiToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch training model");
  }

  const versions = await response.json();
  const latestVersion = versions.results?.[0]?.id;

  if (!latestVersion) {
    throw new Error("No training model version available");
  }

  // Create the training
  const trainingResponse = await fetch(`${REPLICATE_API}/trainings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.replicateApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: latestVersion,
      input: {
        input_images: request.imageUrls.join("\n"),
        trigger_word: request.triggerWord,
        steps,
        learning_rate: 0.0004,
        batch_size: 1,
        resolution: "512,768,1024",
        autocaption: true,
        autocaption_prefix: `a photo of ${request.triggerWord},`,
      },
      destination: `dreamforgex/${request.triggerWord.toLowerCase().replace(/\s+/g, "-")}`,
    }),
  });

  if (!trainingResponse.ok) {
    const detail = await trainingResponse.text().catch(() => "");
    throw new Error(`Training failed to start: ${detail}`);
  }

  const training = await trainingResponse.json();

  return {
    id: training.id,
    status: training.status || "starting",
    modelUrl: training.urls?.get,
  };
}

/**
 * Check training status. Routes by ID namespace: "fal:<id>" → fal queue,
 * anything else → Replicate.
 */
export async function getTrainingStatus(trainingId: string): Promise<TrainingResult> {
  if (trainingId.startsWith("fal:")) {
    return getFalTrainingStatus(trainingId);
  }

  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN required");
  }

  const response = await fetch(`${REPLICATE_API}/trainings/${trainingId}`, {
    headers: { Authorization: `Bearer ${ENV.replicateApiToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch training status");
  }

  const training = await response.json();

  return {
    id: training.id,
    status: training.status,
    modelUrl: training.output?.version ? `${training.output.version}` : undefined,
    version: training.output?.version,
    error: training.error,
    logs: training.logs,
  };
}

async function getFalTrainingStatus(trainingId: string): Promise<TrainingResult> {
  const requestId = trainingId.slice(4);
  const headers = { Authorization: `Key ${ENV.falApiKey}` };
  // FAL_TRAINER is a root model path (no subpath), so building request URLs
  // from it is safe — unlike subpath models such as fal-ai/flux/schnell.
  const base = `https://queue.fal.run/${FAL_TRAINER}/requests/${requestId}`;

  const statusResp = await fetch(`${base}/status`, { headers });
  if (!statusResp.ok) throw new Error(`Failed to fetch training status (${statusResp.status})`);
  const status = (await statusResp.json()) as { status: string; error?: string };

  if (status.status === "COMPLETED") {
    const resultResp = await fetch(base, { headers });
    if (!resultResp.ok) throw new Error("Failed to fetch training result");
    const result = (await resultResp.json()) as { diffusers_lora_file?: FalFile };
    const loraUrl = result.diffusers_lora_file?.url;
    return {
      id: trainingId,
      status: loraUrl ? "succeeded" : "failed",
      modelUrl: loraUrl,
      version: loraUrl,
      error: loraUrl ? undefined : "Training completed but returned no LoRA file",
    };
  }
  if (status.status === "FAILED") {
    return { id: trainingId, status: "failed", error: status.error || "Training failed" };
  }
  return { id: trainingId, status: status.status === "IN_QUEUE" ? "starting" : "processing" };
}

/**
 * Generate an image using a trained LoRA model. A modelVersion that is a URL
 * is a fal-trained safetensors file (use fal-ai/flux-lora); otherwise it's a
 * Replicate model version.
 */
export async function generateWithLoRA(
  modelVersion: string,
  prompt: string,
  triggerWord: string,
): Promise<string> {
  // Ensure trigger word is in the prompt
  const fullPrompt = prompt.includes(triggerWord) ? prompt : `${triggerWord} ${prompt}`;

  if (modelVersion.startsWith("http")) {
    const result = await falRun<{ images?: Array<{ url: string }> }>(
      "fal-ai/flux-lora",
      {
        prompt: fullPrompt,
        loras: [{ path: modelVersion, scale: 1 }],
        num_inference_steps: 28,
        guidance_scale: 7.5,
      },
      { pollInterval: 2000, maxPolls: 60 },
    );
    const url = result.images?.[0]?.url;
    if (!url) throw new Error("fal.ai flux-lora returned no image");
    return url;
  }

  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN required");
  }

  const { replicatePredict } = await import("./replicate");

  return replicatePredict({
    version: modelVersion,
    input: {
      prompt: fullPrompt,
      num_inference_steps: 28,
      guidance_scale: 7.5,
    },
    maxAttempts: 60,
    pollInterval: 2000,
  });
}
