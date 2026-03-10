import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  creditBalances,
  creditTransactions,
  referrals,
  users,
} from "../../drizzle/schema";
import { eq, sql, desc, and, count } from "drizzle-orm";
import { addCredits, getOrCreateBalance } from "../stripe";
import { createNotification } from "../routersPhase15";
import crypto from "crypto";

// ─── Constants ──────────────────────────────────────────────────────────────
const LOW_CREDIT_THRESHOLD = 10;
const REFERRAL_BONUS_REFERRER = 25; // Credits awarded to the person who referred
const REFERRAL_BONUS_REFERRED = 15; // Credits awarded to the new user who was referred

// ─── Helper: Generate unique referral code ──────────────────────────────────
function generateCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
}

// ─── Usage Analytics Router ─────────────────────────────────────────────────
export const usageAnalyticsRouter = router({
  /**
   * Get credit usage breakdown by tool type for the authenticated user.
   * Returns aggregated spending per tool with time filtering.
   */
  getUsageByTool: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(["7d", "30d", "90d", "all"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { tools: [], totalSpent: 0 };

      const period = input?.period || "30d";
      let dateFilter = "";
      switch (period) {
        case "7d":
          dateFilter = "AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
          break;
        case "30d":
          dateFilter = "AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
          break;
        case "90d":
          dateFilter = "AND createdAt >= DATE_SUB(NOW(), INTERVAL 90 DAY)";
          break;
        default:
          dateFilter = "";
      }

      // Get usage transactions grouped by description (tool name)
      const results = await db
        .select({
          tool: creditTransactions.description,
          totalCredits: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
          usageCount: count(),
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, ctx.user.id),
            eq(creditTransactions.type, "usage"),
            period !== "all"
              ? sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${period === "7d" ? 7 : period === "30d" ? 30 : 90} DAY)`
              : undefined
          )
        )
        .groupBy(creditTransactions.description)
        .orderBy(sql`SUM(ABS(${creditTransactions.amount})) DESC`);

      const totalSpent = results.reduce((sum, r) => sum + (r.totalCredits || 0), 0);

      // Parse tool name from description (e.g., "Used text-to-image" → "text-to-image")
      const tools = results.map((r) => {
        const toolName = (r.tool || "unknown").replace(/^Used\s+/, "");
        return {
          tool: toolName,
          credits: r.totalCredits || 0,
          count: r.usageCount || 0,
          percentage: totalSpent > 0 ? Math.round(((r.totalCredits || 0) / totalSpent) * 100) : 0,
        };
      });

      return { tools, totalSpent };
    }),

  /**
   * Get daily/weekly/monthly credit spending over time for charts.
   */
  getSpendingTimeline: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(["daily", "weekly", "monthly"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const period = input?.period || "daily";
      let dateFormat: string;
      let daysBack: number;

      switch (period) {
        case "weekly":
          dateFormat = "%Y-%u";
          daysBack = 90;
          break;
        case "monthly":
          dateFormat = "%Y-%m";
          daysBack = 365;
          break;
        default:
          dateFormat = "%Y-%m-%d";
          daysBack = 30;
      }

      const results = await db
        .select({
          period: sql<string>`DATE_FORMAT(${creditTransactions.createdAt}, ${dateFormat})`,
          spent: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
          count: count(),
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, ctx.user.id),
            eq(creditTransactions.type, "usage"),
            sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
          )
        )
        .groupBy(sql`DATE_FORMAT(${creditTransactions.createdAt}, ${dateFormat})`)
        .orderBy(sql`DATE_FORMAT(${creditTransactions.createdAt}, ${dateFormat})`);

      return results;
    }),

  /**
   * Get summary stats for the user's credit usage.
   */
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db)
      return {
        totalSpent: 0,
        totalPurchased: 0,
        totalBonuses: 0,
        mostUsedTool: null,
        avgPerDay: 0,
        transactionCount: 0,
      };

    // Total spent
    const [spentResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
        count: count(),
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.type, "usage")
        )
      );

    // Total purchased
    const [purchasedResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(amount), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.type, "purchase")
        )
      );

    // Total bonuses (bonus + referral)
    const [bonusResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(amount), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.type, "bonus")
        )
      );

    // Most used tool
    const [mostUsed] = await db
      .select({
        tool: creditTransactions.description,
        totalCredits: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.type, "usage")
        )
      )
      .groupBy(creditTransactions.description)
      .orderBy(sql`SUM(ABS(${creditTransactions.amount})) DESC`)
      .limit(1);

    // Average per day (last 30 days)
    const [avgResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.type, "usage"),
          sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
        )
      );

    const avgPerDay = Math.round(((avgResult?.total || 0) / 30) * 10) / 10;

    return {
      totalSpent: spentResult?.total || 0,
      totalPurchased: purchasedResult?.total || 0,
      totalBonuses: bonusResult?.total || 0,
      mostUsedTool: mostUsed?.tool
        ? (mostUsed.tool as string).replace(/^Used\s+/, "")
        : null,
      avgPerDay,
      transactionCount: spentResult?.count || 0,
    };
  }),
});

// ─── Referral Router ────────────────────────────────────────────────────────
export const referralRouter = router({
  /**
   * Get or generate the user's referral code and link.
   */
  getMyReferral: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Check if user already has a referral code
    const [user] = await db
      .select({ referralCode: users.referralCode })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    let code = user?.referralCode;

    if (!code) {
      // Generate a unique code
      code = generateCode();
      let attempts = 0;
      while (attempts < 5) {
        try {
          await db
            .update(users)
            .set({ referralCode: code })
            .where(eq(users.id, ctx.user.id));
          break;
        } catch {
          code = generateCode();
          attempts++;
        }
      }
    }

    // Get referral stats
    const referralsList = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, ctx.user.id))
      .orderBy(desc(referrals.createdAt));

    const completedCount = referralsList.filter((r) => r.status === "completed").length;
    const totalCreditsEarned = referralsList.reduce((sum, r) => sum + (r.creditsAwarded || 0), 0);

    return {
      code,
      referrals: referralsList,
      stats: {
        totalReferrals: referralsList.length,
        completedReferrals: completedCount,
        pendingReferrals: referralsList.length - completedCount,
        totalCreditsEarned,
      },
    };
  }),

  /**
   * Apply a referral code (called when a new user enters a referral code).
   * Awards credits to both the referrer and the referred user.
   */
  applyCode: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Find the referrer by code
      const [referrer] = await db
        .select({ id: users.id, name: users.name, referralCode: users.referralCode })
        .from(users)
        .where(eq(users.referralCode, input.code.toUpperCase()))
        .limit(1);

      if (!referrer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid referral code",
        });
      }

      // Can't refer yourself
      if (referrer.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot use your own referral code",
        });
      }

      // Check if this user has already been referred
      const existingReferral = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referredUserId, ctx.user.id))
        .limit(1);

      if (existingReferral.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already used a referral code",
        });
      }

      // Create the referral record
      await db.insert(referrals).values({
        referrerId: referrer.id,
        referredUserId: ctx.user.id,
        code: input.code.toUpperCase(),
        status: "completed",
        creditsAwarded: REFERRAL_BONUS_REFERRER,
        completedAt: new Date(),
      });

      // Award credits to the referrer
      await addCredits(
        referrer.id,
        REFERRAL_BONUS_REFERRER,
        `Referral bonus — ${ctx.user.name || "A user"} joined via your link`
      );

      // Award credits to the referred user
      await addCredits(
        ctx.user.id,
        REFERRAL_BONUS_REFERRED,
        `Welcome bonus — joined via ${referrer.name || "a friend"}'s referral`
      );

      // Notify the referrer
      try {
        await createNotification(
          referrer.id,
          "payment",
          "Referral Reward!",
          `${ctx.user.name || "A new user"} joined DreamForge using your referral link! You earned ${REFERRAL_BONUS_REFERRER} bonus credits.`,
          { referredUserId: ctx.user.id, credits: REFERRAL_BONUS_REFERRER }
        );
      } catch {}

      // Notify the referred user
      try {
        await createNotification(
          ctx.user.id,
          "payment",
          "Referral Welcome Bonus!",
          `You received ${REFERRAL_BONUS_REFERRED} bonus credits for joining via a referral link. Start creating!`,
          { referrerId: referrer.id, credits: REFERRAL_BONUS_REFERRED }
        );
      } catch {}

      return {
        success: true,
        creditsEarned: REFERRAL_BONUS_REFERRED,
        message: `You received ${REFERRAL_BONUS_REFERRED} bonus credits!`,
      };
    }),

  /**
   * Get referral constants (bonus amounts) for display.
   */
  getConstants: publicProcedure.query(() => {
    return {
      referrerBonus: REFERRAL_BONUS_REFERRER,
      referredBonus: REFERRAL_BONUS_REFERRED,
      lowCreditThreshold: LOW_CREDIT_THRESHOLD,
    };
  }),
});

// ─── Enhanced Balance (with low credit flag) ────────────────────────────────
export const enhancedCreditsRouter = router({
  /**
   * Get balance with low credit warning flag.
   */
  getBalanceWithWarning: protectedProcedure.query(async ({ ctx }) => {
    const balance = await getOrCreateBalance(ctx.user.id);
    return {
      balance: balance.balance,
      lifetimeSpent: balance.lifetimeSpent,
      isLow: balance.balance < LOW_CREDIT_THRESHOLD,
      threshold: LOW_CREDIT_THRESHOLD,
    };
  }),
});
