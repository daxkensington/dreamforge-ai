/**
 * Kling AI provider adapter — Kling 2.0 Master video generation.
 * Auto-activates when KLING_API_KEY is set.
 *
 * Kling uses JWT-based auth: an access key + secret are used to sign
 * a short-lived JWT for each request.
 */

import { storagePut } from "../../storage";
import { ENV } from "../env";
import type { GenerationRequest, GenerationResult, ProviderAdapter } from "./base";

const KLING_API_BASE = "https://api.klingai.com/v1/videos/text2video";
const KLING_I2V_BASE = "https://api.klingai.com/v1/videos/image2video";

/** Kling model identifiers. */
const MODEL_IDS: Record<string, string> = {
  "kling-2.0": "kling-v2-1-master",
  "kling-1.6": "kling-v1-6",
};

export class KlingProvider implements ProviderAdapter {
  readonly provider = "kling";

  get isAvailable(): boolean {
    return !!ENV.klingAccessKey && !!ENV.klingSecretKey;
  }

  private async getAuthToken(): Promise<string> {
    // Kling uses a JWT signed with the secret key
    // The JWT contains: header {alg: HS256, typ: JWT}, payload {iss: accessKey, exp: now+1800, iat: now}
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({ iss: ENV.klingAccessKey, exp: now + 1800, iat: now })
    ).toString("base64url");

    const { createHmac } = await import("crypto");
    const signature = createHmac("sha256", ENV.klingSecretKey)
      .update(`${header}.${payload}`)
      .digest("base64url");

    return `${header}.${payload}.${signature}`;
  }

  async generate(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.isAvailable) {
      throw new Error(
        "Kling API keys are not configured. Set KLING_ACCESS_KEY and KLING_SECRET_KEY in your environment."
      );
    }

    const modelId = MODEL_IDS[request.model] || "kling-v2-master";
    const token = await this.getAuthToken();

    try {
      const isImageToVideo = !!request.options?.imageUrl;
      const endpoint = isImageToVideo ? KLING_I2V_BASE : KLING_API_BASE;

      const body: Record<string, unknown> = {
        model_name: modelId,
        prompt: request.prompt,
        duration: String((request.options?.duration as number) || 5),
        aspect_ratio: "16:9",
        mode: "std",
      };

      if (request.negativePrompt) {
        body.negative_prompt = request.negativePrompt;
      }

      if (isImageToVideo) {
        body.image_url = request.options!.imageUrl;
      }

      // Create task
      const createResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!createResponse.ok) {
        const detail = await createResponse.text().catch(() => "");
        throw new Error(
          `Kling API error (${createResponse.status} ${createResponse.statusText})${detail ? `: ${detail}` : ""}`
        );
      }

      const createData = (await createResponse.json()) as {
        code: number;
        data: { task_id: string };
        message?: string;
      };

      if (createData.code !== 0) {
        throw new Error(`Kling API error: ${createData.message || "Unknown"}`);
      }

      const taskId = createData.data.task_id;
      const pollEndpoint = isImageToVideo ? KLING_I2V_BASE : KLING_API_BASE;

      // Poll for completion
      const videoUrl = await this.pollForResult(taskId, token, pollEndpoint);

      // Download and store the video
      const downloadResponse = await fetch(videoUrl);
      if (!downloadResponse.ok) {
        throw new Error("Failed to download Kling output");
      }

      const buffer = Buffer.from(await downloadResponse.arrayBuffer());
      const { url } = await storagePut(
        `generated/kling-${Date.now()}.mp4`,
        buffer,
        "video/mp4"
      );

      return {
        id: `kling-${taskId}`,
        url,
        model: request.model,
        provider: this.provider,
        metadata: {
          prompt: request.prompt,
          duration: body.duration,
          klingTaskId: taskId,
        },
      };
    } catch (error: any) {
      throw new Error(
        `Kling generation failed: ${error.message || "Unknown error"}`
      );
    }
  }

  private async pollForResult(
    taskId: string,
    token: string,
    baseEndpoint: string,
    maxAttempts = 120,
    intervalMs = 5000
  ): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      // Re-auth in case token expires during long polls
      const currentToken = i > 0 && i % 30 === 0 ? await this.getAuthToken() : token;

      const response = await fetch(`${baseEndpoint}/${taskId}`, {
        headers: {
          authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as {
        code: number;
        data: {
          task_status: string;
          task_result?: { videos?: Array<{ url: string }> };
        };
      };

      const status = data.data?.task_status;

      if (status === "succeed" && data.data.task_result?.videos?.[0]?.url) {
        return data.data.task_result.videos[0].url;
      }
      if (status === "failed") {
        throw new Error("Kling video generation failed");
      }
    }

    throw new Error("Kling generation timed out");
  }
}
