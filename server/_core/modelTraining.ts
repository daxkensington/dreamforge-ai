/**
 * Custom Model Training — LoRA fine-tuning via Replicate.
 *
 * Users upload 5-20 images of a subject (face, product, style).
 * Replicate trains a LoRA adapter on Flux or SDXL.
 * The trained model can then be used for consistent generation.
 */

import { ENV } from "./env";

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

/**
 * Start a LoRA training job on Replicate.
 * Returns the training ID for status polling.
 */
export async function startTraining(request: TrainingRequest): Promise<TrainingResult> {
  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN required for model training");
  }

  if (request.imageUrls.length < 5) {
    throw new Error("At least 5 training images required");
  }
  if (request.imageUrls.length > 20) {
    throw new Error("Maximum 20 training images allowed");
  }

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
 * Check training status.
 */
export async function getTrainingStatus(trainingId: string): Promise<TrainingResult> {
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

/**
 * Generate an image using a trained LoRA model.
 */
export async function generateWithLoRA(
  modelVersion: string,
  prompt: string,
  triggerWord: string,
): Promise<string> {
  if (!ENV.replicateApiToken) {
    throw new Error("REPLICATE_API_TOKEN required");
  }

  const { replicatePredict } = await import("./replicate");

  // Ensure trigger word is in the prompt
  const fullPrompt = prompt.includes(triggerWord) ? prompt : `${triggerWord} ${prompt}`;

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
