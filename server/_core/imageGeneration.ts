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
import { checkPrompt, logModerationBlock, PromptBlockedError } from "./promptModeration";
import { isRunPodAvailable, runpodFluxDev, runpodFluxSchnell, runpodFluxImg2Img } from "./runpod";
import { assertSafeImageUrl, fetchGuardedImage } from "./imageUrlGuard";
import type { ImageExecutionKey, ImageGenerationProvenance } from "../../shared/imageModels";
import { DIRECT_IMAGE_MODELS, DirectImageInputError, generateDirectImage } from "./directImageProviders";

export type GenerateImageOptions = {
  prompt: string;
  model?: ImageExecutionKey | "fal-flux-kontext" | "auto";
  size?: string; // "1024x1024", "1024x1792", "1792x1024"
  quality?: "standard" | "hd" | "ultra";
  style?: "natural" | "vivid";
  /** User tier — free tier gets watermarked output */
  userTier?: string;
  /**
   * Uncensored-tier generations. Routes ONLY through providers without
   * content moderation AND without AUP exposure: self-hosted RunPod Flux
   * Schnell (our GPUs, Apache-2.0 model) first, fal Flux Schnell fallback.
   * Cloudflare/OpenAI/Stability/Grok are never used — they hard-reject NSFW
   * or their terms prohibit it. Callers MUST have verified entitlement +
   * age attestation before setting this.
   */
  unfiltered?: boolean;
  /**
   * Optional NSFW-style LoRA (HF repo id or .safetensors URL) applied on the
   * unfiltered self-hosted path only. Resolved from env per style — see
   * uncensoredStyleLora.ts. Ignored unless `unfiltered` is set.
   */
  loraId?: string;
  /** Reproducible seed for the unfiltered Flux path. */
  seed?: number;
  /**
   * Unfiltered quality: "fast" = Flux Schnell (4 steps), "quality" = Flux Dev
   * (20 steps). Paid uncensored studio uses this; free previews stay fast.
   */
  unfilteredQuality?: "fast" | "quality";
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
  provenance?: ImageGenerationProvenance;
};

// Track successful upstream routes without changing buffers or their consumers.
type SuccessfulRoute = Omit<ImageGenerationProvenance, "requestedModel">;
const imageRoutes = new WeakMap<Buffer, SuccessfulRoute>();
function recordImageRoute(buffer: Buffer, provider: string, model: string, fallbackUsed = false): Buffer {
  imageRoutes.set(buffer, { provider, model, fallbackUsed });
  return buffer;
}
function markImageFallback(buffer: Buffer, fallbackUsed: boolean): Buffer {
  const route = imageRoutes.get(buffer);
  if (route && fallbackUsed) imageRoutes.set(buffer, { ...route, fallbackUsed: true });
  return buffer;
}

/** Configuration for the existing Auto chain; no authentication or render-health probe. */
export function isAutomaticImageConfigured(): boolean {
  return (process.env.IMAGEN_ENABLED === "true" && !!ENV.geminiApiKey)
    || (!!ENV.cfAiToken && !!ENV.cfAccountId)
    || !!ENV.falApiKey
    || isRunPodAvailable()
    || !!ENV.grokApiKey
    || !!ENV.replicateApiToken
    || !!ENV.openaiApiKey
    || !!ENV.stabilityApiKey;
}

// ─── Provider Implementations ──────────────────────────────────────────────

/**
 * Generate image via Grok (xAI) API using grok-imagine-image.
 */
async function generateWithGrok(prompt: string): Promise<Buffer> {
  // grok-2-image was retired on this account (404 "does not exist or your
  // team does not have access", confirmed 2026-06-11) — don't waste a call.
  const models = ["grok-imagine-image"];
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
        // The xAI image API rejects `size` outright (400 "Argument not
        // supported: size") — output dimensions are not controllable.
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
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
        return recordImageRoute(Buffer.from(b64, "base64"), "grok", model);
      }

      // Handle URL response as fallback
      const imageUrl = result.data?.[0]?.url;
      if (imageUrl) {
        const imageResp = await fetch(imageUrl);
        if (!imageResp.ok) throw new Error(`Failed to download Grok image: ${imageResp.status}`);
        return recordImageRoute(Buffer.from(await imageResp.arrayBuffer()), "grok", model);
      }

      lastError = new Error(`Grok ${model} returned no image data`);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("Grok image generation failed");
}

/**
 * Generate image via OpenAI GPT Image.
 *
 * Replaces the old DALL-E 3 integration — OpenAI retired `dall-e-3` on this
 * account (400 "The model 'dall-e-3' does not exist", confirmed 2026-06-11);
 * current image models are gpt-image-1 / 1.5 / 2. gpt-image-1 takes
 * low|medium|high quality, no `style`, no `response_format` (always b64).
 */
async function generateWithGptImage(
  prompt: string,
  size: string = "1024x1024",
  quality: "standard" | "hd" | "ultra" = "standard",
): Promise<Buffer> {
  const validSize = resolveGptImageSize(size);
  const gptQuality = quality === "standard" ? "medium" : "high";

  const controller = new AbortController();
  // gpt-image-1 is slow (20-60s typical) — 30s was guaranteed to abort
  const timeout = setTimeout(() => controller.abort(), 120000);
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: validSize,
      quality: gptQuality,
    }),
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GPT Image failed (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as any;
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("GPT Image returned no image data");

  return recordImageRoute(Buffer.from(b64, "base64"), "openai", "gpt-image-1");
}

/**
 * Generate image via Gemini (gemini-2.5-flash-image).
 * Uses the REST API with responseModalities: ["TEXT", "IMAGE"].
 */
async function generateWithGemini(prompt: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${ENV.geminiApiKey}`;

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
        return recordImageRoute(Buffer.from(data, "base64"), "gemini", "gemini-2.5-flash-image");
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

  return recordImageRoute(await downloadBuffer(outputUrl), "replicate", modelMap[model]);
}

/**
 * Generate image via Stability AI SD3.
 */
async function generateWithSD3(
  prompt: string,
  width?: number,
  height?: number,
): Promise<Buffer> {
  // The v2beta endpoint only accepts multipart/form-data (JSON gets a 400
  // "content-type: must be multipart/form-data") and takes aspect_ratio,
  // not width/height.
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("output_format", "png");
  if (width && height) {
    const ratio = width / height;
    form.append("aspect_ratio", ratio > 1.3 ? "16:9" : ratio < 0.77 ? "9:16" : "1:1");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const response = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${ENV.stabilityApiKey}`,
    },
    body: form,
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
  return recordImageRoute(Buffer.from(b64, "base64"), "stability", "sd3");
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
  let fallbackUsed = false;

  // Step 2: Try RunPod Flux Dev first (self-hosted, cheapest high-quality)
  if (isRunPodAvailable()) {
    try {
      return recordImageRoute(await runpodFluxDev(enhancedPrompt, width || 1440, height || 1440, 30, 7.5), "runpod", "flux-dev", fallbackUsed);
    } catch (err: any) {
      fallbackUsed = true;
      console.warn("[Ultra] RunPod Flux Dev failed, trying Flux Pro:", err.message);
    }
  }

  // Step 2b: Try fal.ai Flux Pro Ultra
  if (ENV.falApiKey) {
    try {
      return markImageFallback(await generateWithFal(enhancedPrompt, "fal-ai/flux-pro/v1.1-ultra", width || 1440, height || 1440), fallbackUsed);
    } catch (err: any) {
      fallbackUsed = true;
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
      return recordImageRoute(await downloadBuffer(outputUrl), "replicate", "black-forest-labs/flux-1.1-pro", fallbackUsed);
    } catch (err: any) {
      fallbackUsed = true;
      console.warn("[Ultra] Replicate Flux Pro failed, trying DALL-E HD:", err.message);
    }
  }

  // Step 4: Fallback to GPT Image high quality
  if (ENV.openaiApiKey) {
    return markImageFallback(await generateWithGptImage(enhancedPrompt, "1024x1024", "hd"), fallbackUsed);
  }

  // Step 5: Last resort — best available model
  return markImageFallback(await generateWithFallback(enhancedPrompt, `${width || 1024}x${height || 1024}`, "hd", "vivid"), fallbackUsed);
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
  return recordImageRoute(Buffer.from(b64, "base64"), "together", "black-forest-labs/FLUX.1-schnell-Free");
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
    return recordImageRoute(Buffer.from(b64, "base64"), "cloudflare", "@cf/black-forest-labs/flux-1-schnell");
  }
  // Some models return binary directly — keep that path for safety.
  return recordImageRoute(Buffer.from(await response.arrayBuffer()), "cloudflare", "@cf/black-forest-labs/flux-1-schnell");
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
  extraInput?: Record<string, unknown>,
): Promise<Buffer> {
  const apiKey = ENV.falApiKey;
  if (!apiKey) throw new Error("fal.ai API key not configured");

  const body: Record<string, unknown> = {
    prompt,
    image_size: { width: width || 1024, height: height || 1024 },
    ...extraInput,
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

  // Poll the URLs fal returns, never URLs built from the model path: for
  // subpath models ("fal-ai/flux/schnell") the request endpoints live under
  // the model ROOT ("fal-ai/flux/requests/…"). Building them from the full
  // model path 404s on every poll, which the old loop swallowed silently and
  // then misreported as "generation timed out".
  const submitted = (await submitResponse.json()) as {
    request_id?: string;
    status_url?: string;
    response_url?: string;
  };
  if (!submitted.request_id || !submitted.status_url || !submitted.response_url) {
    throw new Error("fal.ai returned no request_id/status_url");
  }

  // Poll for result (up to 2 minutes)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));

    const statusResp = await fetch(submitted.status_url, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!statusResp.ok) continue;

    const status = (await statusResp.json()) as { status: string; error?: string };

    if (status.status === "COMPLETED") {
      const resultResp = await fetch(submitted.response_url, {
        headers: { Authorization: `Key ${apiKey}` },
      });
      if (!resultResp.ok) throw new Error("Failed to fetch fal.ai result");

      const result = (await resultResp.json()) as { images?: Array<{ url: string }> };
      const imageUrl = result.images?.[0]?.url;
      if (!imageUrl) throw new Error("fal.ai returned no image data");

      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error("Failed to download fal.ai image");
      return recordImageRoute(Buffer.from(await imgResp.arrayBuffer()), "fal", falModel);
    }

    if (status.status === "FAILED") {
      throw new Error(`fal.ai generation failed: ${status.error || "Unknown"}`);
    }
  }

  throw new Error("fal.ai generation timed out");
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Map arbitrary size string to closest GPT Image preset. */
function resolveGptImageSize(size: string): "1024x1024" | "1536x1024" | "1024x1536" {
  if (size === "1536x1024" || size === "1024x1536" || size === "1024x1024") {
    return size;
  }
  const [w, h] = size.split("x").map(Number);
  if (!w || !h) return "1024x1024";
  const ratio = w / h;
  if (ratio > 1.3) return "1536x1024";
  if (ratio < 0.77) return "1024x1536";
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

  // These explicit creation models must never enter the legacy RunPod/vision
  // replacement path. Native editing is a separate capability to integrate.
  if (Object.hasOwn(DIRECT_IMAGE_MODELS, model) && (options.unfiltered || (options.originalImages?.length ?? 0) > 0)) {
    throw new DirectImageInputError("The selected image model supports standard text-to-image creation only.");
  }

  let imageBuffer: Buffer | undefined;
  let imageToImageFailed = false;

  // P1.8 (SSRF): every user-supplied source image URL must pass the shared
  // guard BEFORE anything touches it. Two consumers fetch these URLs
  // server-side: the RunPod img2img download below, and the vision-LLM
  // handoff in describeOriginalImages. assertSafeImageUrl throws
  // TRPCError(BAD_REQUEST) with a generic, URL-free message (see
  // imageUrlGuard.ts), so the failure mode is clean and leaks nothing about
  // the URL or provider internals. ~20 tools feed originalImages into this
  // function; only a few guarded their own router input before this.
  if (options.originalImages) {
    for (const img of options.originalImages) {
      if (img.url) assertSafeImageUrl(img.url);
    }
  }

  // If original images are provided, try real img2img on RunPod first
  // (dramatically better quality than the LLM describe-then-generate approach)
  if (options.originalImages && options.originalImages.length > 0 && isRunPodAvailable()) {
    try {
      const sourceImg = options.originalImages[0];
      if (sourceImg.url) {
        // fetchGuardedImage re-validates (redundant after the loop above,
        // cheap) and caps the download at 25MB while streaming — a hostile
        // or oversized URL can no longer exhaust the lambda's memory.
        const { buffer: imgBuffer } = await fetchGuardedImage(sourceImg.url);
        const imageB64 = imgBuffer.toString("base64");
        imageBuffer = recordImageRoute(await runpodFluxImg2Img(imageB64, prompt, 0.7), "runpod", "flux-dev");
        console.log("[ImageGen] Used RunPod Flux img2img (real diffusion)");
      } else if (sourceImg.b64Json) {
        imageBuffer = recordImageRoute(await runpodFluxImg2Img(sourceImg.b64Json, prompt, 0.7), "runpod", "flux-dev");
        console.log("[ImageGen] Used RunPod Flux img2img (real diffusion, b64)");
      } else {
        throw new Error("No source image URL or b64");
      }
    } catch (err: any) {
      console.warn("[ImageGen] RunPod img2img failed, falling back to LLM approach:", err.message);
      // Fall through to LLM describe-then-generate below
      imageBuffer = undefined;
      imageToImageFailed = true;
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

    if (options.unfiltered) {
      imageBuffer = await generateUnfiltered(prompt, size, options.loraId, {
        quality: options.unfilteredQuality,
        seed: options.seed,
      });
    } else if (model !== "auto") {
      imageBuffer = await generateWithExplicitModel(model, prompt, size, quality, style);
    } else {
      imageBuffer = await generateWithFallback(prompt, size, quality, style, options.userTier);
    }
  }

  const successfulRoute = imageRoutes.get(imageBuffer);
  const provenance = successfulRoute
    ? { ...successfulRoute, requestedModel: model, fallbackUsed: successfulRoute.fallbackUsed || imageToImageFailed }
    : undefined;

  // Watermark: SFW free-tier, and uncensored *previews* (userTier === "free"
  // on the unfiltered path). An Uncensored Pass holder on a Stripe free plan
  // used to get watermarked anyway because getUserTier() ignores the crypto
  // entitlement — that was giving paying adult buyers a preview they already
  // paid to remove.
  const shouldWatermark = options.unfiltered
    ? options.userTier === "free"
    : !options.userTier || options.userTier === "free";
  if (shouldWatermark) {
    const { addImageWatermark } = await import("./watermark");
    imageBuffer = await addImageWatermark(imageBuffer);
  }

  // Save to R2 storage
  const key = generateStorageKey("generations", "png");
  const { url } = await storagePut(key, imageBuffer, "image/png");

  return { url, ...(provenance ? { provenance } : {}) };
}

/**
 * Uncensored-tier chain. Two providers only:
 *   1. Self-hosted RunPod Flux Schnell — our GPUs, Apache-2.0 weights, no
 *      third-party AUP exposure. Primary on purpose, not just for cost.
 *   2. fal Flux Schnell with the safety checker disabled — fallback for
 *      RunPod cold-start latency or outage.
 * Never touches Cloudflare / OpenAI / Stability / Grok — they hard-reject
 * NSFW or prohibit it in their terms.
 */
async function generateUnfiltered(
  prompt: string,
  size: string,
  loraId?: string,
  opts?: { quality?: "fast" | "quality"; seed?: number },
): Promise<Buffer> {
  // Defense-in-depth: the no-safety chain refuses illegal content even if a
  // higher-level gate was missed. Throws PromptBlockedError (CSAM / minor /
  // real-person deepfake) before any GPU call. A refusal HERE means a surface
  // gate was bypassed — log it to moderation_log so it's visible in review.
  {
    const verdict = checkPrompt(prompt, { strictMinors: true });
    if (!verdict.allowed) {
      await logModerationBlock({
        category: verdict.category,
        promptLen: prompt.length,
        surface: "backstop:generateUnfiltered",
        prompt,
      });
      throw new PromptBlockedError(verdict);
    }
  }
  const [w, h] = size.split("x").map(Number);
  const errors: string[] = [];
  const width = w || 1024;
  const height = h || 1024;
  const seed = opts?.seed;
  const wantQuality = opts?.quality === "quality";

  if (isRunPodAvailable() && wantQuality) {
    try {
      return recordImageRoute(await runpodFluxDev(prompt, width, height, 20, 7.5, loraId, seed), "runpod", "flux-dev", errors.length > 0);
    } catch (err: any) {
      errors.push(`RunPod Flux Dev: ${err.message}`);
      console.warn("[ImageGen] Unfiltered Flux Dev failed, trying Schnell:", err.message);
    }
  }

  if (isRunPodAvailable()) {
    try {
      return recordImageRoute(await runpodFluxSchnell(prompt, width, height, loraId, seed), "runpod", "flux-schnell", errors.length > 0);
    } catch (err: any) {
      errors.push(`RunPod: ${err.message}`);
      console.warn("[ImageGen] Unfiltered RunPod failed, trying fal:", err.message);
    }
  }

  if (ENV.falApiKey) {
    try {
      return markImageFallback(await generateWithFal(prompt, "fal-ai/flux/schnell", w, h, {
        enable_safety_checker: false,
      }), errors.length > 0);
    } catch (err: any) {
      errors.push(`fal: ${err.message}`);
    }
  }

  throw new Error(
    errors.length
      ? `Uncensored providers failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`
      : "No uncensored-capable provider configured.",
  );
}

/**
 * Refine an existing uncensored image — img2img on the self-hosted GPU.
 *
 * This answers the most-repeated request in our own generation logs: "change
 * this one thing and leave the rest alone". That request is only safe to serve
 * because the CALLER supplies a generation id, not a file — the router resolves
 * it to an image this user already generated here, so the subject is always a
 * fictional character we produced. Editing arbitrary uploads is the "nudify"
 * pattern and is categorically not built: a self-attested "it's my own photo"
 * cannot be verified and is exactly how non-consensual intimate imagery gets
 * laundered.
 *
 * RunPod only — no fal fallback. fal's img2img runs a safety checker we can't
 * disable on this route, so a fallback would silently return a refusal or a
 * sanitised frame; failing loudly is better than a confusing half-result.
 */
/** See refineUnfiltered / submitUnfilteredImageJob — one number, two rails. */
export const UNCENSORED_IMG2IMG_STEPS = 10;

export async function refineUnfiltered(
  imageB64: string,
  prompt: string,
  opts?: { strength?: number; loraId?: string; seed?: number },
): Promise<Buffer> {
  // Same backstop as generateUnfiltered: the no-safety chain refuses illegal
  // content even if a surface gate was missed.
  const verdict = checkPrompt(prompt, { strictMinors: true });
  if (!verdict.allowed) {
    await logModerationBlock({
      category: verdict.category,
      promptLen: prompt.length,
      surface: "backstop:refineUnfiltered",
      prompt,
    });
    throw new PromptBlockedError(verdict);
  }

  if (!isRunPodAvailable()) {
    throw new Error("The refine GPU is unavailable right now — please try again shortly.");
  }

  // Clamp: below ~0.2 nothing visibly changes and the credit is wasted; at 1.0
  // the source is discarded entirely, which is just text-to-image.
  const strength = Math.min(Math.max(opts?.strength ?? 0.6, 0.2), 0.9);
  // Schnell, like the uncensored text-to-image path: the realism LoRA is a
  // Schnell LoRA, and the worker can't hold Dev next to Schnell on 48GB.
  // Img2img only runs the last strength×steps steps, so 10 total keeps ~4-6
  // real denoising steps at the strengths the studio uses (0.4–0.6).
  try {
    return await runpodFluxImg2Img(
      imageB64,
      prompt,
      strength,
      UNCENSORED_IMG2IMG_STEPS,
      0,
      opts?.loraId,
      opts?.seed,
      "schnell",
    );
  } catch (err: any) {
    const msg = err?.message ?? String(err ?? "");
    if (ENV.falApiKey && /\b409\b|ENDPOINT_PAUSED|max_workers\s*=\s*0|Endpoint is paused/i.test(msg)) {
      console.warn("[ImageGen] refineUnfiltered RunPod endpoint paused, falling back to fal.ai Flux Schnell:", msg);
      return generateWithFal(prompt, "fal-ai/flux/schnell", 832, 1216, {
        enable_safety_checker: false,
        ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
      });
    }
    throw err;
  }
}

/**
 * Generate with an explicitly selected model (no fallback).
 */
export function hasTypographyIntent(prompt: string): boolean {
  if (/"[^"\n]{2,64}"/.test(prompt)) return true;
  return /\b(with the text|that says|saying\s+['"]|sign that reads|banner reading|lettering|typography|logo text|poster titled|neon sign\s+['"])\b/i.test(prompt);
}

export function enhanceTypographyPrompt(prompt: string): string {
  if (!hasTypographyIntent(prompt)) return prompt;
  if (/spelled accurately|crisp, legible typography/i.test(prompt)) return prompt;
  return `${prompt}. Render any quoted text or signage with exact spelling, crisp legible typography, and balanced kerning.`;
}

async function generateWithExplicitModel(
  model: ImageExecutionKey | "fal-flux-kontext",
  prompt: string,
  size: string,
  quality: "standard" | "hd" | "ultra",
  style: "natural" | "vivid",
): Promise<Buffer> {
  const [w, h] = size.split("x").map(Number);

  switch (model) {
    case "gpt-image-2.5-flare":
    case "gpt-image-2.5-sunburst":
    case "grok-imagine-image-2.0": {
      const openai = model !== "grok-imagine-image-2.0";
      if (openai && !ENV.openaiImage25Enabled) throw new DirectImageInputError("This image model is currently unavailable.");
      const apiKey = openai ? ENV.openaiApiKey : ENV.grokApiKey;
      if (!apiKey) throw new DirectImageInputError("The selected image provider is not configured.");
      const result = await generateDirectImage({ modelId: model, prompt, width: w, height: h, apiKey });
      imageRoutes.set(result.buffer, {
        provider: result.provenance.provider === "xai" ? "grok" : "openai",
        model: result.provenance.providerModel,
        fallbackUsed: false,
        direct: result.provenance,
        ...(result.usage ? { usage: result.usage } : {}),
      });
      return result.buffer;
    }
    case "runpod-flux-dev":
      if (isRunPodAvailable()) {
        try {
          return recordImageRoute(await runpodFluxDev(prompt, w || 1024, h || 1024), "runpod", "flux-dev");
        } catch (err: any) {
          if (!ENV.falApiKey) throw err;
          console.warn("[ImageGen] RunPod flux-dev failed, falling back to fal.ai flux/dev:", err.message);
        }
      } else if (!ENV.falApiKey) {
        throw new Error("RunPod not configured");
      }
      return markImageFallback(await generateWithFal(prompt, "fal-ai/flux/dev", w, h), isRunPodAvailable());
    case "runpod-flux-schnell":
      if (isRunPodAvailable()) {
        try {
          return recordImageRoute(await runpodFluxSchnell(prompt, w || 1024, h || 1024), "runpod", "flux-schnell");
        } catch (err: any) {
          if (!ENV.falApiKey) throw err;
          console.warn("[ImageGen] RunPod flux-schnell failed, falling back to fal.ai flux/schnell:", err.message);
        }
      } else if (!ENV.falApiKey) {
        throw new Error("RunPod not configured");
      }
      return markImageFallback(await generateWithFal(prompt, "fal-ai/flux/schnell", w, h), isRunPodAvailable());
    case "grok":
      if (!ENV.grokApiKey) throw new Error("Grok API key not configured");
      return generateWithGrok(prompt);
    case "dall-e-3":
      // Option key kept for UI/registry compat; routes to GPT Image now.
      // When OpenAI rejects with billing/quota exhaustion (429 credit_balance_exhausted)
      // and fal.ai is configured, fall back to Flux Pro 1.1 Ultra (~$0.06, same 310-325 cr band).
      if (!ENV.openaiApiKey && !ENV.falApiKey) throw new Error("OpenAI API key not configured");
      if (ENV.openaiApiKey) {
        try {
          return await generateWithGptImage(prompt, size, quality);
        } catch (err: any) {
          const msg = String(err?.message ?? "");
          const isQuotaExhausted = /credit_balance_exhausted|insufficient_quota|billing_hard_limit/i.test(msg);
          if (!isQuotaExhausted || !ENV.falApiKey) throw err;
          console.warn("[ImageGen] OpenAI GPT Image quota exhausted, falling back to fal.ai flux-pro/v1.1-ultra:", msg);
        }
      }
      return markImageFallback(await generateWithFal(prompt, "fal-ai/flux-pro/v1.1-ultra", w, h), !!ENV.openaiApiKey);
    case "gemini":
      if (process.env.IMAGEN_ENABLED !== "true" || !ENV.geminiApiKey) {
        throw new Error("Gemini Imagen is currently unavailable on this account");
      }
      return generateWithGemini(prompt);
    // Flux via fal.ai first (Replicate token died 2026-06, fal hosts the
    // same Black Forest Labs models), Replicate as fallback.
    case "flux-pro":
      if (ENV.falApiKey) {
        try {
          return await generateWithFal(prompt, "fal-ai/flux-pro/v1.1", w, h);
        } catch (err: any) {
          if (!ENV.replicateApiToken) throw err;
          console.warn("[ImageGen] fal.ai flux-pro failed, falling back to Replicate:", err.message);
        }
      }
      if (!ENV.replicateApiToken) throw new Error("No Flux provider configured (need FAL_API_KEY or REPLICATE_API_TOKEN)");
      return markImageFallback(await generateWithFlux(prompt, "flux-pro", w, h), !!ENV.falApiKey);
    case "flux-schnell":
      if (ENV.falApiKey) {
        try {
          return await generateWithFal(prompt, "fal-ai/flux/schnell", w, h);
        } catch (err: any) {
          if (!ENV.replicateApiToken) throw err;
          console.warn("[ImageGen] fal.ai flux-schnell failed, falling back to Replicate:", err.message);
        }
      }
      if (!ENV.replicateApiToken) throw new Error("No Flux provider configured (need FAL_API_KEY or REPLICATE_API_TOKEN)");
      return markImageFallback(await generateWithFlux(prompt, "flux-schnell", w, h), !!ENV.falApiKey);
    case "sd3":
      if (!ENV.stabilityApiKey) throw new Error("Stability API key not configured");
      return generateWithSD3(prompt, w, h);
    case "together":
      // Together's key has been 401-dead since April 2026. The option key is
      // kept for UI/back-compat but routes to the same Flux Schnell on fal —
      // identical underlying model, so users selecting it still get images.
      if (ENV.falApiKey) {
        return generateWithFal(prompt, "fal-ai/flux/schnell", w, h);
      }
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
 * Priority: Cloudflare (free) -> fal.ai Flux Schnell (cheap + typography-capable) ->
 *           RunPod Flux Schnell (self-hosted) -> Flux Schnell (Replicate) ->
 *           Paid-tier backup (Grok / opt-in Gemini)
 */
async function generateWithFallback(
  prompt: string,
  size: string,
  _quality: "standard" | "hd" | "ultra",
  _style: "natural" | "vivid",
  userTier?: string,
): Promise<Buffer> {
  const errors: string[] = [];
  const [w, h] = size.split("x").map(Number);
  const isPaidTier = Boolean(userTier && userTier !== "free");
  const typographyMode = hasTypographyIntent(prompt);
  const effectivePrompt = typographyMode ? enhanceTypographyPrompt(prompt) : prompt;

  const tryProvider = async (name: string, fn: () => Promise<Buffer>): Promise<Buffer | null> => {
    try {
      return markImageFallback(await fn(), errors.length > 0);
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      console.warn(`[ImageGen] ${name} failed, trying next:`, msg);
      errors.push(`${name}: ${msg}`);
      return null;
    }
  };

  // Typography-specialist routing: when the prompt explicitly requests rendered
  // text/lettering, try fal.ai Flux Schnell first (native dimension control +
  // stronger text adherence than Cloudflare's fixed-resolution endpoint).
  if (typographyMode && ENV.falApiKey) {
    const result = await tryProvider("fal.ai Flux Schnell (Typography)", () =>
      generateWithFal(effectivePrompt, "fal-ai/flux/schnell", w, h)
    );
    if (result) return result;
  }

  // 1. FREE TIER: Cloudflare Workers AI (100K free/day)
  if (ENV.cfAiToken && ENV.cfAccountId) {
    const result = await tryProvider("Cloudflare AI", () => generateWithCloudflare(effectivePrompt));
    if (result) return result;
  }

  // 2. CHEAP + FAST: fal.ai Flux Schnell (~$0.003/image, ~4s, no cold start).
  if (!typographyMode && ENV.falApiKey) {
    const result = await tryProvider("fal.ai Flux Schnell", () =>
      generateWithFal(effectivePrompt, "fal-ai/flux/schnell", w, h)
    );
    if (result) return result;
  }

  // 3. SELF-HOSTED: RunPod Flux Schnell (~$0.001/image, slow when cold)
  if (isRunPodAvailable()) {
    const result = await tryProvider("RunPod Flux Schnell", async () => recordImageRoute(await runpodFluxSchnell(effectivePrompt, w, h), "runpod", "flux-schnell"));
    if (result) return result;
  }

  // 4. CHEAP: Flux Schnell via Replicate (~$0.003/image)
  if (ENV.replicateApiToken) {
    const result = await tryProvider("Flux Schnell", () => generateWithFlux(effectivePrompt, "flux-schnell", w, h));
    if (result) return result;
  }

  // 5. PAID TIER BACKUP ONLY: Grok Imagine / opt-in Gemini Imagen
  // Never cascade 5-credit Auto into 210–325 credit models (GPT Image 1, SD3, Flux Pro),
  // and never cascade free-tier Auto requests into paid Grok/Gemini APIs.
  if (isPaidTier && ENV.grokApiKey) {
    const result = await tryProvider("Grok", () => generateWithGrok(effectivePrompt));
    if (result) return result;
  }

  if (isPaidTier && process.env.IMAGEN_ENABLED === "true" && ENV.geminiApiKey) {
    const result = await tryProvider("Gemini", () => generateWithGemini(effectivePrompt));
    if (result) return result;
  }

  if (errors.length === 0) {
    throw new Error("No image generation API key configured.");
  }

  throw new Error(
    `All image providers failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
  );
}

