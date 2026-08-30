/**
 * Uncensored tier router — crypto-paid (BTCPay) entitlement.
 *
 * Revenue rationale: real user prompts are overwhelmingly adult-content and
 * the SFW chain rejects them. This tier monetizes that demand WITHOUT
 * touching Stripe (adult content violates Stripe's AUP — the SFW plans stay
 * on Stripe, this tier is crypto-only).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, createGeneration, updateGeneration, getGenerationById } from "../db";
import { users, cryptoInvoices, generations, characters } from "../../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { createUncensoredInvoice, isBtcpayConfigured, UNCENSORED_PLAN, UNCENSORED_PLANS, getUncensoredPlanById } from "../_core/btcpay";
import { generateImage, refineUnfiltered } from "../_core/imageGeneration";
import { storagePut, generateStorageKey } from "../storage";
import { applyUncensoredStyle, UNCENSORED_STYLES } from "../../shared/uncensoredStyles";
import { FREE_UNCENSORED_PREVIEWS } from "../../shared/uncensoredPlans";
import {
  UNCENSORED_ASPECTS,
  UNCENSORED_FRAMINGS,
  UNCENSORED_IMAGE_COST,
  UNCENSORED_POSES,
  UNCENSORED_CAMERAS,
  UNCENSORED_LIGHTING,
  UNCENSORED_WARDROBE,
  UNCENSORED_SETTINGS,
  UNCENSORED_VIDEO_DURATIONS,
  UNCENSORED_VIDEO_MOTIONS,
  UNCENSORED_VIDEO_INTENSITIES,
  UNCENSORED_SHEET_VIEWS,
  UNCENSORED_CHARACTER_LIMIT,
  DEFAULT_UNCENSORED_NEGATIVE,
  applyUncensoredFraming,
  applyUncensoredPose,
  applyUncensoredCamera,
  applyUncensoredLighting,
  applyUncensoredWardrobe,
  applyUncensoredSetting,
  applyUncensoredVideoMotion,
  applyUncensoredVideoIntensity,
  applyUncensoredI2vIdentity,
  clampCharacterStrength,
  getUncensoredAspect,
  getUncensoredVideoDuration,
  getUncensoredVideoSize,
  DEFAULT_UNCENSORED_VIDEO_NEGATIVE,
  uncensoredVideoCredits,
  uncensoredCharacterRef,
  isUncensoredCharacter,
  parseUncensoredCharacterRef,
} from "../../shared/uncensoredStudio";
import { resolveUncensoredLora } from "../_core/uncensoredStyleLora";
import { submitUncensoredVideoJob, collectUncensoredVideoJob, fetchAsBase64 } from "../_core/videoGenerationUncensored";
import { checkPrompt, logModerationBlock } from "../_core/promptModeration";
import { requireToolActive, logToolFailure, getToolStatus } from "../_core/toolStatus";
import { isRunPodAvailable, runpodUpscale, runpodRemoveBackground, runpodTryOn } from "../_core/runpod";
import { deductCredits, refundCredits } from "../stripe";
import { CREDIT_COSTS } from "../../shared/creditCosts";
import { enforceRateLimit } from "../rate-limit";

// Uncensored video is GPU-expensive (Wan 2.2, minutes/clip) → pass-gated, no
// free tier. Two quality tiers: "fast" = 5B TI2V (~90s, 48GB); "hd" = 14B A14B
// top-quality on the dedicated 80GB endpoint (~2-4min, ~3× the GPU time → priced up).
const UNCENSORED_VIDEO_COST = {
  fast: {
    t2v: CREDIT_COSTS.videoGeneration.short5s, // 50
    i2v: CREDIT_COSTS.imageToVideo.basic, // 40
  },
  hd: {
    t2v: 120,
    i2v: 100,
  },
} as const;
// Refining costs a full generation on the GPU (same 20-step Flux pass), so it
// is priced like a quality image rather than as a cheap tweak.
const UNCENSORED_REFINE_COST = 10;

// Free uncensored previews — the conversion hook. Lifetime cap per user
// (tracked via generation metadata, no schema change) + a global daily cap so
// abuse can't run up the GPU bill.
// Single source of truth — the landing pages advertise this same number.
const FREE_UNCENSORED_LIMIT = FREE_UNCENSORED_PREVIEWS;
const FREE_UNCENSORED_GLOBAL_DAILY_CAP = 500;

async function countFreeUncensored(userId: number): Promise<number> {
  const db = await requireDb();
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(generations)
    .where(and(eq(generations.userId, userId), sql`${generations.metadata}->>'free' = 'true'`));
  return Number(rows[0]?.c ?? 0);
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function isHiddenUncensored(metadata: unknown): boolean {
  return !!(metadata && typeof metadata === "object" && (metadata as { deleted?: unknown }).deleted === true);
}

const notDeletedUncensored = sql`coalesce(${generations.metadata}->>'deleted','false') <> 'true'`;

async function requireOwnUncensoredImage(userId: number, id: number) {
  const src = await getGenerationById(id);
  if (!src || src.userId !== userId || isHiddenUncensored(src.metadata)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That generation isn't available." });
  }
  if (src.mediaType !== "image" || src.status !== "completed" || !src.imageUrl) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only your completed image generations can be used here." });
  }
  if (!(src.metadata as any)?.uncensored) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only uncensored generations can be used here." });
  }
  return src;
}

async function requireOwnUncensoredMedia(userId: number, id: number) {
  const src = await getGenerationById(id);
  if (!src || src.userId !== userId || isHiddenUncensored(src.metadata)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That generation isn't available." });
  }
  if (src.status !== "completed" || !src.imageUrl) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only your completed generations can be used here." });
  }
  if (!(src.metadata as any)?.uncensored) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Only uncensored generations can be used here." });
  }
  return src;
}

async function resolveUncensoredLock(
  userId: number,
  input: { characterGenerationId?: number; savedCharacterId?: number },
): Promise<{ url: string; generationId: number; savedCharacterId: number | null; style?: string } | null> {
  const lockGenerationId = input.characterGenerationId
    ?? (input.savedCharacterId
      ? (await requireOwnUncensoredCharacter(userId, input.savedCharacterId)).generationId
      : null);
  if (!lockGenerationId) return null;
  const src = await requireOwnUncensoredImage(userId, lockGenerationId);
  return {
    url: src.imageUrl!,
    generationId: src.id,
    savedCharacterId: input.savedCharacterId ?? null,
    style: (src.metadata as any)?.style ?? undefined,
  };
}

async function requireOwnUncensoredCharacter(userId: number, id: number) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), eq(characters.userId, userId)))
    .limit(1);
  const char = rows[0];
  const generationId = parseUncensoredCharacterRef(char?.styleNotes);
  if (!char || !generationId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That character isn't available." });
  }
  return { char, generationId };
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load the source image.");
  return Buffer.from(await res.arrayBuffer());
}

function parseMaskDataUrl(dataUrl: string): Buffer {
  const m = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mask must be a PNG from the inpaint brush." });
  }
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 32 || buf.length > 1_800_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Mask is empty or too large." });
  }
  return buf;
}

async function blendMasked(source: Buffer, painted: Buffer, mask: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(source).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const maskPng = await sharp(mask).resize(width, height, { fit: "fill" }).greyscale().png().toBuffer();
  const overlay = await sharp(painted)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .composite([{ input: maskPng, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(source).composite([{ input: overlay, blend: "over" }]).png().toBuffer();
}

export async function getUncensoredEntitlement(userId: number): Promise<{
  active: boolean;
  until: Date | null;
  ageConfirmed: boolean;
}> {
  const db = await requireDb();
  const rows = await db
    .select({ uncensoredUntil: users.uncensoredUntil, ageConfirmedAt: users.ageConfirmedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const u = rows[0];
  const until = u?.uncensoredUntil ?? null;
  return {
    active: !!until && until.getTime() > Date.now(),
    until,
    ageConfirmed: !!u?.ageConfirmedAt,
  };
}

export const uncensoredRouter = router({
  /** Current entitlement + plan info for the signed-in user. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const ent = await getUncensoredEntitlement(ctx.user.id);
    let freeUsed = 0;
    try {
      freeUsed = await countFreeUncensored(ctx.user.id);
    } catch {
      /* counting failure must not break the page */
    }
    // Video is behind its own kill-switch + needs a GPU worker. Ships OFF and
    // flips ON once the Wan endpoint is live (setToolStatus uncensored-video).
    let videoAvailable = false;
    try {
      const vs = await getToolStatus("uncensored-video");
      videoAvailable = vs.status !== "offline" && isRunPodAvailable();
    } catch {
      /* default to unavailable */
    }
    return {
      ...ent,
      plan: UNCENSORED_PLAN,
      plans: UNCENSORED_PLANS,
      available: isBtcpayConfigured(),
      freeUsed,
      freeLimit: FREE_UNCENSORED_LIMIT,
      freeRemaining: Math.max(0, FREE_UNCENSORED_LIMIT - freeUsed),
      videoCost: UNCENSORED_VIDEO_COST,
      videoAvailable,
      refineCost: UNCENSORED_REFINE_COST,
      styles: UNCENSORED_STYLES,
      imageCost: UNCENSORED_IMAGE_COST,
      aspects: UNCENSORED_ASPECTS,
      framings: UNCENSORED_FRAMINGS,
      sheetViews: UNCENSORED_SHEET_VIEWS,
      poses: UNCENSORED_POSES,
      cameras: UNCENSORED_CAMERAS,
      lighting: UNCENSORED_LIGHTING,
      wardrobe: UNCENSORED_WARDROBE,
      settings: UNCENSORED_SETTINGS,
      videoDurations: UNCENSORED_VIDEO_DURATIONS,
      videoMotions: UNCENSORED_VIDEO_MOTIONS,
      videoIntensities: UNCENSORED_VIDEO_INTENSITIES,
    };
  }),

  /**
   * Paid uncensored image studio — the product pass-holders actually came for.
   *
   * Workspace had an uncensored toggle that still rendered square 1024 and
   * watermarked Stripe-free accounts. This is the dedicated path: portrait
   * default, quality tier, framing, seed, variations, and optional
   * same-character lock against one of the caller's own generations.
   */
  generate: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(1000),
        negativePrompt: z.string().max(500).optional(),
        style: z.string().max(32).optional(),
        aspect: z.string().max(16).optional(),
        framing: z.string().max(32).optional(),
        quality: z.enum(["fast", "quality"]).default("fast"),
        seed: z.number().int().min(0).max(2_147_483_647).optional(),
        count: z.number().int().min(1).max(4).default(1),
        pose: z.string().max(32).optional(),
        camera: z.string().max(32).optional(),
        lighting: z.string().max(32).optional(),
        wardrobe: z.string().max(32).optional(),
        setting: z.string().max(32).optional(),
        characterStrength: z.number().min(0.25).max(0.7).optional(),
        characterGenerationId: z.number().int().positive().optional(),
        savedCharacterId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");

      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active Uncensored Pass is required. Grab a pass to unlock the studio.",
        });
      }

      const verdict = checkPrompt(input.prompt, {
        strictMinors: true,
        negativePrompt: input.negativePrompt ?? null,
      });
      if (!verdict.allowed) {
        await logModerationBlock({
          category: verdict.category,
          promptLen: input.prompt.length,
          userId: ctx.user.id,
          surface: "uncensored.generate",
          prompt: input.prompt,
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: verdict.userMessage });
      }

      let characterUrl: string | null = null;
      let characterId: number | null = null;
      let savedCharacterId: number | null = null;
      const lock = await resolveUncensoredLock(ctx.user.id, input);
      if (lock) {
        characterUrl = lock.url;
        characterId = lock.generationId;
        savedCharacterId = lock.savedCharacterId;
      }

      const unitCost = characterUrl
        ? UNCENSORED_IMAGE_COST.character
        : UNCENSORED_IMAGE_COST[input.quality];
      const cost = unitCost * input.count;

      await enforceRateLimit(
        `uncensored.generate:user:${ctx.user.id}`,
        8,
        60_000,
        "Slow down a moment between generations.",
      );

      const debit = await deductCredits(
        ctx.user.id,
        cost,
        `Uncensored ${characterUrl ? "character" : input.quality} ×${input.count}`,
        "usage",
        { uncensored: true, quality: input.quality, count: input.count },
      );
      if (!debit.success) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.`,
        });
      }

      const aspect = getUncensoredAspect(input.aspect);
      const characterStrength = characterUrl ? clampCharacterStrength(input.characterStrength) : null;
      let prompt = applyUncensoredFraming(input.prompt, input.framing);
      prompt = applyUncensoredPose(prompt, input.pose);
      prompt = applyUncensoredCamera(prompt, input.camera);
      prompt = applyUncensoredLighting(prompt, input.lighting);
      prompt = applyUncensoredWardrobe(prompt, input.wardrobe);
      prompt = applyUncensoredSetting(prompt, input.setting);
      prompt = applyUncensoredStyle(prompt, input.style);
      const negative = [DEFAULT_UNCENSORED_NEGATIVE, input.negativePrompt?.trim()].filter(Boolean).join(", ");
      if (negative) {
        prompt = `${prompt}. Avoid: ${negative}`;
      }
      if (characterUrl) {
        prompt = `same character identity, same face, same body type, new scene. ${prompt}`;
      }

      const loraId = resolveUncensoredLora(input.style);
      const results: { generationId: number; url: string; seed: number | null }[] = [];
      let failed = 0;
      const baseSeed =
        typeof input.seed === "number" ? input.seed : Math.floor(Math.random() * 2_147_483_646);

      for (let i = 0; i < input.count; i++) {
        const seed = baseSeed + i;
        const genId = await createGeneration({
          userId: ctx.user.id,
          prompt: input.prompt,
          negativePrompt: input.negativePrompt ?? null,
          mediaType: "image",
          width: aspect.width,
          height: aspect.height,
          duration: null,
          status: "generating",
          modelVersion: characterUrl ? "uncensored-character" : `uncensored-${input.quality}`,
          parentGenerationId: characterId,
          metadata: {
            uncensored: true,
            style: input.style ?? null,
            framing: input.framing ?? null,
            pose: input.pose ?? null,
            camera: input.camera ?? null,
            lighting: input.lighting ?? null,
            wardrobe: input.wardrobe ?? null,
            setting: input.setting ?? null,
            quality: input.quality,
            seed: seed ?? null,
            cost: unitCost,
            character: !!characterUrl,
            characterStrength,
            savedCharacterId,
          },
        });

        try {
          let url: string;
          if (characterUrl) {
            const imageB64 = await fetchAsBase64(characterUrl);
            const buffer = await refineUnfiltered(imageB64, prompt, {
              strength: characterStrength ?? 0.45,
              loraId,
              seed,
            });
            const key = generateStorageKey("generations", "png");
            ({ url } = await storagePut(key, buffer, "image/png"));
            await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url, fileKey: key });
          } else {
            const gen = await generateImage({
              prompt,
              model: "auto",
              size: `${aspect.width}x${aspect.height}`,
              userTier: "pro",
              unfiltered: true,
              unfilteredQuality: input.quality,
              loraId,
              seed,
            });
            url = gen.url!;
            await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url });
          }
          results.push({ generationId: genId, url, seed });
        } catch (err: any) {
          failed += 1;
          await updateGeneration(genId, { status: "failed" });
          await logToolFailure({ toolId: "uncensored-generate", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        }
      }

      if (results.length === 0) {
        await refundCredits(ctx.user.id, cost, "Uncensored generate failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Generation failed — your credits were returned. Please try again.",
        });
      }

      if (failed > 0) {
        await refundCredits(ctx.user.id, unitCost * failed, `Uncensored generate partial fail ×${failed}`);
      }

      return {
        images: results,
        cost: unitCost * results.length,
        creditsRemaining: debit.balance - unitCost * failed,
      };
    }),

  /**
   * Uncensored video generation — Wan 2.2 on self-hosted GPU (no free tier).
   * Requires an active pass; text-to-video, or image-to-video that animates one
   * of the caller's OWN prior uncensored generations. Prompt is moderated
   * before any credit debit or GPU call; a failure refunds the credits.
   */
  generateVideo: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(1000),
        mode: z.enum(["t2v", "i2v"]).default("t2v"),
        quality: z.enum(["fast", "hd"]).default("fast"),
        sourceGenerationId: z.number().int().positive().optional(),
        aspect: z.enum(["portrait", "landscape", "square"]).default("portrait"),
        duration: z.enum(["5s", "8s", "10s"]).default("5s" as const),
        motion: z.string().max(32).optional(),
        intensity: z.enum(["subtle", "natural", "energetic"]).default("natural"),
        negativePrompt: z.string().max(500).optional(),
        seed: z.number().int().min(0).max(2_147_483_647).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("uncensored-video");

      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required for video. Grab a pass to unlock it." });
      }

      // Illegal-content refusal BEFORE credits or GPU.
      const verdict = checkPrompt(input.prompt, { strictMinors: true });
      if (!verdict.allowed) {
        await logModerationBlock({ category: verdict.category, promptLen: input.prompt.length, userId: ctx.user.id, surface: "uncensored.generateVideo", prompt: input.prompt });
        throw new TRPCError({ code: "BAD_REQUEST", message: verdict.userMessage });
      }

      // Resolve the image-to-video source: it MUST be the caller's own completed
      // uncensored image generation. We never animate arbitrary uploads (v1) —
      // that sidesteps real-person / minor liability on unknown images.
      let sourceImageUrl: string | null = null;
      let parentGenerationId: number | null = null;
      if (input.mode === "i2v") {
        if (!input.sourceGenerationId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Pick one of your generations to animate." });
        }
        const src = await requireOwnUncensoredImage(ctx.user.id, input.sourceGenerationId);
        sourceImageUrl = src.imageUrl;
        parentGenerationId = src.id;
      }

      const duration = getUncensoredVideoDuration(input.duration);
      const cost = uncensoredVideoCredits(UNCENSORED_VIDEO_COST[input.quality][input.mode], duration.id);
      let gpuPrompt = applyUncensoredI2vIdentity(input.prompt, input.mode === "i2v");
      gpuPrompt = applyUncensoredVideoMotion(gpuPrompt, input.motion);
      gpuPrompt = applyUncensoredVideoIntensity(gpuPrompt, input.intensity);
      const negative = [DEFAULT_UNCENSORED_VIDEO_NEGATIVE, input.negativePrompt?.trim()].filter(Boolean).join(", ");
      const debit = await deductCredits(ctx.user.id, cost, `Uncensored ${input.quality} ${input.mode === "i2v" ? "image-to-video" : "video"} ${duration.label}`, "usage", { uncensored: true, video: true, mode: input.mode, quality: input.quality, duration: duration.id });
      if (!debit.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.` });
      }

      const dims = getUncensoredVideoSize(input.aspect, input.quality);
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt ?? null,
        mediaType: "video",
        width: dims.w,
        height: dims.h,
        duration: duration.seconds,
        status: "generating",
        modelVersion: "uncensored-wan-2.2",
        parentGenerationId,
        animationStyle: input.mode === "i2v" ? "wan-i2v" : null,
        thumbnailUrl: sourceImageUrl,
        metadata: { uncensored: true, video: true, mode: input.mode, quality: input.quality, duration: duration.id, motion: input.motion ?? null, intensity: input.intensity, seed: input.seed ?? null, cost },
      });

      // Submit the job and return immediately — video outlasts a serverless
      // function, so the client polls uncensored.videoStatus(generationId).
      try {
        const { jobId } = await submitUncensoredVideoJob({
          prompt: gpuPrompt,
          userId: ctx.user.id,
          sourceImageUrl,
          width: dims.w,
          height: dims.h,
          numFrames: duration.numFrames,
          fps: duration.fps,
          seed: input.seed,
          negativePrompt: negative,
          tier: input.quality,
          loraId: resolveUncensoredLora("video"),
        });
        await updateGeneration(genId, {
          metadata: { uncensored: true, video: true, mode: input.mode, quality: input.quality, duration: duration.id, motion: input.motion ?? null, intensity: input.intensity, seed: input.seed ?? null, cost, runpodJobId: jobId },
        });
        return { generationId: genId, status: "processing" as const, creditsRemaining: debit.balance };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        await refundCredits(ctx.user.id, cost, "Uncensored video submit failed");
        await logToolFailure({ toolId: "uncensored-video", errorMessage: err?.message, userId: ctx.user.id });
        const msg = typeof err?.userMessage === "string" ? err.userMessage : "Couldn't start the video — your credits were refunded. Please try again.";
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  /**
   * Poll a submitted video generation. Idempotent: the first poll that sees the
   * RunPod job COMPLETED uploads the mp4 to R2 and atomically claims the
   * generating→completed transition; a FAILED job atomically claims
   * generating→failed and refunds exactly once. Concurrent polls can't
   * double-grant or double-refund.
   */
  videoStatus: protectedProcedure
    .input(z.object({ generationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const gen = await getGenerationById(input.generationId);
      if (!gen || gen.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generation not found." });
      }
      if (gen.status === "completed") {
        const doneMeta = (gen.metadata as any) ?? {};
        return { status: "completed" as const, url: gen.imageUrl, seed: typeof doneMeta.seed === "number" ? doneMeta.seed : null };
      }
      if (gen.status === "failed") return { status: "failed" as const, url: null, seed: null };

      const meta = (gen.metadata as any) ?? {};
      const jobId: string | undefined = meta.runpodJobId;
      if (!jobId) return { status: "processing" as const, url: null, seed: null }; // submit not yet recorded

      const result = await collectUncensoredVideoJob(jobId);
      const db = await requireDb();

      if (result.status === "completed") {
        // Claim the transition; if another poll already did, the mp4 we just
        // stored is a harmless orphan.
        await db
          .update(generations)
          .set({ status: "completed", imageUrl: result.url, fileKey: result.key })
          .where(and(eq(generations.id, gen.id), eq(generations.status, "generating")));
        const doneMeta = (gen.metadata as any) ?? {};
        return { status: "completed" as const, url: result.url, seed: typeof doneMeta.seed === "number" ? doneMeta.seed : null };
      }
      if (result.status === "failed") {
        const claimed = await db
          .update(generations)
          .set({ status: "failed" })
          .where(and(eq(generations.id, gen.id), eq(generations.status, "generating")))
          .returning({ id: generations.id });
        if (claimed.length) {
          await refundCredits(ctx.user.id, Number(meta.cost) || 0, "Uncensored video generation failed");
          await logToolFailure({ toolId: "uncensored-video", errorMessage: result.error, userId: ctx.user.id });
        }
        return { status: "failed" as const, url: null, seed: null };
      }
      return { status: "processing" as const, url: null, seed: null };
    }),

  /**
   * Refine an uncensored image — img2img on one of the caller's OWN generations.
   *
   * This is the most-requested workflow in our own logs, phrased over and over
   * as "change this one thing and leave the rest alone". Serving it against
   * uploaded photos would make this a nudify service — the archetypal vector
   * for non-consensual intimate imagery — so uploads are not accepted at all.
   * The input is a generation id, resolved to an image this user already made
   * here, which means the subject is always a fictional character we generated.
   * A self-attested "it's my own photo" checkbox would be unverifiable theatre;
   * the type signature is the control.
   *
   * Pass-gated with no free tier: this is the paid iteration loop.
   */
  refineImage: protectedProcedure
    .input(
      z.object({
        sourceGenerationId: z.number().int().positive(),
        prompt: z.string().min(3).max(1000),
        // How far from the source to travel. Low keeps the character and
        // changes a detail; high re-imagines the scene.
        strength: z.number().min(0.2).max(0.9).default(0.6),
        style: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");

      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active Uncensored Pass is required to refine images. Grab a pass to unlock it.",
        });
      }

      // Illegal-content refusal BEFORE credits or GPU.
      const verdict = checkPrompt(input.prompt, { strictMinors: true });
      if (!verdict.allowed) {
        await logModerationBlock({
          category: verdict.category,
          promptLen: input.prompt.length,
          userId: ctx.user.id,
          surface: "uncensored.refineImage",
          prompt: input.prompt,
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: verdict.userMessage });
      }

      // Ownership gate — the whole legal basis for this feature. Same rule the
      // image-to-video path enforces: the caller's own completed uncensored
      // image, never anything else.
      const src = await getGenerationById(input.sourceGenerationId);
      if (!src || src.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That generation isn't available to refine." });
      }
      if (src.mediaType !== "image" || src.status !== "completed" || !src.imageUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only your completed image generations can be refined." });
      }
      if (!(src.metadata as any)?.uncensored) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only uncensored generations can be refined here." });
      }

      await enforceRateLimit(`uncensored.refine:user:${ctx.user.id}`, 6, 60_000, "Slow down a moment between refines.");

      const debit = await deductCredits(
        ctx.user.id,
        UNCENSORED_REFINE_COST,
        "Uncensored image refine",
        "usage",
        { uncensored: true, refine: true },
      );
      if (!debit.success) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Not enough credits — this needs ${UNCENSORED_REFINE_COST}, you have ${debit.balance}.`,
        });
      }

      const style = input.style ?? (src.metadata as any)?.style ?? undefined;
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: input.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: src.width ?? 768,
        height: src.height ?? 768,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-refine",
        parentGenerationId: src.id,
        metadata: {
          uncensored: true,
          refine: true,
          style: style ?? null,
          strength: input.strength,
          cost: UNCENSORED_REFINE_COST,
        },
      });

      try {
        const imageB64 = await fetchAsBase64(src.imageUrl);
        const buffer = await refineUnfiltered(imageB64, applyUncensoredStyle(input.prompt, style), {
          strength: input.strength,
          loraId: resolveUncensoredLora(style),
        });
        const key = generateStorageKey("generations", "png");
        const { url } = await storagePut(key, buffer, "image/png");
        await updateGeneration(genId, {
          status: "completed",
          imageUrl: url,
          thumbnailUrl: url,
          fileKey: key,
        });
        return { generationId: genId, url, cost: UNCENSORED_REFINE_COST };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        // The credit is refunded on every failure path — a refine that produced
        // nothing must never be billable.
        await refundCredits(ctx.user.id, UNCENSORED_REFINE_COST, "Uncensored refine failed");
        await logToolFailure({ toolId: "uncensored-refine", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        const msg = typeof err?.userMessage === "string" ? err.userMessage : "Refine failed — your credits were returned.";
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  /**
   * Real-ESRGAN upscale of the caller's own uncensored image. No LLM fallback
   * — that path would route through a filtered provider and silently censor.
   */
  upscale: protectedProcedure
    .input(
      z.object({
        sourceGenerationId: z.number().int().positive(),
        scale: z.enum(["2x", "4x"]).default("2x"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required to upscale." });
      }

      const src = await requireOwnUncensoredImage(ctx.user.id, input.sourceGenerationId);
      if (!isRunPodAvailable()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The upscaler GPU is unavailable right now." });
      }

      const cost = input.scale === "4x" ? UNCENSORED_IMAGE_COST.upscale4x : UNCENSORED_IMAGE_COST.upscale2x;
      await enforceRateLimit(`uncensored.upscale:user:${ctx.user.id}`, 6, 60_000, "Slow down a moment between upscales.");
      const debit = await deductCredits(ctx.user.id, cost, `Uncensored upscale ${input.scale}`, "usage", { uncensored: true, upscale: input.scale });
      if (!debit.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.` });
      }

      const scale = input.scale === "4x" ? 4 : 2;
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: src.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: (src.width ?? 832) * scale,
        height: (src.height ?? 1216) * scale,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-upscale",
        parentGenerationId: src.id,
        metadata: { uncensored: true, upscale: input.scale, cost, style: (src.metadata as any)?.style ?? null },
      });

      try {
        const buf = await fetchImageBuffer(src.imageUrl!);
        const result = await runpodUpscale(buf.toString("base64"), scale);
        const key = generateStorageKey("generations", "png");
        const { url } = await storagePut(key, result, "image/png");
        await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url, fileKey: key });
        return { generationId: genId, url, cost };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        await refundCredits(ctx.user.id, cost, "Uncensored upscale failed");
        await logToolFailure({ toolId: "uncensored-upscale", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upscale failed — your credits were returned." });
      }
    }),

  /**
   * Four-view identity sheet from a locked character. Same legal gate as
   * character lock: only the caller's own uncensored gens.
   */
  characterSheet: protectedProcedure
    .input(
      z.object({
        characterGenerationId: z.number().int().positive().optional(),
        savedCharacterId: z.number().int().positive().optional(),
        style: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required." });
      }

      const lock = await resolveUncensoredLock(ctx.user.id, input);
      if (!lock) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick one of your characters first." });
      }

      const cost = UNCENSORED_IMAGE_COST.sheet;
      const unitCost = Math.round(cost / UNCENSORED_SHEET_VIEWS.length);
      await enforceRateLimit(`uncensored.sheet:user:${ctx.user.id}`, 3, 60_000, "Slow down a moment between sheets.");
      const debit = await deductCredits(ctx.user.id, cost, "Uncensored character sheet", "usage", { uncensored: true, sheet: true });
      if (!debit.success) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.`,
        });
      }

      const style = input.style ?? lock.style;
      const loraId = resolveUncensoredLora(style);
      const aspect = getUncensoredAspect("portrait");
      const results: { generationId: number; url: string; view: string }[] = [];
      let failed = 0;
      const imageB64 = await fetchAsBase64(lock.url);

      for (const view of UNCENSORED_SHEET_VIEWS) {
        let prompt = `same character identity, same face, same body type. ${view.promptSuffix}`;
        prompt = applyUncensoredStyle(prompt, style);
        prompt = `${prompt}. Avoid: ${DEFAULT_UNCENSORED_NEGATIVE}`;
        const genId = await createGeneration({
          userId: ctx.user.id,
          prompt: view.label,
          negativePrompt: null,
          mediaType: "image",
          width: aspect.width,
          height: aspect.height,
          duration: null,
          status: "generating",
          modelVersion: "uncensored-sheet",
          parentGenerationId: lock.generationId,
          metadata: {
            uncensored: true,
            sheet: true,
            view: view.id,
            style: style ?? null,
            cost: unitCost,
            savedCharacterId: lock.savedCharacterId,
            character: true,
          },
        });
        try {
          const buffer = await refineUnfiltered(imageB64, prompt, { strength: 0.4, loraId });
          const key = generateStorageKey("generations", "png");
          const { url } = await storagePut(key, buffer, "image/png");
          await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url, fileKey: key });
          results.push({ generationId: genId, url, view: view.id });
        } catch (err: any) {
          failed += 1;
          await updateGeneration(genId, { status: "failed" });
          await logToolFailure({ toolId: "uncensored-sheet", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        }
      }

      if (results.length === 0) {
        await refundCredits(ctx.user.id, cost, "Uncensored character sheet failed");
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Character sheet failed — your credits were returned.",
        });
      }
      if (failed > 0) {
        await refundCredits(ctx.user.id, unitCost * failed, `Uncensored sheet partial fail ×${failed}`);
      }
      return { images: results, cost: unitCost * results.length };
    }),

  /**
   * RMBG cutout of the caller's own uncensored image. No uploads.
   */
  removeBackground: protectedProcedure
    .input(z.object({ sourceGenerationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required." });
      }
      const src = await requireOwnUncensoredImage(ctx.user.id, input.sourceGenerationId);
      if (!isRunPodAvailable()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The GPU is unavailable right now." });
      }
      const cost = UNCENSORED_IMAGE_COST.cutout;
      await enforceRateLimit(`uncensored.cutout:user:${ctx.user.id}`, 8, 60_000, "Slow down a moment between cutouts.");
      const debit = await deductCredits(ctx.user.id, cost, "Uncensored cutout", "usage", { uncensored: true, cutout: true });
      if (!debit.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.` });
      }
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: src.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: src.width ?? 832,
        height: src.height ?? 1216,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-cutout",
        parentGenerationId: src.id,
        metadata: { uncensored: true, cutout: true, cost, style: (src.metadata as any)?.style ?? null },
      });
      try {
        const buf = await fetchImageBuffer(src.imageUrl!);
        const result = await runpodRemoveBackground(buf.toString("base64"));
        const key = generateStorageKey("generations", "png");
        const { url } = await storagePut(key, result, "image/png");
        await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url, fileKey: key });
        return { generationId: genId, url, cost };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        await refundCredits(ctx.user.id, cost, "Uncensored cutout failed");
        await logToolFailure({ toolId: "uncensored-cutout", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cutout failed — your credits were returned." });
      }
    }),

  /**
   * Outfit transfer: CatVTON between two of the caller's own uncensored gens.
   * Person + garment must both already exist here — never an upload.
   */
  outfit: protectedProcedure
    .input(
      z.object({
        personGenerationId: z.number().int().positive(),
        garmentGenerationId: z.number().int().positive(),
        clothType: z.enum(["upper", "lower", "overall"]).default("overall"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required." });
      }
      if (input.personGenerationId === input.garmentGenerationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Pick two different images — the person, and the outfit to copy." });
      }
      const person = await requireOwnUncensoredImage(ctx.user.id, input.personGenerationId);
      const garment = await requireOwnUncensoredImage(ctx.user.id, input.garmentGenerationId);
      if (!isRunPodAvailable()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The GPU is unavailable right now." });
      }
      const cost = UNCENSORED_IMAGE_COST.outfit;
      await enforceRateLimit(`uncensored.outfit:user:${ctx.user.id}`, 4, 60_000, "Slow down a moment between outfits.");
      const debit = await deductCredits(ctx.user.id, cost, "Uncensored outfit transfer", "usage", { uncensored: true, outfit: true });
      if (!debit.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.` });
      }
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: `outfit from #${garment.id} onto #${person.id}`,
        negativePrompt: null,
        mediaType: "image",
        width: person.width ?? 768,
        height: person.height ?? 1024,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-outfit",
        parentGenerationId: person.id,
        metadata: {
          uncensored: true,
          outfit: true,
          clothType: input.clothType,
          garmentGenerationId: garment.id,
          cost,
        },
      });
      try {
        const result = await runpodTryOn(person.imageUrl!, garment.imageUrl!, input.clothType);
        const key = generateStorageKey("generations", "png");
        const { url } = await storagePut(key, result, "image/png");
        await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url, fileKey: key });
        return { generationId: genId, url, cost };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        await refundCredits(ctx.user.id, cost, "Uncensored outfit transfer failed");
        await logToolFailure({ toolId: "uncensored-outfit", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Outfit transfer failed — your credits were returned." });
      }
    }),

  /**
   * Paint-region inpaint on the caller's own uncensored image.
   *
   * Flux img2img has no native mask, so we img2img the whole frame then blend
   * the result back through the brush mask. Only the painted region changes;
   * the rest of the source is preserved pixel-for-pixel. Uploads are not
   * accepted — same legal basis as Refine.
   */
  inpaint: protectedProcedure
    .input(
      z.object({
        sourceGenerationId: z.number().int().positive(),
        prompt: z.string().min(3).max(1000),
        maskDataUrl: z.string().min(32).max(2_000_000),
        strength: z.number().min(0.3).max(0.85).default(0.55),
        style: z.string().max(32).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required to inpaint." });
      }

      const verdict = checkPrompt(input.prompt, { strictMinors: true });
      if (!verdict.allowed) {
        await logModerationBlock({
          category: verdict.category,
          promptLen: input.prompt.length,
          userId: ctx.user.id,
          surface: "uncensored.inpaint",
          prompt: input.prompt,
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: verdict.userMessage });
      }

      const src = await requireOwnUncensoredImage(ctx.user.id, input.sourceGenerationId);
      const maskBuf = parseMaskDataUrl(input.maskDataUrl);
      {
        const sharp = (await import("sharp")).default;
        try {
          const stats = await sharp(maskBuf).greyscale().stats();
          if ((stats.channels[0]?.max ?? 0) < 16) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Paint the region you want to change first." });
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          throw new TRPCError({ code: "BAD_REQUEST", message: "Paint the region you want to change first." });
        }
      }

      const cost = UNCENSORED_IMAGE_COST.inpaint;
      await enforceRateLimit(`uncensored.inpaint:user:${ctx.user.id}`, 6, 60_000, "Slow down a moment between inpaints.");
      const debit = await deductCredits(ctx.user.id, cost, "Uncensored inpaint", "usage", { uncensored: true, inpaint: true });
      if (!debit.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.` });
      }

      const style = input.style ?? (src.metadata as any)?.style ?? undefined;
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: input.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: src.width ?? 832,
        height: src.height ?? 1216,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-inpaint",
        parentGenerationId: src.id,
        metadata: { uncensored: true, inpaint: true, style: style ?? null, strength: input.strength, cost },
      });

      try {
        const imageB64 = await fetchAsBase64(src.imageUrl!);
        const painted = await refineUnfiltered(
          imageB64,
          applyUncensoredStyle(`ONLY change the painted region: ${input.prompt}. Leave everything outside the region identical.`, style),
          { strength: input.strength, loraId: resolveUncensoredLora(style) },
        );
        const sourceBuf = await fetchImageBuffer(src.imageUrl!);
        const blended = await blendMasked(sourceBuf, painted, maskBuf);
        const key = generateStorageKey("generations", "png");
        const { url } = await storagePut(key, blended, "image/png");
        await updateGeneration(genId, { status: "completed", imageUrl: url, thumbnailUrl: url, fileKey: key });
        return { generationId: genId, url, cost };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        await refundCredits(ctx.user.id, cost, "Uncensored inpaint failed");
        await logToolFailure({ toolId: "uncensored-inpaint", errorMessage: err?.message ?? String(err), userId: ctx.user.id });
        const msg = typeof err?.userMessage === "string" ? err.userMessage : "Inpaint failed — your credits were returned.";
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  /**
   * Free uncensored preview — the conversion hook. Age-gated, watermarked,
   * private, capped at FREE_UNCENSORED_LIMIT lifetime per user with a global
   * daily cost cap. Every prompt passes the strict moderation gate (and the
   * generateUnfiltered backstop) before any GPU call.
   */
  freeGenerate: protectedProcedure
    .input(z.object({
      prompt: z.string().min(3).max(1000),
      style: z.string().max(32).optional(),
      aspect: z.string().max(16).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("text-to-image");

      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (ent.active) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You have an active pass — generate in the Studio." });
      }
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }

      // Illegal-content refusal BEFORE any quota burn or GPU call.
      const verdict = checkPrompt(input.prompt, { strictMinors: true });
      if (!verdict.allowed) {
        await logModerationBlock({ category: verdict.category, promptLen: input.prompt.length, userId: ctx.user.id, surface: "uncensored.freeGenerate", prompt: input.prompt });
        throw new TRPCError({ code: "BAD_REQUEST", message: verdict.userMessage });
      }

      // Anti-spam (per user) + global daily cost cap (protects RunPod).
      await enforceRateLimit(`uncensored.free:user:${ctx.user.id}`, 3, 60_000, "Slow down a moment between generations.");
      await enforceRateLimit("uncensored.free:global", FREE_UNCENSORED_GLOBAL_DAILY_CAP, 24 * 60 * 60 * 1000, "Free previews are at capacity for today — grab a pass to keep going.");

      // Lifetime free quota.
      const used = await countFreeUncensored(ctx.user.id);
      if (used >= FREE_UNCENSORED_LIMIT) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You've used your free previews. Unlock a pass to keep generating uncensored." });
      }

      const enhancedPrompt = applyUncensoredStyle(input.prompt, input.style);
      const loraId = resolveUncensoredLora(input.style);
      const aspect = getUncensoredAspect(input.aspect);
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: input.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: aspect.width,
        height: aspect.height,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-free",
        metadata: { uncensored: true, free: true, style: input.style ?? null, aspect: aspect.id },
      });

      try {
        const { url } = await generateImage({
          prompt: enhancedPrompt,
          model: "auto",
          size: `${aspect.width}x${aspect.height}`,
          userTier: "free",
          unfiltered: true,
          loraId,
        });
        await updateGeneration(genId, { status: "completed", imageUrl: url ?? null, thumbnailUrl: url ?? null });
        return { url, remaining: Math.max(0, FREE_UNCENSORED_LIMIT - used - 1) };
      } catch (err: any) {
        await updateGeneration(genId, { status: "failed" });
        // PromptBlockedError from the backstop carries a userMessage.
        const msg = typeof err?.userMessage === "string" ? err.userMessage : "Generation failed — please try again.";
        throw new TRPCError({ code: "BAD_REQUEST", message: msg });
      }
    }),

  /** One-time 18+ attestation. Required before purchase or generation. */
  confirmAge: protectedProcedure
    .input(z.object({ confirmed: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.update(users).set({ ageConfirmedAt: new Date() }).where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  /** Create a BTCPay invoice for the Uncensored Pass; returns checkout URL. */
  createCheckout: protectedProcedure
    .input(z.object({ planId: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (!isBtcpayConfigured()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crypto payments are temporarily unavailable." });
      }
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Age confirmation required first." });
      }

      const plan = getUncensoredPlanById(input?.planId);
      const { invoiceId, checkoutLink } = await createUncensoredInvoice({
        userId: ctx.user.id,
        email: ctx.user.email ?? null,
        redirectUrl: "https://dreamforgex.ai/uncensored?paid=1",
        planId: plan.id,
      });

      const db = await requireDb();
      await db.insert(cryptoInvoices).values({
        userId: ctx.user.id,
        invoiceId,
        plan: plan.id,
        amountUsdCents: Math.round(plan.priceUsd * 100),
        status: "new",
      });

      // invoiceId lets the client listen for BTCPay's postMessage status
      // events from the embedded checkout iframe (faster than polling).
      return { checkoutLink, invoiceId };
    }),

  /** The caller's recent completed uncensored images — the I2V "animate" picker. */
  myUncensoredImages: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db
      .select({
        id: generations.id,
        imageUrl: generations.imageUrl,
        prompt: generations.prompt,
        createdAt: generations.createdAt,
        width: generations.width,
        height: generations.height,
        parentGenerationId: generations.parentGenerationId,
        metadata: generations.metadata,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, ctx.user.id),
          eq(generations.mediaType, "image"),
          eq(generations.status, "completed"),
          sql`${generations.metadata}->>'uncensored' = 'true'`,
          notDeletedUncensored,
        ),
      )
      .orderBy(desc(generations.createdAt))
      .limit(96);
  }),

  /**
   * Named characters for the uncensored studio. Saved only from the caller's
   * own uncensored generations — the same ownership gate as character lock.
   * SFW character.list hides these via the styleNotes marker.
   */
  listCharacters: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    const rows = await db
      .select()
      .from(characters)
      .where(eq(characters.userId, ctx.user.id))
      .orderBy(desc(characters.createdAt));
    return rows
      .filter((c) => isUncensoredCharacter(c.styleNotes))
      .map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: Array.isArray(c.referenceImages) ? (c.referenceImages[0] as string | undefined) ?? null : null,
        generationId: parseUncensoredCharacterRef(c.styleNotes),
        createdAt: c.createdAt,
      }));
  }),

  saveCharacter: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(40),
        sourceGenerationId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ent = await getUncensoredEntitlement(ctx.user.id);
      if (!ent.ageConfirmed) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Confirm you are 18 or older first." });
      }
      if (!ent.active) {
        throw new TRPCError({ code: "FORBIDDEN", message: "An active Uncensored Pass is required." });
      }

      const src = await requireOwnUncensoredImage(ctx.user.id, input.sourceGenerationId);
      const db = await requireDb();
      const existing = await db
        .select({ id: characters.id, styleNotes: characters.styleNotes })
        .from(characters)
        .where(eq(characters.userId, ctx.user.id));
      const mine = existing.filter((c) => isUncensoredCharacter(c.styleNotes));
      if (mine.length >= UNCENSORED_CHARACTER_LIMIT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You already have ${UNCENSORED_CHARACTER_LIMIT} characters. Delete one to save another.`,
        });
      }

      const inserted = await db
        .insert(characters)
        .values({
          userId: ctx.user.id,
          name: input.name,
          description: src.prompt?.slice(0, 500) ?? null,
          referenceImages: [src.imageUrl],
          styleNotes: uncensoredCharacterRef(src.id),
        })
        .returning({ id: characters.id });

      return { id: inserted[0]!.id, name: input.name, generationId: src.id, imageUrl: src.imageUrl };
    }),

  deleteCharacter: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnUncensoredCharacter(ctx.user.id, input.id);
      const db = await requireDb();
      await db
        .delete(characters)
        .where(and(eq(characters.id, input.id), eq(characters.userId, ctx.user.id)));
      return { ok: true };
    }),

  updateCharacter: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).max(40).optional(),
        sourceGenerationId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { char } = await requireOwnUncensoredCharacter(ctx.user.id, input.id);
      if (!input.name && !input.sourceGenerationId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to update." });
      }
      const patch: { name?: string; description?: string | null; referenceImages?: string[]; styleNotes?: string } = {};
      if (input.name) patch.name = input.name;
      if (input.sourceGenerationId) {
        const src = await requireOwnUncensoredImage(ctx.user.id, input.sourceGenerationId);
        patch.description = src.prompt?.slice(0, 500) ?? null;
        patch.referenceImages = src.imageUrl ? [src.imageUrl] : [];
        patch.styleNotes = uncensoredCharacterRef(src.id);
      }
      const db = await requireDb();
      await db
        .update(characters)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(characters.id, input.id), eq(characters.userId, ctx.user.id)));
      const generationId = input.sourceGenerationId ?? parseUncensoredCharacterRef(char.styleNotes);
      const imageUrl = (patch.referenceImages?.[0] as string | undefined)
        ?? (Array.isArray(char.referenceImages) ? (char.referenceImages[0] as string | undefined) : undefined)
        ?? null;
      return {
        id: input.id,
        name: patch.name ?? char.name,
        generationId,
        imageUrl,
      };
    }),

  /**
   * Hide one of the caller's own uncensored gens from the studio library.
   * Does not touch other users, SFW gens, or the public gallery.
   */
  deleteGeneration: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const src = await requireOwnUncensoredMedia(ctx.user.id, input.id);
      const meta = { ...((src.metadata as Record<string, unknown> | null) ?? {}), deleted: true };
      await updateGeneration(src.id, { metadata: meta });
      return { ok: true };
    }),

  /** Images + video clips for the Library tab. */
  myLibrary: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db
      .select({
        id: generations.id,
        imageUrl: generations.imageUrl,
        prompt: generations.prompt,
        createdAt: generations.createdAt,
        width: generations.width,
        height: generations.height,
        mediaType: generations.mediaType,
        parentGenerationId: generations.parentGenerationId,
        metadata: generations.metadata,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, ctx.user.id),
          eq(generations.status, "completed"),
          sql`${generations.metadata}->>'uncensored' = 'true'`,
          notDeletedUncensored,
        ),
      )
      .orderBy(desc(generations.createdAt))
      .limit(96);
  }),

  toggleStar: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const src = await requireOwnUncensoredMedia(ctx.user.id, input.id);
      const meta = { ...((src.metadata as Record<string, unknown> | null) ?? {}) };
      const starred = !meta.starred;
      meta.starred = starred;
      await updateGeneration(src.id, { metadata: meta });
      return { starred };
    }),

  /** Invoice history for the signed-in user (purchase status polling). */
  myInvoices: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDb();
    return db
      .select()
      .from(cryptoInvoices)
      .where(eq(cryptoInvoices.userId, ctx.user.id))
      .orderBy(desc(cryptoInvoices.createdAt))
      .limit(10);
  }),
});
