/**
 * Image generation using Grok (xAI) with OpenAI DALL-E fallback.
 *
 * Usage:
 *   const { url } = await generateImage({ prompt: "A serene landscape" });
 */
import { storagePut, generateStorageKey } from "../storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
  model?: "grok" | "dall-e-3" | "gemini";
  size?: string;
};

export type GenerateImageResponse = {
  url?: string;
};

/**
 * Generate image via Grok (xAI) API
 */
async function generateWithGrok(prompt: string): Promise<Buffer> {
  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.grokApiKey}`,
    },
    body: JSON.stringify({
      model: "grok-2-image",
      prompt,
      n: 1,
      response_format: "url",
    }),
  });

  if (!response.ok) {
    // Try alternate model name
    const response2 = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.grokApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt,
        n: 1,
        response_format: "url",
      }),
    });

    if (!response2.ok) {
      const detail = await response2.text().catch(() => "");
      throw new Error(`Grok image generation failed (${response2.status}): ${detail}`);
    }

    const result = await response2.json() as any;
    const imageUrl = result.data?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned from Grok");

    const imageResp = await fetch(imageUrl);
    return Buffer.from(await imageResp.arrayBuffer());
  }

  const result = await response.json() as any;
  const imageUrl = result.data?.[0]?.url;
  if (!imageUrl) throw new Error("No image URL returned from Grok");

  const imageResp = await fetch(imageUrl);
  return Buffer.from(await imageResp.arrayBuffer());
}

/**
 * Generate image via OpenAI DALL-E 3
 */
async function generateWithDallE(prompt: string, size: string = "1024x1024"): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`DALL-E generation failed (${response.status}): ${detail}`);
  }

  const result = await response.json() as any;
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned from DALL-E");

  return Buffer.from(b64, "base64");
}

/**
 * Main image generation function — tries Grok first, falls back to DALL-E.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const { prompt, model } = options;
  let imageBuffer: Buffer;

  // Try specified model, or auto-select based on available keys
  if (model === "dall-e-3" && ENV.openaiApiKey) {
    imageBuffer = await generateWithDallE(prompt, options.size);
  } else if (model === "grok" && ENV.grokApiKey) {
    imageBuffer = await generateWithGrok(prompt);
  } else if (ENV.grokApiKey) {
    // Default: try Grok first
    try {
      imageBuffer = await generateWithGrok(prompt);
    } catch (grokError) {
      console.warn("[ImageGen] Grok failed, falling back to DALL-E:", grokError);
      if (ENV.openaiApiKey) {
        imageBuffer = await generateWithDallE(prompt, options.size);
      } else {
        throw grokError;
      }
    }
  } else if (ENV.openaiApiKey) {
    imageBuffer = await generateWithDallE(prompt, options.size);
  } else {
    throw new Error("No image generation API key configured. Set GROK_API_KEY or OPENAI_API_KEY.");
  }

  // Save to R2 storage
  const key = generateStorageKey("generations", "png");
  const { url } = await storagePut(key, imageBuffer, "image/png");

  return { url };
}
