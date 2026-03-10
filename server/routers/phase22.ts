import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  achievements,
  creditBudgets,
  creditTransactions,
  generations,
  referrals,
  users,
  galleryItems,
} from "../../drizzle/schema";
import { eq, sql, and, count, desc } from "drizzle-orm";
import { createNotification } from "../routersPhase15";
import { ACHIEVEMENT_CATALOG } from "./phase21";

// ─── Auto-Check Achievements Helper (exported for use in generation flow) ───
export async function autoCheckAchievements(userId: number): Promise<
  Array<{ type: string; name: string; description: string; icon: string; color: string }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get existing achievements
    const existing = await db
      .select({ type: achievements.achievementType })
      .from(achievements)
      .where(eq(achievements.userId, userId));

    const existingTypes = new Set(existing.map((a) => a.type));

    // Get current counts
    const [genCount] = await db
      .select({ total: count() })
      .from(generations)
      .where(eq(generations.userId, userId));

    const [refCount] = await db
      .select({ total: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerId, userId), eq(referrals.status, "completed")));

    const [purchaseCount] = await db
      .select({ total: count() })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.type, "purchase")));

    const [galleryCount] = await db
      .select({ total: count() })
      .from(galleryItems)
      .where(eq(galleryItems.userId, userId));

    // Unique tools used
    const toolResults = await db
      .select({ desc: creditTransactions.description })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.type, "usage")));

    const uniqueTools = new Set<string>();
    for (const t of toolResults) {
      if (t.desc) {
        const match = t.desc.match(/^(Generated|Used|Animated|Batch|Blend|Upscale|Image)/i);
        if (match) uniqueTools.add(match[0].toLowerCase());
      }
    }

    const progressMap: Record<string, number> = {
      generationCount: genCount?.total || 0,
      referralCount: refCount?.total || 0,
      purchaseCount: purchaseCount?.total || 0,
      galleryCount: galleryCount?.total || 0,
      uniqueToolCount: uniqueTools.size,
      earlyAdopter: 1,
    };

    const newlyUnlocked: Array<{ type: string; name: string; description: string; icon: string; color: string }> = [];

    for (const achievement of ACHIEVEMENT_CATALOG) {
      if (existingTypes.has(achievement.type)) continue;

      const current = progressMap[achievement.field] || 0;
      if (current >= achievement.threshold) {
        await db.insert(achievements).values({
          userId,
          achievementType: achievement.type,
          metadata: { current, threshold: achievement.threshold },
        });

        newlyUnlocked.push({
          type: achievement.type,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          color: achievement.color,
        });

        // Send notification
        try {
          await createNotification(
            userId,
            "system",
            `🏆 Achievement Unlocked: ${achievement.name}!`,
            achievement.description,
            { achievementType: achievement.type }
          );
        } catch {}
      }
    }

    return newlyUnlocked;
  } catch (err) {
    console.error("[AutoAchievements] Error:", err);
    return [];
  }
}

// ─── Budget Alert Helper ────────────────────────────────────────────────────
export async function checkAndSendBudgetAlerts(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const [budget] = await db
      .select()
      .from(creditBudgets)
      .where(eq(creditBudgets.userId, userId))
      .limit(1);

    if (!budget || !budget.enabled || !budget.budgetEmailEnabled) return;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get today's spending
    const [dailyResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.type, "usage"),
          sql`createdAt >= CURDATE()`
        )
      );

    // Get this week's spending
    const [weeklyResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          eq(creditTransactions.type, "usage"),
          sql`createdAt >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`
        )
      );

    const dailySpent = dailyResult?.total || 0;
    const weeklySpent = weeklyResult?.total || 0;

    // Check daily alert
    if (budget.dailyLimit) {
      const dailyPct = Math.round((dailySpent / budget.dailyLimit) * 100);
      const shouldAlert = dailyPct >= budget.alertThreshold;
      const isExhausted = dailySpent >= budget.dailyLimit;
      const alreadyAlertedToday = budget.lastDailyAlertAt && budget.lastDailyAlertAt >= todayStart;

      if (shouldAlert && !alreadyAlertedToday) {
        const title = isExhausted
          ? "⚠️ Daily Credit Budget Exhausted"
          : `⚠️ Daily Budget Alert: ${dailyPct}% Used`;
        const content = isExhausted
          ? `You've used all ${budget.dailyLimit} credits in your daily budget. Generations will be blocked until tomorrow.`
          : `You've used ${dailySpent} of ${budget.dailyLimit} daily credits (${dailyPct}%). Consider slowing down to stay within budget.`;

        try {
          await createNotification(userId, "system", title, content, {
            type: "budget_alert",
            period: "daily",
            percentage: dailyPct,
          });
        } catch {}

        // Update last alert timestamp
        await db
          .update(creditBudgets)
          .set({ lastDailyAlertAt: now })
          .where(eq(creditBudgets.userId, userId));
      }
    }

    // Check weekly alert
    if (budget.weeklyLimit) {
      const weeklyPct = Math.round((weeklySpent / budget.weeklyLimit) * 100);
      const shouldAlert = weeklyPct >= budget.alertThreshold;
      const isExhausted = weeklySpent >= budget.weeklyLimit;

      // Only alert once per day for weekly budget
      const alreadyAlertedToday = budget.lastWeeklyAlertAt && budget.lastWeeklyAlertAt >= todayStart;

      if (shouldAlert && !alreadyAlertedToday) {
        const title = isExhausted
          ? "⚠️ Weekly Credit Budget Exhausted"
          : `⚠️ Weekly Budget Alert: ${weeklyPct}% Used`;
        const content = isExhausted
          ? `You've used all ${budget.weeklyLimit} credits in your weekly budget. Generations will be blocked until next week.`
          : `You've used ${weeklySpent} of ${budget.weeklyLimit} weekly credits (${weeklyPct}%). Consider pacing your usage.`;

        try {
          await createNotification(userId, "system", title, content, {
            type: "budget_alert",
            period: "weekly",
            percentage: weeklyPct,
          });
        } catch {}

        await db
          .update(creditBudgets)
          .set({ lastWeeklyAlertAt: now })
          .where(eq(creditBudgets.userId, userId));
      }
    }
  } catch (err) {
    console.error("[BudgetAlert] Error:", err);
  }
}

// ─── Achievement Sharing Router ─────────────────────────────────────────────
export const achievementShareRouter = router({
  getShareLinks: protectedProcedure
    .input(z.object({ achievementType: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Verify user has this achievement
      const [achievement] = await db
        .select()
        .from(achievements)
        .where(
          and(
            eq(achievements.userId, ctx.user.id),
            eq(achievements.achievementType, input.achievementType)
          )
        )
        .limit(1);

      if (!achievement) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not unlocked" });
      }

      const catalogEntry = ACHIEVEMENT_CATALOG.find((a) => a.type === input.achievementType);
      if (!catalogEntry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Achievement not found in catalog" });
      }

      const name = ctx.user.name || "Someone";
      const achievementName = catalogEntry.name;
      const achievementDesc = catalogEntry.description;
      const siteUrl = "https://genlabsyn-hhycwvdm.manus.space";

      const twitterText = encodeURIComponent(
        `I just unlocked the "${achievementName}" achievement on DreamForge! 🏆 ${achievementDesc} #DreamForge #AIArt`
      );
      const whatsappText = encodeURIComponent(
        `I just unlocked the "${achievementName}" achievement on DreamForge! 🏆 ${achievementDesc}\n\nCheck it out: ${siteUrl}`
      );
      const telegramText = encodeURIComponent(
        `I just unlocked the "${achievementName}" achievement on DreamForge! 🏆 ${achievementDesc}`
      );
      const emailSubject = encodeURIComponent(`${name} unlocked an achievement on DreamForge!`);
      const emailBody = encodeURIComponent(
        `I just unlocked the "${achievementName}" achievement on DreamForge!\n\n${achievementDesc}\n\nJoin me and start creating amazing AI art: ${siteUrl}`
      );

      return {
        achievement: {
          type: catalogEntry.type,
          name: achievementName,
          description: achievementDesc,
          icon: catalogEntry.icon,
          color: catalogEntry.color,
        },
        shareLinks: {
          twitter: `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(siteUrl)}`,
          whatsapp: `https://wa.me/?text=${whatsappText}`,
          telegram: `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${telegramText}`,
          email: `mailto:?subject=${emailSubject}&body=${emailBody}`,
          copyText: `I just unlocked the "${achievementName}" achievement on DreamForge! 🏆 ${achievementDesc} ${siteUrl}`,
        },
      };
    }),
});

// ─── Budget Email Settings Router ───────────────────────────────────────────
export const budgetEmailRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { budgetEmailEnabled: true };

    const [budget] = await db
      .select({
        budgetEmailEnabled: creditBudgets.budgetEmailEnabled,
        enabled: creditBudgets.enabled,
      })
      .from(creditBudgets)
      .where(eq(creditBudgets.userId, ctx.user.id))
      .limit(1);

    return {
      budgetEmailEnabled: budget?.budgetEmailEnabled ?? true,
      budgetEnabled: budget?.enabled ?? false,
    };
  }),

  updateEmailSetting: protectedProcedure
    .input(z.object({ budgetEmailEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [existing] = await db
        .select()
        .from(creditBudgets)
        .where(eq(creditBudgets.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await db
          .update(creditBudgets)
          .set({ budgetEmailEnabled: input.budgetEmailEnabled })
          .where(eq(creditBudgets.userId, ctx.user.id));
      } else {
        await db.insert(creditBudgets).values({
          userId: ctx.user.id,
          budgetEmailEnabled: input.budgetEmailEnabled,
          enabled: false,
        });
      }

      return { success: true };
    }),
});

// ─── Auto-Check Router (for frontend to trigger after generation) ───────────
export const autoAchievementRouter = router({
  checkAfterGeneration: protectedProcedure.mutation(async ({ ctx }) => {
    const newlyUnlocked = await autoCheckAchievements(ctx.user.id);
    return { newlyUnlocked };
  }),
});
