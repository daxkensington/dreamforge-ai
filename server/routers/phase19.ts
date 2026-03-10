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
import { eq, sql, desc, and, count, gte } from "drizzle-orm";
import { addCredits, getOrCreateBalance } from "../stripe";
import { createNotification } from "../routersPhase15";
import crypto from "crypto";

// ─── Tiered Referral Rewards ───────────────────────────────────────────────
export const REFERRAL_TIERS = [
  { threshold: 3, bonus: 30, name: "Bronze", color: "#CD7F32" },
  { threshold: 7, bonus: 50, name: "Silver", color: "#C0C0C0" },
  { threshold: 15, bonus: 100, name: "Gold", color: "#FFD700" },
  { threshold: 30, bonus: 200, name: "Platinum", color: "#E5E4E2" },
  { threshold: 50, bonus: 500, name: "Diamond", color: "#B9F2FF" },
] as const;

const BASE_REFERRAL_BONUS_REFERRER = 25;
const BASE_REFERRAL_BONUS_REFERRED = 15;

function generateCode(): string {
  return crypto.randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
}

/**
 * Check if a user has crossed a new tier threshold after a successful referral,
 * and award the tier bonus if so.
 */
async function checkAndAwardTierBonus(userId: number): Promise<{ newTier: typeof REFERRAL_TIERS[number] | null; totalReferrals: number }> {
  const db = await getDb();
  if (!db) return { newTier: null, totalReferrals: 0 };

  // Count completed referrals
  const [result] = await db
    .select({ total: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerId, userId),
        eq(referrals.status, "completed")
      )
    );

  const totalReferrals = result?.total || 0;

  // Find the highest tier the user has just reached
  // We check each tier from highest to lowest
  for (let i = REFERRAL_TIERS.length - 1; i >= 0; i--) {
    const tier = REFERRAL_TIERS[i];
    if (totalReferrals === tier.threshold) {
      // User just hit this tier exactly — award the bonus
      await addCredits(
        userId,
        tier.bonus,
        `Referral milestone: ${tier.name} tier (${tier.threshold} referrals) — ${tier.bonus} bonus credits`
      );

      // Create notification
      try {
        await createNotification(
          userId,
          "payment",
          `${tier.name} Referral Tier Unlocked!`,
          `Congratulations! You've reached the ${tier.name} tier with ${tier.threshold} referrals and earned ${tier.bonus} bonus credits!`,
          { tier: tier.name, bonus: tier.bonus, totalReferrals }
        );
      } catch {}

      return { newTier: tier, totalReferrals };
    }
  }

  return { newTier: null, totalReferrals };
}

// ─── Auto-Apply Referral Router ────────────────────────────────────────────
export const autoReferralRouter = router({
  /**
   * Auto-apply a referral code. Called by the frontend after OAuth callback
   * when a ?ref=CODE parameter was captured in sessionStorage.
   */
  autoApply: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const code = input.code.toUpperCase();

      // Find the referrer by code
      const [referrer] = await db
        .select({ id: users.id, name: users.name, referralCode: users.referralCode })
        .from(users)
        .where(eq(users.referralCode, code))
        .limit(1);

      if (!referrer) {
        return { success: false, reason: "invalid_code", message: "Invalid referral code" };
      }

      // Can't refer yourself
      if (referrer.id === ctx.user.id) {
        return { success: false, reason: "self_referral", message: "You cannot use your own referral code" };
      }

      // Check if this user has already been referred
      const existingReferral = await db
        .select()
        .from(referrals)
        .where(eq(referrals.referredUserId, ctx.user.id))
        .limit(1);

      if (existingReferral.length > 0) {
        return { success: false, reason: "already_referred", message: "You have already used a referral code" };
      }

      // Create the referral record
      await db.insert(referrals).values({
        referrerId: referrer.id,
        referredUserId: ctx.user.id,
        code,
        status: "completed",
        creditsAwarded: BASE_REFERRAL_BONUS_REFERRER,
        completedAt: new Date(),
      });

      // Award credits to the referrer
      await addCredits(
        referrer.id,
        BASE_REFERRAL_BONUS_REFERRER,
        `Referral bonus — ${ctx.user.name || "A user"} joined via your link`
      );

      // Award credits to the referred user
      await addCredits(
        ctx.user.id,
        BASE_REFERRAL_BONUS_REFERRED,
        `Welcome bonus — joined via ${referrer.name || "a friend"}'s referral`
      );

      // Check for tier bonus
      const tierResult = await checkAndAwardTierBonus(referrer.id);

      // Notify the referrer
      try {
        await createNotification(
          referrer.id,
          "payment",
          "Referral Reward!",
          `${ctx.user.name || "A new user"} joined DreamForge using your referral link! You earned ${BASE_REFERRAL_BONUS_REFERRER} bonus credits.`,
          { referredUserId: ctx.user.id, credits: BASE_REFERRAL_BONUS_REFERRER }
        );
      } catch {}

      // Notify the referred user
      try {
        await createNotification(
          ctx.user.id,
          "payment",
          "Referral Welcome Bonus!",
          `You received ${BASE_REFERRAL_BONUS_REFERRED} bonus credits for joining via a referral link. Start creating!`,
          { referrerId: referrer.id, credits: BASE_REFERRAL_BONUS_REFERRED }
        );
      } catch {}

      return {
        success: true,
        creditsEarned: BASE_REFERRAL_BONUS_REFERRED,
        message: `You received ${BASE_REFERRAL_BONUS_REFERRED} bonus credits!`,
        tierAwarded: tierResult.newTier ? {
          name: tierResult.newTier.name,
          bonus: tierResult.newTier.bonus,
        } : null,
      };
    }),
});

// ─── Tiered Referral Router ────────────────────────────────────────────────
export const tieredReferralRouter = router({
  /**
   * Get the user's current tier progress and all tier info.
   */
  getTierProgress: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { totalReferrals: 0, currentTier: null, nextTier: REFERRAL_TIERS[0], tiers: REFERRAL_TIERS, tierBonusesEarned: 0 };

    // Count completed referrals
    const [result] = await db
      .select({ total: count() })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, ctx.user.id),
          eq(referrals.status, "completed")
        )
      );

    const totalReferrals = result?.total || 0;

    // Determine current and next tier
    let currentTier: typeof REFERRAL_TIERS[number] | null = null;
    let nextTier: typeof REFERRAL_TIERS[number] | null = null;

    for (let i = REFERRAL_TIERS.length - 1; i >= 0; i--) {
      if (totalReferrals >= REFERRAL_TIERS[i].threshold) {
        currentTier = REFERRAL_TIERS[i];
        nextTier = i < REFERRAL_TIERS.length - 1 ? REFERRAL_TIERS[i + 1] : null;
        break;
      }
    }

    if (!currentTier) {
      nextTier = REFERRAL_TIERS[0];
    }

    // Calculate total tier bonuses earned
    let tierBonusesEarned = 0;
    for (const tier of REFERRAL_TIERS) {
      if (totalReferrals >= tier.threshold) {
        tierBonusesEarned += tier.bonus;
      }
    }

    return {
      totalReferrals,
      currentTier,
      nextTier,
      tiers: REFERRAL_TIERS,
      tierBonusesEarned,
    };
  }),

  /**
   * Get all tier definitions (public).
   */
  getTiers: publicProcedure.query(() => {
    return { tiers: REFERRAL_TIERS };
  }),
});

// ─── Usage Digest Router ───────────────────────────────────────────────────
export const digestRouter = router({
  /**
   * Get the user's digest preferences.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { enabled: false, frequency: "weekly" as const };

    const [user] = await db
      .select({
        digestEnabled: users.digestEnabled,
        digestFrequency: users.digestFrequency,
        lastDigestSentAt: users.lastDigestSentAt,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      enabled: user?.digestEnabled ?? false,
      frequency: (user?.digestFrequency as "weekly" | "monthly") ?? "weekly",
      lastSentAt: user?.lastDigestSentAt ?? null,
    };
  }),

  /**
   * Update digest preferences.
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        frequency: z.enum(["weekly", "monthly"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(users)
        .set({
          digestEnabled: input.enabled,
          digestFrequency: input.frequency,
        })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  /**
   * Generate a digest preview for the current user (also used by the scheduled job).
   * Returns the digest content as structured data.
   */
  generatePreview: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(["weekly", "monthly"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return generateDigestForUser(ctx.user.id, ctx.user.name || "Creator", input?.period || "weekly");
    }),

  /**
   * Send a digest notification to the current user (manual trigger).
   */
  sendNow: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    // Get user preferences
    const [user] = await db
      .select({
        digestFrequency: users.digestFrequency,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const frequency = (user?.digestFrequency as "weekly" | "monthly") ?? "weekly";
    const digest = await generateDigestForUser(ctx.user.id, user?.name || "Creator", frequency);

    if (!digest) {
      return { success: false, message: "No usage data to report" };
    }

    // Send as in-app notification
    try {
      await createNotification(
        ctx.user.id,
        "system",
        `Your ${frequency === "weekly" ? "Weekly" : "Monthly"} Usage Digest`,
        formatDigestAsText(digest),
        { digestData: digest }
      );
    } catch {}

    // Update last sent timestamp
    await db
      .update(users)
      .set({ lastDigestSentAt: new Date() })
      .where(eq(users.id, ctx.user.id));

    return { success: true, message: "Digest sent to your notifications" };
  }),

  /**
   * Cron-compatible endpoint: send digests to all eligible users.
   * This would be called by a scheduled job.
   */
  sendScheduledDigests: protectedProcedure.mutation(async ({ ctx }) => {
    // Only admin can trigger scheduled digests
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get users with digest enabled
    const eligibleUsers = await db
      .select({
        id: users.id,
        name: users.name,
        digestFrequency: users.digestFrequency,
        lastDigestSentAt: users.lastDigestSentAt,
      })
      .from(users)
      .where(eq(users.digestEnabled, true));

    let sentCount = 0;

    for (const user of eligibleUsers) {
      const frequency = user.digestFrequency as "weekly" | "monthly";
      const cutoff = frequency === "weekly" ? weekAgo : monthAgo;

      // Skip if digest was sent recently
      if (user.lastDigestSentAt && user.lastDigestSentAt > cutoff) {
        continue;
      }

      try {
        const digest = await generateDigestForUser(user.id, user.name || "Creator", frequency);
        if (!digest) continue;

        await createNotification(
          user.id,
          "system",
          `Your ${frequency === "weekly" ? "Weekly" : "Monthly"} Usage Digest`,
          formatDigestAsText(digest),
          { digestData: digest }
        );

        await db
          .update(users)
          .set({ lastDigestSentAt: new Date() })
          .where(eq(users.id, user.id));

        sentCount++;
      } catch (err) {
        console.error(`[Digest] Failed to send digest to user ${user.id}:`, err);
      }
    }

    return { success: true, sentCount, totalEligible: eligibleUsers.length };
  }),
});

// ─── Digest Generation Helpers ─────────────────────────────────────────────

export interface DigestData {
  period: "weekly" | "monthly";
  periodLabel: string;
  userName: string;
  totalSpent: number;
  totalPurchased: number;
  currentBalance: number;
  topTools: Array<{ tool: string; credits: number; count: number }>;
  totalGenerations: number;
  avgPerDay: number;
  comparedToPrevious: {
    spentChange: number; // percentage change
    generationsChange: number;
  };
}

async function generateDigestForUser(
  userId: number,
  userName: string,
  period: "weekly" | "monthly"
): Promise<DigestData | null> {
  const db = await getDb();
  if (!db) return null;

  const daysBack = period === "weekly" ? 7 : 30;
  const prevDaysBack = daysBack * 2; // For comparison
  const periodLabel = period === "weekly" ? "This Week" : "This Month";

  // Current period spending
  const [currentSpent] = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
      count: count(),
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "usage"),
        sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
      )
    );

  // Previous period spending (for comparison)
  const [prevSpent] = await db
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
      count: count(),
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "usage"),
        sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${prevDaysBack} DAY)`,
        sql`${creditTransactions.createdAt} < DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
      )
    );

  // Current period purchases
  const [currentPurchased] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "purchase"),
        sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
      )
    );

  // Top tools
  const topTools = await db
    .select({
      tool: creditTransactions.description,
      totalCredits: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
      usageCount: count(),
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "usage"),
        sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
      )
    )
    .groupBy(creditTransactions.description)
    .orderBy(sql`SUM(ABS(${creditTransactions.amount})) DESC`)
    .limit(5);

  // Current balance
  const balance = await getOrCreateBalance(userId);

  const totalSpent = currentSpent?.total || 0;
  const prevTotal = prevSpent?.total || 0;
  const totalGenerations = currentSpent?.count || 0;
  const prevGenerations = prevSpent?.count || 0;

  // If no activity at all, return null
  if (totalSpent === 0 && totalGenerations === 0) {
    return null;
  }

  const spentChange = prevTotal > 0
    ? Math.round(((totalSpent - prevTotal) / prevTotal) * 100)
    : totalSpent > 0 ? 100 : 0;

  const generationsChange = prevGenerations > 0
    ? Math.round(((totalGenerations - prevGenerations) / prevGenerations) * 100)
    : totalGenerations > 0 ? 100 : 0;

  return {
    period,
    periodLabel,
    userName,
    totalSpent,
    totalPurchased: currentPurchased?.total || 0,
    currentBalance: balance.balance,
    topTools: topTools.map((t) => ({
      tool: (t.tool || "unknown").replace(/^Used\s+/, ""),
      credits: t.totalCredits || 0,
      count: t.usageCount || 0,
    })),
    totalGenerations,
    avgPerDay: Math.round((totalSpent / daysBack) * 10) / 10,
    comparedToPrevious: {
      spentChange,
      generationsChange,
    },
  };
}

function formatDigestAsText(digest: DigestData): string {
  const lines: string[] = [];
  lines.push(`Hi ${digest.userName}! Here's your ${digest.period} usage digest for DreamForge.\n`);
  lines.push(`📊 ${digest.periodLabel} Summary:`);
  lines.push(`• Credits used: ${digest.totalSpent} (${digest.comparedToPrevious.spentChange >= 0 ? "+" : ""}${digest.comparedToPrevious.spentChange}% vs previous)`);
  lines.push(`• Generations: ${digest.totalGenerations} (${digest.comparedToPrevious.generationsChange >= 0 ? "+" : ""}${digest.comparedToPrevious.generationsChange}% vs previous)`);
  lines.push(`• Avg per day: ${digest.avgPerDay} credits`);
  lines.push(`• Current balance: ${digest.currentBalance} credits\n`);

  if (digest.topTools.length > 0) {
    lines.push(`🛠️ Top Tools:`);
    digest.topTools.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t.tool}: ${t.credits} credits (${t.count} uses)`);
    });
  }

  if (digest.currentBalance < 10) {
    lines.push(`\n⚠️ Your balance is low! Consider purchasing more credits to keep creating.`);
  }

  return lines.join("\n");
}

// Export the helper for testing
export { generateDigestForUser, formatDigestAsText, checkAndAwardTierBonus };
