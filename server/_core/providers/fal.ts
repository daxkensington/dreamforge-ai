/**
 * fal.ai provider adapter — Flux Dev/Schnell/Pro Ultra, Seedream, Kontext (image)
 * and Wan 2.5 / Kling 2.5 (video) via fal.ai's queue-based REST API.
 *
 * Auto-activates when FAL_API_KEY is set.
 */

import { storagePut } from "../../storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const FAL_QUEUE_BASE = "https://queue.fal.run";

/** Map our model IDs to fal.ai model slugs. */
const MODEL_SLUGS: Record<string, string> = {
  // Image models
  "fal-flux-dev": "fal-ai/flux/dev",
  "fal-flux-schnell": "fal-ai/flux/schnell",
  "fal-flux-pro-ultra": "fal-ai/flux-pro/v1.1-ultra",
  "fal-seedream": "fal-ai/seedream-3.0",
  "fal-flux-kontext": "fal-ai/flux-kontext/pro",
  // Video models
  "fal-wan-video": "fal-ai/wan/v2.5/1080p",
  "fal-kling-video": "fal-ai/kling-video/v2.5/turbo/image-to-video",
  // Audio models
  "fal-stable-audio": "fal-ai/stable-audio",
};

/** Models that produce video output rather than images. */
const VIDEO_MODELS = new Set(["fal-wan-video", "fal-kling-video"]);

/** Models that produce audio output. */
const AUDIO_MODELS = new Set(["fal-stable-audio"]);

export class FalProvider implements ProviderAdapter {
  readonly provider = "fal";

  get isAvailable(): boolean {
    return !!ENV.falApiKey;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.isAvailable) {
      throw new Error(
        "fal.ai API key is not configured. Set FAL_API_KEY in your environment."
      );
    }

    const slug = MODEL_SLUGS[request.model];
    if (!slug) {
      throw new Error(`Unsupported fal.ai model: ${request.model}`);
    }

    const isVideo = VIDEO_MODELS.has(request.model);
    const isAudio = AUDIO_MODELS.has(request.model);

    try {
      // Build the request body
      const body: Record<string, unknown> = {
        prompt: request.prompt,
      };

      if (isAudio) {
        // Stable Audio params
        const duration = (request.options?.duration as number) || 30;
        body.seconds_total = Math.min(Math.max(duration, 1), 47);
        body.steps = request.steps || 100;
      } else if (!isVideo) {
        // Image generation params
        const width = request.width || 1024;
        const height = request.height || 1024;
        body.image_size = { width, height };

        if (request.negativePrompt) {
          body.negative_prompt = request.negativePrompt;
        }
        if (request.steps) {
          body.num_inference_steps = request.steps;
        }
      } else {
        // Video generation params
        if (request.options?.imageUrl) {
          body.image_url = request.options.imageUrl;
        }
        if (request.options?.duration) {
          body.duration = request.options.duration;
        }
      }

      // Submit to the queue
      const submitResponse = await fetch(`${FAL_QUEUE_BASE}/${slug}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${ENV.falApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!submitResponse.ok) {
        const detail = await submitResponse.text().catch(() => "");
        throw new Error(
          `fal.ai submit error (${submitResponse.status}): ${detail}`
        );
      }

      const { request_id } = (await submitResponse.json()) as {
        request_id: string;
      };

      if (!request_id) {
        throw new Error("fal.ai returned no request_id");
      }

      // Poll for completion (up to 5 minutes for video, 2 minutes for images)
      const maxAttempts = isVideo ? 60 : 30;
      const intervalMs = isVideo ? 5000 : 3000;

      const resultData = await this.pollForResult(slug, request_id, maxAttempts, intervalMs);

      if (isAudio) {
        return this.handleAudioResult(resultData, request);
      }
      if (isVideo) {
        return this.handleVideoResult(resultData, request);
      }
      return this.handleImageResult(resultData, request);
    } catch (error: any) {
      throw new Error(
        `fal.ai generation failed (${request.model}): ${error.message || "Unknown error"}`
      );
    }
  }

  private async pollForResult(
    slug: string,
    requestId: string,
    maxAttempts: number,
    intervalMs: number,
  ): Promise<Record<string, unknown>> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const statusResponse = await fetch(
        `${FAL_QUEUE_BASE}/${slug}/requests/${requestId}/status`,
        {
          headers: { Authorization: `Key ${ENV.falApiKey}` },
        },
      );

      if (!statusResponse.ok) continue;

      const statusData = (await statusResponse.json()) as {
        status: string;
        error?: string;
      };

      if (statusData.status === "COMPLETED") {
        // Fetch the actual result
        const resultResponse = await fetch(
          `${FAL_QUEUE_BASE}/${slug}/requests/${requestId}`,
          {
            headers: { Authorization: `Key ${ENV.falApiKey}` },
          },
        );

        if (!resultResponse.ok) {
          const detail = await resultResponse.text().catch(() => "");
          throw new Error(`Failed to fetch fal.ai result: ${detail}`);
        }

        return (await resultResponse.json()) as Record<string, unknown>;
      }

      if (statusData.status === "FAILED") {
        throw new Error(
          `fal.ai request failed: ${statusData.error || "Unknown error"}`
        );
      }

      // IN_QUEUE or IN_PROGRESS — keep polling
    }

    throw new Error("fal.ai generation timed out");
  }

  private async handleImageResult(
    data: Record<string, unknown>,
    request: GenerationRequest,
  ): Promise<GenerationResult> {
    // fal.ai returns { images: [{ url, content_type, ... }] }
    const images = data.images as Array<{ url: string }> | undefined;
    const imageUrl = images?.[0]?.url;

    if (!imageUrl) {
      throw new Error("fal.ai returned no image data");
    }

    // Download and store in R2
    const downloadResponse = await fetch(imageUrl);
    if (!downloadResponse.ok) {
      throw new Error("Failed to download fal.ai image");
    }

    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    const { url } = await storagePut(
      `generated/fal-${Date.now()}.png`,
      buffer,
      "image/png",
    );

    return {
      id: `fal-${Date.now()}`,
      url,
      model: request.model,
      provider: this.provider,
      metadata: {
        prompt: request.prompt,
        width: request.width,
        height: request.height,
      },
    };
  }

  private async handleAudioResult(
    data: Record<string, unknown>,
    request: GenerationRequest,
  ): Promise<GenerationResult> {
    // Stable Audio returns { audio_file: { url, content_type } }
    const audioFile = data.audio_file as { url: string } | undefined;
    const audioUrl = audioFile?.url;

    if (!audioUrl) {
      throw new Error("fal.ai returned no audio data");
    }

    const downloadResponse = await fetch(audioUrl);
    if (!downloadResponse.ok) {
      throw new Error("Failed to download fal.ai audio");
    }

    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    const { url } = await storagePut(
      `generated/fal-audio-${Date.now()}.mp3`,
      buffer,
      "audio/mpeg",
    );

    return {
      id: `fal-audio-${Date.now()}`,
      url,
      model: request.model,
      provider: this.provider,
      metadata: {
        prompt: request.prompt,
        duration: request.options?.duration,
      },
    };
  }

  private async handleVideoResult(
    data: Record<string, unknown>,
    request: GenerationRequest,
  ): Promise<GenerationResult> {
    // fal.ai video models return { video: { url } } or { output: { url } }
    const video = data.video as { url: string } | undefined;
    const output = data.output as { url: string } | undefined;
    const videoUrl = video?.url || output?.url;

    if (!videoUrl) {
      throw new Error("fal.ai returned no video data");
    }

    // Download and store in R2
    const downloadResponse = await fetch(videoUrl);
    if (!downloadResponse.ok) {
      throw new Error("Failed to download fal.ai video");
    }

    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    const { url } = await storagePut(
      `generated/fal-${Date.now()}.mp4`,
      buffer,
      "video/mp4",
    );

    return {
      id: `fal-${Date.now()}`,
      url,
      model: request.model,
      provider: this.provider,
      metadata: {
        prompt: request.prompt,
        duration: request.options?.duration,
      },
    };
  }
}
