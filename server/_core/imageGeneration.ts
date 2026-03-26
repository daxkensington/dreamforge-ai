/**
 * Image generation with multi-provider fallback.
 *
 * Provider priority (auto mode, cost-optimized):
 *   FREE:  1. Gemini  2. Together AI (Flux Schnell)  3. Cloudflare Workers AI
 *   CHEAP: 4. Grok  5. Flux Schnell (Replicate)
 *   PAID:  6. DALL-E 3  7. SD3  8. Flux Pro
 *
 * When originalImages are provided, uses LLM vision to analyze the source
 * image(s) first, then enriches the prompt with that description before
 * generating — since Grok/DALL-E 3 don't support native img2img.
 *
 * Usage:
 *   const { url } = await generateImage({ prompt: "A serene landscape" });
 *   const { url } = await generateImage({ prompt: "...", model: "dall-e-3", quality: "hd" });
 */
import { storagePut, generateStorageKey } from "../storage";
import { invokeLLM } from "./llm";
import { ENV } from "./env";
import { replicatePredict, downloadBuffer } from "./replicate";

export type GenerateImageOptions = {
  prompt: string;
  model?: "grok" | "dall-e-3" | "gemini" | "flux-pro" | "flux-schnell" | "sd3" | "together" | "cloudflare" | "auto";
  size?: string; // "1024x1024", "1024x1792", "1792x1024"
  quality?: "standard" | "hd";
  style?: "natural" | "vivid";
  /** User tier — free tier gets watermarked output */
  userTier?: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

// ─── Provider Implementations ──────────────────────────────────────────────

/**
 * Generate image via Grok (xAI) API.
 * Tries grok-2-image first, falls back to grok-imagine-image.
 */
async function generateWithGrok(
  prompt: string,
  size: string = "1024x1024",
): Promise<Buffer> {
  const models = ["grok-2-image", "grok-imagine-image"];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const response = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ENV.grokApiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size,
          response_format: "b64_json",
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        lastError = new Error(`Grok ${model} failed (${response.status}): ${detail}`);
        continue;
      }

      const result = (await response.json()) as any;

      // Handle base64 response
      const b64 = result.data?.[0]?.b64_json;
      if (b64) {
        return Buffer.from(b64, "base64");
      }

      // Handle URL response as fallback
      const imageUrl = result.data?.[0]?.url;
      if (imageUrl) {
        const imageResp = await fetch(imageUrl);
        if (!imageResp.ok) throw new Error(`Failed to download Grok image: ${imageResp.status}`);
        return Buffer.from(await imageResp.arrayBuffer());
      }

      lastError = new Error(`Grok ${model} returned no image data`);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Grok image generation failed");
}

/**
 * Generate image via OpenAI DALL-E 3.
 */
async function generateWithDallE(
  prompt: string,
  size: string = "1024x1024",
  quality: "standard" | "hd" = "standard",
  style: "natural" | "vivid" = "vivid",
): Promise<Buffer> {
  const validSize = resolveDallESize(size);

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
      size: validSize,
      quality,
      style,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`DALL-E 3 failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as any;
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("DALL-E 3 returned no image data");

  return Buffer.from(b64, "base64");
}

/**
 * Generate image via Gemini (gemini-2.0-flash-preview-image-generation).
 * Uses the REST API with responseModalities: ["TEXT", "IMAGE"].
 */
async function generateWithGemini(prompt: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${ENV.geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini image gen failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as any;

  // Find the inline_data part with the image
  const candidates = result.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data || part.inline_data?.data) {
        const data = part.inlineData?.data ?? part.inline_data?.data;
        return Buffer.from(data, "base64");
      }
    }
  }

  throw new Error("Gemini returned no image data in response");
}

/**
 * Generate image via Replicate — Flux Pro or Flux Schnell.
 */
async function generateWithFlux(
  prompt: string,
  model: "flux-pro" | "flux-schnell" = "flux-pro",
  width?: number,
  height?: number,
): Promise<Buffer> {
  const modelMap: Record<string, string> = {
    "flux-pro": "black-forest-labs/flux-1.1-pro",
    "flux-schnell": "black-forest-labs/flux-schnell",
  };

  const input: Record<string, unknown> = { prompt };
  if (width) input.width = width;
  if (height) input.height = height;

  const outputUrl = await replicatePredict({
    model: modelMap[model],
    input,
    maxAttempts: 60,
    pollInterval: 2000,
  });

  return downloadBuffer(outputUrl);
}

/**
 * Generate image via Stability AI SD3.
 */
async function generateWithSD3(
  prompt: string,
  width?: number,
  height?: number,
): Promise<Buffer> {
  const body: Record<string, unknown> = {
    prompt,
    output_format: "png",
  };
  if (width) body.width = width;
  if (height) body.height = height;

  const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.stabilityApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`SD3 failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as any;
  const b64 = result.image || result.artifacts?.[0]?.base64;
  if (!b64) throw new Error("SD3 returned no image data");
  return Buffer.from(b64, "base64");
}

/**
 * Generate image via Together AI — Flux Schnell (free for 3 months).
 */
async function generateWithTogether(
  prompt: string,
  width?: number,
  height?: number,
): Promise<Buffer> {
  const response = await fetch("https://api.together.xyz/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.togetherApiKey}`,
    },
    body: JSON.stringify({
      model: "black-forest-labs/FLUX.1-schnell-Free",
      prompt,
      width: width || 1024,
      height: height || 1024,
      steps: 4,
      n: 1,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Together AI failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as any;
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Together AI returned no image data");
  return Buffer.from(b64, "base64");
}

/**
 * Generate image via Cloudflare Workers AI (100K free/day).
 */
async function generateWithCloudflare(prompt: string): Promise<Buffer> {
  const accountId = ENV.cfAccountId;
  const token = ENV.cfAiToken;
  if (!accountId || !token) throw new Error("Cloudflare AI not configured");

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare AI failed (${response.status}): ${detail}`);
  }

  // Cloudflare returns raw image bytes
  return Buffer.from(await response.arrayBuffer());
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Map arbitrary size string to closest DALL-E 3 preset. */
function resolveDallESize(size: string): "1024x1024" | "1792x1024" | "1024x1792" {
  if (size === "1792x1024" || size === "1024x1792" || size === "1024x1024") {
    return size;
  }
  const [w, h] = size.split("x").map(Number);
  if (!w || !h) return "1024x1024";
  const ratio = w / h;
  if (ratio > 1.3) return "1792x1024";
  if (ratio < 0.77) return "1024x1792";
  return "1024x1024";
}

/**
 * Use LLM vision to describe source image(s) so we can enrich the prompt.
 * Since Grok/DALL-E 3 don't support img2img, we analyze the original first,
 * then weave the description into the generation prompt.
 */
async function describeOriginalImages(
  images: NonNullable<GenerateImageOptions["originalImages"]>,
): Promise<string> {
  const imageContent = images
    .filter((img) => img.url)
    .map((img) => ({
      type: "image_url" as const,
      image_url: { url: img.url!, detail: "high" as const },
    }));

  if (imageContent.length === 0) return "";

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a precise image describer. Describe the provided image(s) in rich detail — subject, composition, colors, lighting, style, mood, textures, background, and any text visible. Be thorough but concise (3-5 sentences). This description will be used as context for an image generation AI to create a modified version. Output ONLY the description, nothing else.",
        },
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text:
                imageContent.length === 1
                  ? "Describe this image in detail:"
                  : "Describe these images in detail:",
            },
            ...imageContent,
          ],
        },
      ],
      maxTokens: 500,
    });

    const content = result.choices[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch (err) {
    console.warn("[ImageGen] Vision analysis failed, proceeding with prompt only:", err);
    return "";
  }
}

// ─── Main Function ─────────────────────────────────────────────────────────

/**
 * Main image generation function — tries providers in priority order with
 * automatic fallback. All tools should call this function.
 *
 * When originalImages are provided, first describes them via vision then
 * enriches the prompt with the description for better img2img-like results.
 */
export async function generateImage(
  options: GenerateImageOptions,
): Promise<GenerateImageResponse> {
  let { prompt } = options;
  const {
    model = "auto",
    size = "1024x1024",
    quality = "standard",
    style = "vivid",
  } = options;

  // If original images are provided, analyze them and enrich the prompt
  if (options.originalImages && options.originalImages.length > 0) {
    const description = await describeOriginalImages(options.originalImages);
    if (description) {
      prompt = `[Original image description: ${description}]\n\nTask: ${prompt}`;
    }
  }

  let imageBuffer: Buffer;

  if (model !== "auto") {
    // Explicit model requested — no fallback
    imageBuffer = await generateWithExplicitModel(model, prompt, size, quality, style);
  } else {
    // Auto mode: try providers in priority order with fallback
    imageBuffer = await generateWithFallback(prompt, size, quality, style);
  }

  // Apply watermark for free-tier users
  if (!options.userTier || options.userTier === "free") {
    const { addImageWatermark } = await import("./watermark");
    imageBuffer = await addImageWatermark(imageBuffer);
  }

  // Save to R2 storage
  const key = generateStorageKey("generations", "png");
  const { url } = await storagePut(key, imageBuffer, "image/png");

  return { url };
}

/**
 * Generate with an explicitly selected model (no fallback).
 */
async function generateWithExplicitModel(
  model: "grok" | "dall-e-3" | "gemini" | "flux-pro" | "flux-schnell" | "sd3" | "together" | "cloudflare",
  prompt: string,
  size: string,
  quality: "standard" | "hd",
  style: "natural" | "vivid",
): Promise<Buffer> {
  const [w, h] = size.split("x").map(Number);

  switch (model) {
    case "grok":
      if (!ENV.grokApiKey) throw new Error("Grok API key not configured");
      return generateWithGrok(prompt, size);
    case "dall-e-3":
      if (!ENV.openaiApiKey) throw new Error("OpenAI API key not configured");
      return generateWithDallE(prompt, size, quality, style);
    case "gemini":
      if (!ENV.geminiApiKey) throw new Error("Gemini API key not configured");
      return generateWithGemini(prompt);
    case "flux-pro":
      if (!ENV.replicateApiToken) throw new Error("Replicate API token not configured");
      return generateWithFlux(prompt, "flux-pro", w, h);
    case "flux-schnell":
      if (!ENV.replicateApiToken) throw new Error("Replicate API token not configured");
      return generateWithFlux(prompt, "flux-schnell", w, h);
    case "sd3":
      if (!ENV.stabilityApiKey) throw new Error("Stability API key not configured");
      return generateWithSD3(prompt, w, h);
    case "together":
      if (!ENV.togetherApiKey) throw new Error("Together AI API key not configured");
      return generateWithTogether(prompt, w, h);
    case "cloudflare":
      if (!ENV.cfAiToken) throw new Error("Cloudflare AI token not configured");
      return generateWithCloudflare(prompt);
    default:
      throw new Error(`Unknown image model: ${model}`);
  }
}

/**
 * Try providers in cost-optimized order: free first, then cheap, then premium.
 *
 * Priority: Gemini (free) -> Together AI (free) -> Cloudflare (free) ->
 *           Grok -> Flux Schnell (cheap) -> DALL-E 3 -> SD3 -> Flux Pro
 */
async function generateWithFallback(
  prompt: string,
  size: string,
  quality: "standard" | "hd",
  style: "natural" | "vivid",
): Promise<Buffer> {
  const errors: string[] = [];
  const [w, h] = size.split("x").map(Number);

  const tryProvider = async (name: string, fn: () => Promise<Buffer>): Promise<Buffer | null> => {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      console.warn(`[ImageGen] ${name} failed, trying next:`, msg);
      errors.push(`${name}: ${msg}`);
      return null;
    }
  };

  // 1. FREE TIER: Gemini (500 free images/day)
  if (ENV.geminiApiKey) {
    const result = await tryProvider("Gemini", () => generateWithGemini(prompt));
    if (result) return result;
  }

  // 2. FREE TIER: Together AI Flux Schnell (free for 3 months)
  if (ENV.togetherApiKey) {
    const result = await tryProvider("Together AI", () => generateWithTogether(prompt, w, h));
    if (result) return result;
  }

  // 3. FREE TIER: Cloudflare Workers AI (100K free/day)
  if (ENV.cfAiToken) {
    const result = await tryProvider("Cloudflare AI", () => generateWithCloudflare(prompt));
    if (result) return result;
  }

  // 4. CHEAP: Grok
  if (ENV.grokApiKey) {
    const result = await tryProvider("Grok", () => generateWithGrok(prompt, size));
    if (result) return result;
  }

  // 5. CHEAP: Flux Schnell via Replicate (~$0.003/image)
  if (ENV.replicateApiToken) {
    const result = await tryProvider("Flux Schnell", () => generateWithFlux(prompt, "flux-schnell", w, h));
    if (result) return result;
  }

  // 6. PAID: DALL-E 3
  if (ENV.openaiApiKey) {
    const result = await tryProvider("DALL-E 3", () => generateWithDallE(prompt, size, quality, style));
    if (result) return result;
  }

  // 7. PAID: SD3
  if (ENV.stabilityApiKey) {
    const result = await tryProvider("SD3", () => generateWithSD3(prompt, w, h));
    if (result) return result;
  }

  // 8. PREMIUM: Flux Pro (highest quality, last resort)
  if (ENV.replicateApiToken) {
    const result = await tryProvider("Flux Pro", () => generateWithFlux(prompt, "flux-pro", w, h));
    if (result) return result;
  }

  if (errors.length === 0) {
    throw new Error("No image generation API key configured.");
  }

  throw new Error(
    `All image providers failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
  );
}
