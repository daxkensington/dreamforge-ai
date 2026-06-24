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
import { getDb } from "../db";
import { users, cryptoInvoices } from "../../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { createUncensoredInvoice, isBtcpayConfigured, UNCENSORED_PLAN, UNCENSORED_PLANS, getUncensoredPlanById } from "../_core/btcpay";

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
    return { ...ent, plan: UNCENSORED_PLAN, plans: UNCENSORED_PLANS, available: isBtcpayConfigured() };
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

      return { checkoutLink };
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
