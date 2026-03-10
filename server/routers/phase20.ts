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
import { eq, sql, desc, and, count, gte, lte, lt, isNull } from "drizzle-orm";
import { addCredits, getOrCreateBalance, deductCredits } from "../stripe";
import { createNotification } from "../routersPhase15";
import { ENV } from "../_core/env";
import { generateDigestForUser, formatDigestAsText, type DigestData } from "./phase19";

// ─── Referral Leaderboard Router ──────────────────────────────────────────

function anonymizeName(name: string | null): string {
  if (!name || name.length < 2) return "An***";
  return name.slice(0, 2) + "***";
}

export const leaderboardRouter = router({
  /**
   * Get the top referrers leaderboard.
   * Public endpoint — names are anonymized for privacy.
   */
  getLeaderboard: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(5).max(50).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { entries: [], total: 0 };

      const limit = input?.limit || 20;

      const results = await db
        .select({
          userId: referrals.referrerId,
          referralCount: count(),
          userName: users.name,
        })
        .from(referrals)
        .innerJoin(users, eq(referrals.referrerId, users.id))
        .where(eq(referrals.status, "completed"))
        .groupBy(referrals.referrerId, users.name)
        .orderBy(sql`count(*) DESC`)
        .limit(limit);

      // Determine tier for each user
      const TIERS = [
        { threshold: 50, name: "Diamond", color: "#B9F2FF" },
        { threshold: 30, name: "Platinum", color: "#E5E4E2" },
        { threshold: 15, name: "Gold", color: "#FFD700" },
        { threshold: 7, name: "Silver", color: "#C0C0C0" },
        { threshold: 3, name: "Bronze", color: "#CD7F32" },
      ];

      const entries = results.map((r, index) => {
        let tier: { name: string; color: string } | null = null;
        for (const t of TIERS) {
          if (r.referralCount >= t.threshold) {
            tier = { name: t.name, color: t.color };
            break;
          }
        }

        return {
          rank: index + 1,
          displayName: anonymizeName(r.userName),
          referralCount: r.referralCount,
          tier,
          userId: r.userId, // used to highlight current user
        };
      });

      return { entries, total: results.length };
    }),

  /**
   * Get the current user's rank on the leaderboard.
   */
  getMyRank: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { rank: null, referralCount: 0, totalParticipants: 0 };

    // Get user's referral count
    const [myCount] = await db
      .select({ total: count() })
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, ctx.user.id),
          eq(referrals.status, "completed")
        )
      );

    const referralCount = myCount?.total || 0;

    if (referralCount === 0) {
      return { rank: null, referralCount: 0, totalParticipants: 0 };
    }

    // Get all referrer counts to calculate rank
    const allReferrers = await db
      .select({
        referrerId: referrals.referrerId,
        cnt: count(),
      })
      .from(referrals)
      .where(eq(referrals.status, "completed"))
      .groupBy(referrals.referrerId)
      .orderBy(sql`count(*) DESC`);

    const totalParticipants = allReferrers.length;
    let rank = 1;
    for (const r of allReferrers) {
      if (r.cnt > referralCount) {
        rank++;
      } else {
        break;
      }
    }

    return { rank, referralCount, totalParticipants };
  }),
});

// ─── Credit Expiration Router ─────────────────────────────────────────────

const EXPIRATION_DAYS_BONUS = 90; // Bonus credits expire after 90 days
const EXPIRATION_WARNING_DAYS = 7; // Warn 7 days before expiration

export const creditExpirationRouter = router({
  /**
   * Get credits that are expiring soon (within 7 days).
   */
  getExpiringCredits: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { expiringCredits: [], totalExpiring: 0, nextExpiration: null };

    const now = new Date();
    const warningDate = new Date(now.getTime() + EXPIRATION_WARNING_DAYS * 24 * 60 * 60 * 1000);

    const expiring = await db
      .select({
        id: creditTransactions.id,
        amount: creditTransactions.amount,
        description: creditTransactions.description,
        expiresAt: creditTransactions.expiresAt,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.expired, false),
          sql`${creditTransactions.expiresAt} IS NOT NULL`,
          lte(creditTransactions.expiresAt, warningDate),
          gte(creditTransactions.expiresAt, now)
        )
      )
      .orderBy(creditTransactions.expiresAt);

    const totalExpiring = expiring.reduce((sum, e) => sum + e.amount, 0);
    const nextExpiration = expiring.length > 0 ? expiring[0].expiresAt : null;

    return {
      expiringCredits: expiring.map((e) => ({
        id: e.id,
        amount: e.amount,
        description: e.description,
        expiresAt: e.expiresAt,
        daysLeft: e.expiresAt
          ? Math.max(0, Math.ceil((new Date(e.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
          : 0,
      })),
      totalExpiring,
      nextExpiration,
    };
  }),

  /**
   * Get a summary of all credits with expiration info.
   */
  getExpirationSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { hasExpiringCredits: false, totalExpiringSoon: 0, nextExpiration: null, totalNonExpiring: 0 };

    const now = new Date();
    const warningDate = new Date(now.getTime() + EXPIRATION_WARNING_DAYS * 24 * 60 * 60 * 1000);

    // Credits expiring within warning period
    const [expiringSoon] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
        count: count(),
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.expired, false),
          sql`${creditTransactions.expiresAt} IS NOT NULL`,
          lte(creditTransactions.expiresAt, warningDate),
          gte(creditTransactions.expiresAt, now)
        )
      );

    // Next expiration date
    const [nextExp] = await db
      .select({ expiresAt: creditTransactions.expiresAt })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, ctx.user.id),
          eq(creditTransactions.expired, false),
          sql`${creditTransactions.expiresAt} IS NOT NULL`,
          gte(creditTransactions.expiresAt, now)
        )
      )
      .orderBy(creditTransactions.expiresAt)
      .limit(1);

    return {
      hasExpiringCredits: (expiringSoon?.total || 0) > 0,
      totalExpiringSoon: expiringSoon?.total || 0,
      nextExpiration: nextExp?.expiresAt || null,
      daysUntilNextExpiration: nextExp?.expiresAt
        ? Math.max(0, Math.ceil((new Date(nextExp.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
        : null,
    };
  }),

  /**
   * Process expired credits — admin only.
   * Marks expired transactions and deducts from balance.
   */
  processExpired: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();

    // Find all expired, unprocessed bonus/refund transactions
    const expired = await db
      .select({
        id: creditTransactions.id,
        userId: creditTransactions.userId,
        amount: creditTransactions.amount,
        description: creditTransactions.description,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.expired, false),
          sql`${creditTransactions.expiresAt} IS NOT NULL`,
          lt(creditTransactions.expiresAt, now)
        )
      );

    let processedCount = 0;
    let totalDeducted = 0;

    for (const tx of expired) {
      try {
        // Mark as expired
        await db
          .update(creditTransactions)
          .set({ expired: true })
          .where(eq(creditTransactions.id, tx.id));

        // Deduct from balance (only if they still have credits)
        const balance = await getOrCreateBalance(tx.userId);
        const deductAmount = Math.min(tx.amount, balance.balance);

        if (deductAmount > 0) {
          await deductCredits(tx.userId, deductAmount, `Expired credits: ${tx.description || "bonus credits"}`);
          totalDeducted += deductAmount;
        }

        // Notify user
        try {
          await createNotification(
            tx.userId,
            "system",
            "Credits Expired",
            `${tx.amount} bonus credits have expired. ${deductAmount > 0 ? `${deductAmount} credits were deducted from your balance.` : "No balance change since credits were already used."}`,
            { expiredAmount: tx.amount, deducted: deductAmount }
          );
        } catch {}

        processedCount++;
      } catch (err) {
        console.error(`[Expiration] Failed to process tx ${tx.id}:`, err);
      }
    }

    return { success: true, processedCount, totalDeducted, totalExpired: expired.length };
  }),
});

// ─── Email Digest Delivery Router ─────────────────────────────────────────

/**
 * Send an email via the Forge API's built-in email service.
 * Falls back gracefully if the service is unavailable.
 */
async function sendDigestEmail(
  toEmail: string,
  userName: string,
  digest: DigestData
): Promise<boolean> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.warn("[EmailDigest] Forge API not configured, skipping email");
    return false;
  }

  const htmlContent = generateDigestHtml(digest);
  const subject = `Your ${digest.period === "weekly" ? "Weekly" : "Monthly"} DreamForge Usage Digest`;

  try {
    const endpoint = `${ENV.forgeApiUrl.replace(/\/$/, "")}/webdevtoken.v1.WebDevService/SendNotification`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1",
      },
      body: JSON.stringify({
        title: subject,
        content: htmlContent,
      }),
    });

    if (!response.ok) {
      console.warn(`[EmailDigest] Failed to send email (${response.status})`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[EmailDigest] Error sending email:", error);
    return false;
  }
}

function generateDigestHtml(digest: DigestData): string {
  const changeIcon = (val: number) => (val >= 0 ? "📈" : "📉");
  const changeColor = (val: number) => (val >= 0 ? "#f59e0b" : "#10b981");

  const toolRows = digest.topTools
    .map(
      (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;color:#e2e8f0;">${t.tool.replace(/-/g, " ")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;color:#e2e8f0;text-align:center;">${t.count}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #2a2a3e;color:#a78bfa;text-align:right;font-weight:600;">${t.credits}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #2a2a3e;">
      <h1 style="margin:0;color:#a78bfa;font-size:24px;">✨ DreamForge</h1>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Your ${digest.periodLabel} Usage Digest</p>
    </div>

    <!-- Greeting -->
    <div style="padding:24px 0;">
      <p style="color:#e2e8f0;font-size:16px;margin:0;">Hi ${digest.userName},</p>
      <p style="color:#94a3b8;font-size:14px;margin:8px 0 0;">Here's a summary of your DreamForge activity.</p>
    </div>

    <!-- Stats Grid -->
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px;">
      <div style="flex:1;min-width:120px;background:#1a1a2e;border-radius:12px;padding:16px;text-align:center;">
        <div style="color:#a78bfa;font-size:28px;font-weight:700;">${digest.totalSpent}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Credits Used</div>
      </div>
      <div style="flex:1;min-width:120px;background:#1a1a2e;border-radius:12px;padding:16px;text-align:center;">
        <div style="color:#818cf8;font-size:28px;font-weight:700;">${digest.totalGenerations}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Generations</div>
      </div>
      <div style="flex:1;min-width:120px;background:#1a1a2e;border-radius:12px;padding:16px;text-align:center;">
        <div style="color:#6366f1;font-size:28px;font-weight:700;">${digest.avgPerDay}</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:4px;">Avg/Day</div>
      </div>
    </div>

    <!-- Comparison -->
    <div style="background:#1a1a2e;border-radius:12px;padding:16px;margin-bottom:24px;">
      <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Compared to Previous Period</h3>
      <div style="display:flex;gap:24px;">
        <div>
          <span style="color:${changeColor(digest.comparedToPrevious.spentChange)};font-weight:600;">
            ${changeIcon(digest.comparedToPrevious.spentChange)} ${digest.comparedToPrevious.spentChange >= 0 ? "+" : ""}${digest.comparedToPrevious.spentChange}%
          </span>
          <span style="color:#94a3b8;font-size:13px;margin-left:4px;">spending</span>
        </div>
        <div>
          <span style="color:${changeColor(digest.comparedToPrevious.generationsChange)};font-weight:600;">
            ${changeIcon(digest.comparedToPrevious.generationsChange)} ${digest.comparedToPrevious.generationsChange >= 0 ? "+" : ""}${digest.comparedToPrevious.generationsChange}%
          </span>
          <span style="color:#94a3b8;font-size:13px;margin-left:4px;">generations</span>
        </div>
      </div>
    </div>

    ${
      digest.topTools.length > 0
        ? `
    <!-- Top Tools -->
    <div style="background:#1a1a2e;border-radius:12px;padding:16px;margin-bottom:24px;">
      <h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em;">🛠️ Top Tools</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:8px 12px;border-bottom:2px solid #2a2a3e;color:#94a3b8;text-align:left;font-size:12px;">Tool</th>
            <th style="padding:8px 12px;border-bottom:2px solid #2a2a3e;color:#94a3b8;text-align:center;font-size:12px;">Uses</th>
            <th style="padding:8px 12px;border-bottom:2px solid #2a2a3e;color:#94a3b8;text-align:right;font-size:12px;">Credits</th>
          </tr>
        </thead>
        <tbody>${toolRows}</tbody>
      </table>
    </div>`
        : ""
    }

    <!-- Balance -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="color:rgba(255,255,255,0.8);font-size:13px;">Current Balance</div>
      <div style="color:#fff;font-size:36px;font-weight:700;margin:4px 0;">${digest.currentBalance}</div>
      <div style="color:rgba(255,255,255,0.7);font-size:12px;">credits remaining</div>
      ${
        digest.currentBalance < 10
          ? '<div style="margin-top:12px;padding:8px;background:rgba(255,255,255,0.15);border-radius:8px;color:#fbbf24;font-size:13px;">⚠️ Low balance — consider purchasing more credits</div>'
          : ""
      }
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #2a2a3e;">
      <p style="color:#64748b;font-size:12px;margin:0;">You're receiving this because you enabled usage digests in DreamForge.</p>
      <p style="color:#64748b;font-size:12px;margin:4px 0 0;">Manage your preferences in Credits → Digest settings.</p>
    </div>
  </div>
</body>
</html>`;
}

export const emailDigestRouter = router({
  /**
   * Get email digest preferences.
   */
  getEmailPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { emailEnabled: false, email: null };

    const [user] = await db
      .select({
        emailDigestEnabled: users.emailDigestEnabled,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    return {
      emailEnabled: user?.emailDigestEnabled ?? false,
      email: user?.email || null,
    };
  }),

  /**
   * Update email digest preferences.
   */
  updateEmailPreferences: protectedProcedure
    .input(z.object({ emailEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(users)
        .set({ emailDigestEnabled: input.emailEnabled })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  /**
   * Send a test digest email to the current user.
   */
  sendTestEmail: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const [user] = await db
      .select({ email: users.email, name: users.name, digestFrequency: users.digestFrequency })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user?.email) {
      return { success: false, message: "No email address on file" };
    }

    const frequency = (user.digestFrequency as "weekly" | "monthly") ?? "weekly";
    const digest = await generateDigestForUser(ctx.user.id, user.name || "Creator", frequency);

    if (!digest) {
      return { success: false, message: "No usage data to generate digest" };
    }

    const sent = await sendDigestEmail(user.email, user.name || "Creator", digest);

    return {
      success: sent,
      message: sent
        ? "Digest notification sent successfully"
        : "Unable to send email — digest was sent as in-app notification instead",
    };
  }),

  /**
   * Send scheduled email digests — admin only.
   * Enhanced version that also sends emails to users who opted in.
   */
  sendScheduledEmailDigests: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get users with email digest enabled
    const eligibleUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        digestFrequency: users.digestFrequency,
        lastDigestSentAt: users.lastDigestSentAt,
        emailDigestEnabled: users.emailDigestEnabled,
      })
      .from(users)
      .where(eq(users.digestEnabled, true));

    let emailsSent = 0;
    let notificationsSent = 0;

    for (const user of eligibleUsers) {
      const frequency = user.digestFrequency as "weekly" | "monthly";
      const cutoff = frequency === "weekly" ? weekAgo : monthAgo;

      if (user.lastDigestSentAt && user.lastDigestSentAt > cutoff) continue;

      try {
        const digest = await generateDigestForUser(user.id, user.name || "Creator", frequency);
        if (!digest) continue;

        // Always send in-app notification
        await createNotification(
          user.id,
          "system",
          `Your ${frequency === "weekly" ? "Weekly" : "Monthly"} Usage Digest`,
          formatDigestAsText(digest),
          { digestData: digest }
        );
        notificationsSent++;

        // Also send email if opted in
        if (user.emailDigestEnabled && user.email) {
          const emailSent = await sendDigestEmail(user.email, user.name || "Creator", digest);
          if (emailSent) emailsSent++;
        }

        await db
          .update(users)
          .set({ lastDigestSentAt: new Date() })
          .where(eq(users.id, user.id));
      } catch (err) {
        console.error(`[EmailDigest] Failed for user ${user.id}:`, err);
      }
    }

    return {
      success: true,
      emailsSent,
      notificationsSent,
      totalEligible: eligibleUsers.length,
    };
  }),
});

// Export helpers for testing
export { anonymizeName, sendDigestEmail, generateDigestHtml, EXPIRATION_DAYS_BONUS, EXPIRATION_WARNING_DAYS };
