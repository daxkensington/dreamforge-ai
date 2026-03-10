import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
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

// ─── Achievement Catalog ────────────────────────────────────────────────────
export const ACHIEVEMENT_CATALOG = [
  {
    type: "first-generation",
    name: "First Creation",
    description: "Create your first generation",
    icon: "Sparkles",
    color: "#a855f7",
    category: "creation",
    threshold: 1,
    field: "generationCount",
  },
  {
    type: "10-generations",
    name: "Getting Started",
    description: "Create 10 generations",
    icon: "Zap",
    color: "#eab308",
    category: "creation",
    threshold: 10,
    field: "generationCount",
  },
  {
    type: "50-generations",
    name: "Creative Mind",
    description: "Create 50 generations",
    icon: "Flame",
    color: "#f97316",
    category: "creation",
    threshold: 50,
    field: "generationCount",
  },
  {
    type: "100-generations",
    name: "Prolific Creator",
    description: "Create 100 generations",
    icon: "Crown",
    color: "#ef4444",
    category: "creation",
    threshold: 100,
    field: "generationCount",
  },
  {
    type: "500-generations",
    name: "DreamForge Master",
    description: "Create 500 generations",
    icon: "Trophy",
    color: "#6366f1",
    category: "creation",
    threshold: 500,
    field: "generationCount",
  },
  {
    type: "first-referral",
    name: "Friendly Invite",
    description: "Refer your first friend",
    icon: "Users",
    color: "#22c55e",
    category: "social",
    threshold: 1,
    field: "referralCount",
  },
  {
    type: "5-referrals",
    name: "Social Butterfly",
    description: "Refer 5 friends",
    icon: "Heart",
    color: "#ec4899",
    category: "social",
    threshold: 5,
    field: "referralCount",
  },
  {
    type: "10-referrals",
    name: "Community Builder",
    description: "Refer 10 friends",
    icon: "Globe",
    color: "#06b6d4",
    category: "social",
    threshold: 10,
    field: "referralCount",
  },
  {
    type: "first-purchase",
    name: "Supporter",
    description: "Make your first credit purchase",
    icon: "CreditCard",
    color: "#14b8a6",
    category: "commerce",
    threshold: 1,
    field: "purchaseCount",
  },
  {
    type: "gallery-debut",
    name: "Gallery Debut",
    description: "Get your first work featured in the gallery",
    icon: "Image",
    color: "#8b5cf6",
    category: "community",
    threshold: 1,
    field: "galleryCount",
  },
  {
    type: "power-user",
    name: "Power User",
    description: "Use 5 different tools",
    icon: "Settings",
    color: "#64748b",
    category: "exploration",
    threshold: 5,
    field: "uniqueToolCount",
  },
  {
    type: "early-adopter",
    name: "Early Adopter",
    description: "Join DreamForge within the first month",
    icon: "Star",
    color: "#fbbf24",
    category: "special",
    threshold: 1,
    field: "earlyAdopter",
  },
] as const;

export type AchievementType = (typeof ACHIEVEMENT_CATALOG)[number]["type"];

// ─── Social Sharing Router ──────────────────────────────────────────────────
export const socialShareRouter = router({
  getShareLinks: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const [user] = await db
      .select({ referralCode: users.referralCode, name: users.name })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user?.referralCode) {
      return { referralCode: null, shareLinks: null };
    }

    const code = user.referralCode;
    const name = user.name || "A friend";

    return {
      referralCode: code,
      shareLinks: generateShareLinks(code, name),
    };
  }),

  getShareMessage: protectedProcedure
    .input(z.object({ platform: z.enum(["twitter", "whatsapp", "telegram", "email", "generic"]) }))
    .query(({ ctx, input }) => {
      return { message: getShareMessage(input.platform, "CODE", ctx.user.name || "A friend") };
    }),
});

function generateShareLinks(code: string, name: string) {
  const baseUrl = `https://genlabsyn-hhycwvdm.manus.space?ref=${code}`;
  const twitterText = encodeURIComponent(
    `I've been creating amazing AI art with DreamForge! Join me and get 15 free credits to start creating. 🎨✨`
  );
  const whatsappText = encodeURIComponent(
    `Hey! I've been using DreamForge to create stunning AI art. Sign up with my link and we both get bonus credits! ${baseUrl}`
  );
  const telegramText = encodeURIComponent(
    `Check out DreamForge - an amazing AI art platform! Use my referral link to get 15 free credits: ${baseUrl}`
  );
  const emailSubject = encodeURIComponent(`${name} invited you to DreamForge`);
  const emailBody = encodeURIComponent(
    `Hi!\n\nI've been using DreamForge to create stunning AI-generated images and videos. I thought you'd love it too!\n\nSign up with my referral link and get 15 free credits to start creating:\n${baseUrl}\n\nSee you there!\n${name}`
  );

  return {
    twitter: `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(baseUrl)}`,
    whatsapp: `https://wa.me/?text=${whatsappText}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(baseUrl)}&text=${telegramText}`,
    email: `mailto:?subject=${emailSubject}&body=${emailBody}`,
    copyText: `Join me on DreamForge and get 15 free credits! ${baseUrl}`,
    referralUrl: baseUrl,
  };
}

function getShareMessage(platform: string, code: string, name: string): string {
  switch (platform) {
    case "twitter":
      return `I've been creating amazing AI art with @DreamForge! Join me and get 15 free credits. 🎨✨`;
    case "whatsapp":
      return `Hey! I've been using DreamForge to create stunning AI art. Sign up with my link and we both get bonus credits!`;
    case "telegram":
      return `Check out DreamForge - an amazing AI art platform! Use my referral link to get 15 free credits.`;
    case "email":
      return `${name} invited you to DreamForge - create stunning AI art with 15 free credits!`;
    default:
      return `Join me on DreamForge and get 15 free credits to create amazing AI art!`;
  }
}

// ─── Credit Budget Router ───────────────────────────────────────────────────
export const creditBudgetRouter = router({
  getBudget: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { budget: null };

    const [budget] = await db
      .select()
      .from(creditBudgets)
      .where(eq(creditBudgets.userId, ctx.user.id))
      .limit(1);

    return { budget: budget || null };
  }),

  updateBudget: protectedProcedure
    .input(
      z.object({
        dailyLimit: z.number().min(1).max(10000).nullable(),
        weeklyLimit: z.number().min(1).max(50000).nullable(),
        alertThreshold: z.number().min(10).max(100).default(80),
        enabled: z.boolean(),
      })
    )
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
          .set({
            dailyLimit: input.dailyLimit,
            weeklyLimit: input.weeklyLimit,
            alertThreshold: input.alertThreshold,
            enabled: input.enabled,
          })
          .where(eq(creditBudgets.userId, ctx.user.id));
      } else {
        await db.insert(creditBudgets).values({
          userId: ctx.user.id,
          dailyLimit: input.dailyLimit,
          weeklyLimit: input.weeklyLimit,
          alertThreshold: input.alertThreshold,
          enabled: input.enabled,
        });
      }

      return { success: true };
    }),

  getBudgetUsage: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { daily: { spent: 0, limit: null, percentage: 0 }, weekly: { spent: 0, limit: null, percentage: 0 }, alerts: [] };

    const [budget] = await db
      .select()
      .from(creditBudgets)
      .where(eq(creditBudgets.userId, ctx.user.id))
      .limit(1);

    if (!budget || !budget.enabled) {
      return {
        daily: { spent: 0, limit: null, percentage: 0 },
        weekly: { spent: 0, limit: null, percentage: 0 },
        alerts: [] as string[],
        enabled: false,
      };
    }

    // Get today's spending
    const [dailyResult] = await db
      .select({
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
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
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.type, "usage"),
          sql`createdAt >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`
        )
      );

    const dailySpent = dailyResult?.total || 0;
    const weeklySpent = weeklyResult?.total || 0;
    const dailyPercentage = budget.dailyLimit ? Math.round((dailySpent / budget.dailyLimit) * 100) : 0;
    const weeklyPercentage = budget.weeklyLimit ? Math.round((weeklySpent / budget.weeklyLimit) * 100) : 0;

    const alerts: string[] = [];
    if (budget.dailyLimit && dailyPercentage >= budget.alertThreshold) {
      alerts.push(`Daily budget at ${dailyPercentage}% (${dailySpent}/${budget.dailyLimit} credits)`);
    }
    if (budget.weeklyLimit && weeklyPercentage >= budget.alertThreshold) {
      alerts.push(`Weekly budget at ${weeklyPercentage}% (${weeklySpent}/${budget.weeklyLimit} credits)`);
    }
    if (budget.dailyLimit && dailySpent >= budget.dailyLimit) {
      alerts.push("Daily budget exceeded!");
    }
    if (budget.weeklyLimit && weeklySpent >= budget.weeklyLimit) {
      alerts.push("Weekly budget exceeded!");
    }

    return {
      daily: { spent: dailySpent, limit: budget.dailyLimit, percentage: dailyPercentage },
      weekly: { spent: weeklySpent, limit: budget.weeklyLimit, percentage: weeklyPercentage },
      alerts,
      enabled: true,
      alertThreshold: budget.alertThreshold,
    };
  }),

  checkBudget: protectedProcedure
    .input(z.object({ tool: z.string(), cost: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { allowed: true, warnings: [] };

      const [budget] = await db
        .select()
        .from(creditBudgets)
        .where(eq(creditBudgets.userId, ctx.user.id))
        .limit(1);

      if (!budget || !budget.enabled) {
        return { allowed: true, warnings: [] as string[] };
      }

      const [dailyResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, ctx.user.id),
            eq(creditTransactions.type, "usage"),
            sql`createdAt >= CURDATE()`
          )
        );

      const [weeklyResult] = await db
        .select({
          total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.userId, ctx.user.id),
            eq(creditTransactions.type, "usage"),
            sql`createdAt >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`
          )
        );

      const dailySpent = dailyResult?.total || 0;
      const weeklySpent = weeklyResult?.total || 0;
      const warnings: string[] = [];
      let allowed = true;

      if (budget.dailyLimit && dailySpent >= budget.dailyLimit) {
        warnings.push("Daily budget limit reached");
        allowed = false;
      }
      if (budget.weeklyLimit && weeklySpent >= budget.weeklyLimit) {
        warnings.push("Weekly budget limit reached");
        allowed = false;
      }
      if (budget.dailyLimit) {
        const pct = Math.round((dailySpent / budget.dailyLimit) * 100);
        if (pct >= budget.alertThreshold && pct < 100) {
          warnings.push(`Daily budget at ${pct}%`);
        }
      }
      if (budget.weeklyLimit) {
        const pct = Math.round((weeklySpent / budget.weeklyLimit) * 100);
        if (pct >= budget.alertThreshold && pct < 100) {
          warnings.push(`Weekly budget at ${pct}%`);
        }
      }

      return { allowed, warnings };
    }),
});

// ─── Achievement Router ─────────────────────────────────────────────────────
export const achievementRouter = router({
  getAchievements: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { unlocked: [], locked: [], totalUnlocked: 0, totalAchievements: ACHIEVEMENT_CATALOG.length };

    const unlocked = await db
      .select()
      .from(achievements)
      .where(eq(achievements.userId, ctx.user.id))
      .orderBy(desc(achievements.unlockedAt));

    const unlockedTypes = new Set(unlocked.map((a) => a.achievementType));

    // Get progress for locked achievements
    const [genCount] = await db
      .select({ total: count() })
      .from(generations)
      .where(eq(generations.userId, ctx.user.id));

    const [refCount] = await db
      .select({ total: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerId, ctx.user.id), eq(referrals.status, "completed")));

    const [purchaseCount] = await db
      .select({ total: count() })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, ctx.user.id), eq(creditTransactions.type, "purchase")));

    const [galleryCount] = await db
      .select({ total: count() })
      .from(galleryItems)
      .where(eq(galleryItems.userId, ctx.user.id));

    // Unique tools used
    const toolResults = await db
      .select({ desc: creditTransactions.description })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, ctx.user.id), eq(creditTransactions.type, "usage")));

    const uniqueTools = new Set<string>();
    for (const t of toolResults) {
      if (t.desc) {
        const match = t.desc.match(/^(Generated|Used|Animated|Batch|Blend|Upscale|Image)/i);
        if (match) uniqueTools.add(match[0].toLowerCase());
      }
    }

    // Early adopter check
    const [userRow] = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    const isEarlyAdopter = userRow
      ? (Date.now() - new Date(userRow.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000
        ? 0 // still within first month, not yet "early"
        : 1 // joined more than a month ago, check if they joined early
      : 0;

    const progressMap: Record<string, number> = {
      generationCount: genCount?.total || 0,
      referralCount: refCount?.total || 0,
      purchaseCount: purchaseCount?.total || 0,
      galleryCount: galleryCount?.total || 0,
      uniqueToolCount: uniqueTools.size,
      earlyAdopter: isEarlyAdopter,
    };

    const catalogWithProgress = ACHIEVEMENT_CATALOG.map((a) => {
      const isUnlocked = unlockedTypes.has(a.type);
      const current = progressMap[a.field] || 0;
      const progress = Math.min(Math.round((current / a.threshold) * 100), 100);
      const unlockedData = unlocked.find((u) => u.achievementType === a.type);

      return {
        ...a,
        isUnlocked,
        progress,
        current,
        unlockedAt: unlockedData?.unlockedAt || null,
      };
    });

    return {
      unlocked: catalogWithProgress.filter((a) => a.isUnlocked),
      locked: catalogWithProgress.filter((a) => !a.isUnlocked),
      totalUnlocked: catalogWithProgress.filter((a) => a.isUnlocked).length,
      totalAchievements: ACHIEVEMENT_CATALOG.length,
    };
  }),

  checkAndUnlock: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { newlyUnlocked: [] };

    // Get existing achievements
    const existing = await db
      .select({ type: achievements.achievementType })
      .from(achievements)
      .where(eq(achievements.userId, ctx.user.id));

    const existingTypes = new Set(existing.map((a) => a.type));

    // Get current counts
    const [genCount] = await db
      .select({ total: count() })
      .from(generations)
      .where(eq(generations.userId, ctx.user.id));

    const [refCount] = await db
      .select({ total: count() })
      .from(referrals)
      .where(and(eq(referrals.referrerId, ctx.user.id), eq(referrals.status, "completed")));

    const [purchaseCount] = await db
      .select({ total: count() })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, ctx.user.id), eq(creditTransactions.type, "purchase")));

    const [galleryCount] = await db
      .select({ total: count() })
      .from(galleryItems)
      .where(eq(galleryItems.userId, ctx.user.id));

    const toolResults = await db
      .select({ desc: creditTransactions.description })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.userId, ctx.user.id), eq(creditTransactions.type, "usage")));

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
      earlyAdopter: 1, // Assume eligible for now
    };

    const newlyUnlocked: Array<{ type: string; name: string; description: string; icon: string; color: string }> = [];

    for (const achievement of ACHIEVEMENT_CATALOG) {
      if (existingTypes.has(achievement.type)) continue;

      const current = progressMap[achievement.field] || 0;
      if (current >= achievement.threshold) {
        await db.insert(achievements).values({
          userId: ctx.user.id,
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
            ctx.user.id,
            "system",
            `Achievement Unlocked: ${achievement.name}!`,
            achievement.description,
            { achievementType: achievement.type }
          );
        } catch {}
      }
    }

    return { newlyUnlocked };
  }),

  getCatalog: publicProcedure.query(() => {
    return {
      achievements: ACHIEVEMENT_CATALOG.map((a) => ({
        type: a.type,
        name: a.name,
        description: a.description,
        icon: a.icon,
        color: a.color,
        category: a.category,
        threshold: a.threshold,
      })),
    };
  }),
});
