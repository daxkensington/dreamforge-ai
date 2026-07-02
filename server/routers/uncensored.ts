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
import { getDb, createGeneration, updateGeneration } from "../db";
import { users, cryptoInvoices, generations } from "../../drizzle/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { createUncensoredInvoice, isBtcpayConfigured, UNCENSORED_PLAN, UNCENSORED_PLANS, getUncensoredPlanById } from "../_core/btcpay";
import { generateImage } from "../_core/imageGeneration";
import { checkPrompt, logModerationBlock } from "../_core/promptModeration";
import { requireToolActive } from "../_core/toolStatus";
import { enforceRateLimit } from "../rate-limit";

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
    return {
      ...ent,
      plan: UNCENSORED_PLAN,
      plans: UNCENSORED_PLANS,
      available: isBtcpayConfigured(),
      freeUsed,
      freeLimit: FREE_UNCENSORED_LIMIT,
      freeRemaining: Math.max(0, FREE_UNCENSORED_LIMIT - freeUsed),
    };
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
