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
import { isRunPodAvailable, runpodFluxDev, runpodFluxSchnell, runpodFluxImg2Img } from "./runpod";

export type GenerateImageOptions = {
  prompt: string;
  model?: "grok" | "dall-e-3" | "gemini" | "flux-pro" | "flux-schnell" | "sd3" | "together" | "cloudflare" | "ultra" | "runpod-flux-dev" | "runpod-flux-schnell" | "fal-flux-dev" | "fal-flux-schnell" | "fal-flux-pro-ultra" | "fal-seedream" | "fal-flux-kontext" | "auto";
  size?: string; // "1024x1024", "1024x1792", "1792x1024"
  quality?: "standard" | "hd" | "ultra";
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
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
        signal: controller.signal,
      });
      clearTimeout(timeout);

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
  quality: "standard" | "hd" | "ultra" = "standard",
  style: "natural" | "vivid" = "vivid",
): Promise<Buffer> {
  const validSize = resolveDallESize(size);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
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
    signal: controller.signal,
  });
  clearTimeout(timeout);

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
 * Generate image via Gemini (gemini-2.5-flash-image-preview).
 * Uses the REST API with responseModalities: ["TEXT", "IMAGE"].
 */
async function generateWithGemini(prompt: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${ENV.geminiApiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.stabilityApiKey}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(timeout);

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
 * DreamForgeX Ultra — flagship quality mode.
 * Uses Flux Pro with enhanced prompt engineering to produce Midjourney-competitive images.
 * Enhances the user's prompt with professional photography/art direction tokens.
 */
async function generateUltra(
  prompt: string,
  width?: number,
  height?: number,
): Promise<Buffer> {
  // Step 1: Enhance the prompt with professional quality tokens
  const qualityTokens = [
    "masterpiece, best quality, highly detailed",
    "professional photography, 8K resolution, sharp focus",
    "cinematic lighting, volumetric light, ray tracing",
    "detailed textures, natural skin tones, perfect composition",
    "award-winning, editorial quality, hyperrealistic",
  ].join(", ");

  const enhancedPrompt = `${prompt}. ${qualityTokens}`;

  // Step 2: Try RunPod Flux Dev first (self-hosted, cheapest high-quality)
  if (isRunPodAvailable()) {
    try {
      return await runpodFluxDev(enhancedPrompt, width || 1440, height || 1440, 30, 7.5);
    } catch (err: any) {
      console.warn("[Ultra] RunPod Flux Dev failed, trying Flux Pro:", err.message);
    }
  }

  // Step 2b: Try fal.ai Flux Pro Ultra
  if (ENV.falApiKey) {
    try {
      return await generateWithFal(enhancedPrompt, "fal-ai/flux-pro/v1.1-ultra", width || 1440, height || 1440);
    } catch (err: any) {
      console.warn("[Ultra] fal.ai Flux Pro Ultra failed, trying Replicate:", err.message);
    }
  }

  // Step 3: Try Flux Pro via Replicate
  if (ENV.replicateApiToken) {
    try {
      const outputUrl = await replicatePredict({
        model: "black-forest-labs/flux-1.1-pro",
        input: {
          prompt: enhancedPrompt,
          width: width || 1440,
          height: height || 1440,
          num_inference_steps: 50,
          guidance_scale: 7.5,
        },
        maxAttempts: 90,
        pollInterval: 2000,
      });
      return downloadBuffer(outputUrl);
    } catch (err: any) {
      console.warn("[Ultra] Replicate Flux Pro failed, trying DALL-E HD:", err.message);
    }
  }

  // Step 4: Fallback to DALL-E 3 HD
  if (ENV.openaiApiKey) {
    return generateWithDallE(enhancedPrompt, "1024x1024", "hd", "vivid");
  }

  // Step 5: Last resort — best available model
  return generateWithFallback(enhancedPrompt, `${width || 1024}x${height || 1024}`, "hd", "vivid");
}

/**
 * Generate image via Together AI — Flux Schnell (free for 3 months).
 */
async function generateWithTogether(
  prompt: string,
  width?: number,
  height?: number,
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
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
    signal: controller.signal,
  });
  clearTimeout(timeout);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeout);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Cloudflare AI failed (${response.status}): ${detail}`);
  }

  // Cloudflare Workers AI returns JSON: { result: { image: "<base64>" }, success: true }
  // The base64 is a JPEG. Prior comment claimed "raw image bytes" — that
  // was wrong, and we were saving the whole JSON payload to R2 as the
  // "image," which broke every Cloudflare-routed generation.
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await response.json();
    const b64 = json?.result?.image;
    if (!b64 || typeof b64 !== "string") {
      throw new Error(`Cloudflare AI response missing result.image: ${JSON.stringify(json).slice(0, 200)}`);
    }
    return Buffer.from(b64, "base64");
  }
  // Some models return binary directly — keep that path for safety.
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Generate image via fal.ai queue API.
 * Supports Flux Dev, Flux Schnell, Flux Pro Ultra, Seedream, and Flux Kontext.
 */
async function generateWithFal(
  prompt: string,
  falModel: string = "fal-ai/flux/dev",
  width?: number,
  height?: number,
): Promise<Buffer> {
  const apiKey = ENV.falApiKey;
  if (!apiKey) throw new Error("fal.ai API key not configured");

  const body: Record<string, unknown> = {
    prompt,
    image_size: { width: width || 1024, height: height || 1024 },
  };

  // Submit to queue
  const submitResponse = await fetch(`https://queue.fal.run/${falModel}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!submitResponse.ok) {
    const detail = await submitResponse.text().catch(() => "");
    throw new Error(`fal.ai submit failed (${submitResponse.status}): ${detail}`);
  }

  const { request_id } = (await submitResponse.json()) as { request_id: string };
  if (!request_id) throw new Error("fal.ai returned no request_id");

  // Poll for result (up to 2 minutes)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const statusResp = await fetch(
      `https://queue.fal.run/${falModel}/requests/${request_id}/status`,
      { headers: { Authorization: `Key ${apiKey}` } },
    );
    if (!statusResp.ok) continue;

    const status = (await statusResp.json()) as { status: string; error?: string };

    if (status.status === "COMPLETED") {
      const resultResp = await fetch(
        `https://queue.fal.run/${falModel}/requests/${request_id}`,
        { headers: { Authorization: `Key ${apiKey}` } },
      );
      if (!resultResp.ok) throw new Error("Failed to fetch fal.ai result");

      const result = (await resultResp.json()) as { images?: Array<{ url: string }> };
      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error("fal.ai returned no image data");

      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error("Failed to download fal.ai image");
      return Buffer.from(await imgResp.arrayBuffer());
    }

    if (status.status === "FAILED") {
      throw new Error(`fal.ai generation failed: ${status.error || "Unknown"}`);
    }
  }

  throw new Error("fal.ai generation timed out");
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

  let imageBuffer: Buffer | undefined;

  // If original images are provided, try real img2img on RunPod first
  // (dramatically better quality than the LLM describe-then-generate approach)
  if (options.originalImages && options.originalImages.length > 0 && isRunPodAvailable()) {
    try {
      const sourceImg = options.originalImages[0];
      if (sourceImg.url) {
        const imgResp = await fetch(sourceImg.url);
        if (imgResp.ok) {
          const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
          const imageB64 = imgBuffer.toString("base64");
          imageBuffer = await runpodFluxImg2Img(imageB64, prompt, 0.7);
          console.log("[ImageGen] Used RunPod Flux img2img (real diffusion)");
        } else {
          throw new Error("Failed to fetch source image");
        }
      } else if (sourceImg.b64Json) {
        imageBuffer = await runpodFluxImg2Img(sourceImg.b64Json, prompt, 0.7);
        console.log("[ImageGen] Used RunPod Flux img2img (real diffusion, b64)");
      } else {
        throw new Error("No source image URL or b64");
      }
    } catch (err: any) {
      console.warn("[ImageGen] RunPod img2img failed, falling back to LLM approach:", err.message);
      // Fall through to LLM describe-then-generate below
      imageBuffer = undefined;
    }
  }

  // Fallback: LLM describe-then-generate (or no original images provided)
  if (!imageBuffer) {
    if (options.originalImages && options.originalImages.length > 0) {
      const description = await describeOriginalImages(options.originalImages);
      if (description) {
        prompt = `[Original image description: ${description}]\n\nTask: ${prompt}`;
      }
    }

    if (model !== "auto") {
      imageBuffer = await generateWithExplicitModel(model, prompt, size, quality, style);
    } else {
      imageBuffer = await generateWithFallback(prompt, size, quality, style);
    }
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
  model: "grok" | "dall-e-3" | "gemini" | "flux-pro" | "flux-schnell" | "sd3" | "together" | "cloudflare" | "ultra" | "runpod-flux-dev" | "runpod-flux-schnell" | "fal-flux-dev" | "fal-flux-schnell" | "fal-flux-pro-ultra" | "fal-seedream" | "fal-flux-kontext",
  prompt: string,
  size: string,
  quality: "standard" | "hd" | "ultra",
  style: "natural" | "vivid",
): Promise<Buffer> {
  const [w, h] = size.split("x").map(Number);

  switch (model) {
    case "runpod-flux-dev":
      if (!isRunPodAvailable()) throw new Error("RunPod not configured");
      return runpodFluxDev(prompt, w || 1024, h || 1024);
    case "runpod-flux-schnell":
      if (!isRunPodAvailable()) throw new Error("RunPod not configured");
      return runpodFluxSchnell(prompt, w || 1024, h || 1024);
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
    case "ultra":
      return generateUltra(prompt, w, h);
    case "fal-flux-dev":
      if (!ENV.falApiKey) throw new Error("fal.ai API key not configured");
      return generateWithFal(prompt, "fal-ai/flux/dev", w, h);
    case "fal-flux-schnell":
      if (!ENV.falApiKey) throw new Error("fal.ai API key not configured");
      return generateWithFal(prompt, "fal-ai/flux/schnell", w, h);
    case "fal-flux-pro-ultra":
      if (!ENV.falApiKey) throw new Error("fal.ai API key not configured");
      return generateWithFal(prompt, "fal-ai/flux-pro/v1.1-ultra", w, h);
    case "fal-seedream":
      if (!ENV.falApiKey) throw new Error("fal.ai API key not configured");
      return generateWithFal(prompt, "fal-ai/seedream-3.0", w, h);
    case "fal-flux-kontext":
      if (!ENV.falApiKey) throw new Error("fal.ai API key not configured");
      return generateWithFal(prompt, "fal-ai/flux-kontext/pro", w, h);
    default:
      throw new Error(`Unknown image model: ${model}`);
  }
}

/**
 * Try providers in cost-optimized order: free first, then cheap, then premium.
 *
 * Priority: Gemini (free) -> Together AI (free) -> Cloudflare (free) ->
 *           RunPod Flux Schnell (self-hosted) -> Grok -> Flux Schnell (Replicate) ->
 *           DALL-E 3 -> SD3 -> Flux Pro
 */
async function generateWithFallback(
  prompt: string,
  size: string,
  quality: "standard" | "hd" | "ultra",
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

  // 4. SELF-HOSTED: RunPod Flux Schnell (~$0.001/image) — cheapest paid option
  if (isRunPodAvailable()) {
    const result = await tryProvider("RunPod Flux Schnell", () => runpodFluxSchnell(prompt, w, h));
    if (result) return result;
  }

  // 5. CHEAP: Grok
  if (ENV.grokApiKey) {
    const result = await tryProvider("Grok", () => generateWithGrok(prompt, size));
    if (result) return result;
  }

  // 5b. CHEAP: fal.ai Flux Schnell (~$0.008/image)
  if (ENV.falApiKey) {
    const result = await tryProvider("fal.ai Flux Schnell", () =>
      generateWithFal(prompt, "fal-ai/flux/schnell", w, h)
    );
    if (result) return result;
  }

  // 7. CHEAP: Flux Schnell via Replicate (~$0.003/image)
  if (ENV.replicateApiToken) {
    const result = await tryProvider("Flux Schnell", () => generateWithFlux(prompt, "flux-schnell", w, h));
    if (result) return result;
  }

  // 8. PAID: DALL-E 3
  if (ENV.openaiApiKey) {
    const result = await tryProvider("DALL-E 3", () => generateWithDallE(prompt, size, quality, style));
    if (result) return result;
  }

  // 9. PAID: SD3
  if (ENV.stabilityApiKey) {
    const result = await tryProvider("SD3", () => generateWithSD3(prompt, w, h));
    if (result) return result;
  }

  // 10. PREMIUM: Flux Pro (highest quality, last resort)
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
