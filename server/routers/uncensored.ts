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
import { users, cryptoInvoices, generations } from "../../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { createUncensoredInvoice, isBtcpayConfigured, UNCENSORED_PLAN, UNCENSORED_PLANS, getUncensoredPlanById } from "../_core/btcpay";
import { generateImage } from "../_core/imageGeneration";
import { submitUncensoredVideoJob, collectUncensoredVideoJob } from "../_core/videoGenerationUncensored";
import { checkPrompt, logModerationBlock } from "../_core/promptModeration";
import { requireToolActive, logToolFailure, getToolStatus } from "../_core/toolStatus";
import { isRunPodAvailable } from "../_core/runpod";
import { deductCredits, refundCredits } from "../stripe";
import { CREDIT_COSTS } from "../../shared/creditCosts";
import { enforceRateLimit } from "../rate-limit";

// Uncensored video is GPU-expensive (Wan 2.2, minutes/clip) → pass-gated, no
// free tier. T2V ≈ a 5s clip; I2V animates one of the user's own generations.
const UNCENSORED_VIDEO_COST = {
  t2v: CREDIT_COSTS.videoGeneration.short5s, // 50
  i2v: CREDIT_COSTS.imageToVideo.basic, // 40
} as const;
const VIDEO_ASPECTS = {
  portrait: { w: 480, h: 832 },
  landscape: { w: 832, h: 480 },
  square: { w: 640, h: 640 },
} as const;

// Free uncensored previews — the conversion hook. Lifetime cap per user
// (tracked via generation metadata, no schema change) + a global daily cap so
// abuse can't run up the GPU bill.
const FREE_UNCENSORED_LIMIT = 3;
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
        sourceGenerationId: z.number().int().positive().optional(),
        aspect: z.enum(["portrait", "landscape", "square"]).default("portrait"),
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
        const src = await getGenerationById(input.sourceGenerationId);
        if (!src || src.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "That generation isn't available to animate." });
        }
        if (src.mediaType !== "image" || src.status !== "completed" || !src.imageUrl) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only your completed image generations can be animated." });
        }
        if (!(src.metadata as any)?.uncensored) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only uncensored generations can be animated here." });
        }
        sourceImageUrl = src.imageUrl;
        parentGenerationId = src.id;
      }

      const cost = input.mode === "i2v" ? UNCENSORED_VIDEO_COST.i2v : UNCENSORED_VIDEO_COST.t2v;
      const debit = await deductCredits(ctx.user.id, cost, `Uncensored ${input.mode === "i2v" ? "image-to-video" : "video"}`, "usage", { uncensored: true, video: true, mode: input.mode });
      if (!debit.success) {
        throw new TRPCError({ code: "FORBIDDEN", message: `Not enough credits — this needs ${cost}, you have ${debit.balance}.` });
      }

      const dims = VIDEO_ASPECTS[input.aspect];
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: input.prompt,
        negativePrompt: null,
        mediaType: "video",
        width: dims.w,
        height: dims.h,
        duration: 5,
        status: "generating",
        modelVersion: "uncensored-wan-2.2",
        parentGenerationId,
        animationStyle: input.mode === "i2v" ? "wan-i2v" : null,
        thumbnailUrl: sourceImageUrl,
        metadata: { uncensored: true, video: true, mode: input.mode, cost },
      });

      // Submit the job and return immediately — video outlasts a serverless
      // function, so the client polls uncensored.videoStatus(generationId).
      try {
        const { jobId } = await submitUncensoredVideoJob({
          prompt: input.prompt,
          userId: ctx.user.id,
          sourceImageUrl,
          width: dims.w,
          height: dims.h,
        });
        await updateGeneration(genId, {
          metadata: { uncensored: true, video: true, mode: input.mode, cost, runpodJobId: jobId },
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
      if (gen.status === "completed") return { status: "completed" as const, url: gen.imageUrl };
      if (gen.status === "failed") return { status: "failed" as const, url: null };

      const meta = (gen.metadata as any) ?? {};
      const jobId: string | undefined = meta.runpodJobId;
      if (!jobId) return { status: "processing" as const, url: null }; // submit not yet recorded

      const result = await collectUncensoredVideoJob(jobId);
      const db = await requireDb();

      if (result.status === "completed") {
        // Claim the transition; if another poll already did, the mp4 we just
        // stored is a harmless orphan.
        await db
          .update(generations)
          .set({ status: "completed", imageUrl: result.url, fileKey: result.key })
          .where(and(eq(generations.id, gen.id), eq(generations.status, "generating")));
        return { status: "completed" as const, url: result.url };
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
        return { status: "failed" as const, url: null };
      }
      return { status: "processing" as const, url: null };
    }),

  /**
   * Free uncensored preview — the conversion hook. Age-gated, watermarked,
   * private, capped at FREE_UNCENSORED_LIMIT lifetime per user with a global
   * daily cost cap. Every prompt passes the strict moderation gate (and the
   * generateUnfiltered backstop) before any GPU call.
   */
  freeGenerate: protectedProcedure
    .input(z.object({ prompt: z.string().min(3).max(1000) }))
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

      const enhancedPrompt = `${input.prompt}. High quality, detailed. 100% fictional synthetic content, no real people depicted.`;
      const genId = await createGeneration({
        userId: ctx.user.id,
        prompt: input.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: 768,
        height: 768,
        duration: null,
        status: "generating",
        modelVersion: "uncensored-free",
        metadata: { uncensored: true, free: true },
      });

      try {
        const { url } = await generateImage({
          prompt: enhancedPrompt,
          model: "auto",
          size: "768x768",
          userTier: "free",
          unfiltered: true,
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
      .select({ id: generations.id, imageUrl: generations.imageUrl, prompt: generations.prompt, createdAt: generations.createdAt })
      .from(generations)
      .where(
        and(
          eq(generations.userId, ctx.user.id),
          eq(generations.mediaType, "image"),
          eq(generations.status, "completed"),
          sql`${generations.metadata}->>'uncensored' = 'true'`,
        ),
      )
      .orderBy(desc(generations.createdAt))
      .limit(24);
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
