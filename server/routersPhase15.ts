import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  listTakedownRequests,
  resolveTakedownRequest,
  resolveTakedownTarget,
  removeGalleryItem,
  logTakedownAction,
  reviewModerationItem,
} from "./db";
import {
  creditBalances,
  creditTransactions,
  notifications,
  notificationPreferences,
  users,
  generations,
  galleryItems,
  moderationQueue,
  takedownRequests,
  webhookEvents,
} from "../drizzle/schema";
import { eq, sql, desc, and, like, count } from "drizzle-orm";
import {
  getOrCreateBalance,
  deductCredits,
  addCredits,
  getCreditHistory,
  createCheckoutSession,
  sanitizeRedirectOrigin,
  requestOriginFromCtx,
  CREDIT_PACKAGES,
  CREDIT_COSTS,
} from "./stripe";

// ─── Notification Helpers ───────────────────────────────────────────────────
export async function createNotification(
  userId: number,
  type: "collaboration" | "generation" | "comment" | "system" | "payment",
  title: string,
  message: string,
  metadata?: any
) {
  const db = await getDb();
  if (!db) return;

  // Check user preferences
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.type, type)
      )
    )
    .limit(1);

  // If preference exists and is disabled, skip
  if (prefs.length > 0 && !prefs[0].enabled) return;

  await db.insert(notifications).values({
    userId,
    type,
    title,
    message,
    metadata: metadata || null,
  });
}

// ─── Credits Router ─────────────────────────────────────────────────────────
export const creditsRouter = router({
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const balance = await getOrCreateBalance(ctx.user.id);
    return {
      balance: balance.balance,
      lifetimeSpent: balance.lifetimeSpent,
    };
  }),

  getPackages: publicProcedure.query(() => {
    return CREDIT_PACKAGES;
  }),

  getCosts: publicProcedure.query(() => {
    return CREDIT_COSTS;
  }),

  getHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return getCreditHistory(ctx.user.id, input?.limit || 50);
    }),

  createCheckout: protectedProcedure
    .input(
      z.object({
        packageId: z.string(),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await createCheckoutSession(
        ctx.user.id,
        ctx.user.email || "",
        ctx.user.name || "User",
        input.packageId,
        // Allowlist the client origin (open redirect / session-id leak);
        // mismatches fall back to APP_URL inside createCheckoutSession.
        sanitizeRedirectOrigin(input.origin, requestOriginFromCtx(ctx))
      );
      return result;
    }),

  deduct: protectedProcedure
    .input(
      z.object({
        tool: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cost = CREDIT_COSTS[input.tool] || 1;
      const result = await deductCredits(
        ctx.user.id,
        cost,
        input.description || `Used ${input.tool}`
      );
      if (!result.success) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Insufficient credits. Need ${result.needed}, have ${result.balance}`,
        });
      }
      return result;
    }),
});

// ─── Notifications Router ───────────────────────────────────────────────────
export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          unreadOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { notifications: [], unreadCount: 0 };

      const conditions = [eq(notifications.userId, ctx.user.id)];
      if (input?.unreadOnly) {
        conditions.push(eq(notifications.read, false));
      }

      const items = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input?.limit || 30);

      const unreadResult = await db
        .select({ count: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.read, false)
          )
        );

      return {
        notifications: items,
        unreadCount: unreadResult[0]?.count || 0,
      };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.userId, ctx.user.id));
    return { success: true };
  }),

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const prefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, ctx.user.id));

    // Return defaults for any missing types
    const types = ["collaboration", "generation", "comment", "system", "payment"] as const;
    return types.map((type) => {
      const existing = prefs.find((p) => p.type === type);
      return {
        type,
        enabled: existing ? existing.enabled : true,
      };
    });
  }),

  updatePreference: protectedProcedure
    .input(
      z.object({
        type: z.enum(["collaboration", "generation", "comment", "system", "payment"]),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db
        .select()
        .from(notificationPreferences)
        .where(
          and(
            eq(notificationPreferences.userId, ctx.user.id),
            eq(notificationPreferences.type, input.type)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(notificationPreferences)
          .set({ enabled: input.enabled })
          .where(eq(notificationPreferences.id, existing[0].id));
      } else {
        await db.insert(notificationPreferences).values({
          userId: ctx.user.id,
          type: input.type,
          enabled: input.enabled,
        });
      }
      return { success: true };
    }),
});

// ─── Admin Router ───────────────────────────────────────────────────────────
export const adminRouter = router({
  getPlatformStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalUsers: 0, totalGenerations: 0, totalRevenue: 0, totalGalleryItems: 0 };

    const [userCount] = await db.select({ count: count() }).from(users);
    const [genCount] = await db.select({ count: count() }).from(generations);
    const [galleryCount] = await db.select({ count: count() }).from(galleryItems);

    // Sum of all purchase transactions
    const revenueResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.type, "purchase"));

    return {
      totalUsers: userCount?.count || 0,
      totalGenerations: genCount?.count || 0,
      totalGalleryItems: galleryCount?.count || 0,
      totalRevenue: revenueResult[0]?.total || 0,
    };
  }),

  listUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().min(1).optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { users: [], total: 0 };

      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const offset = (page - 1) * limit;

      let query = db.select().from(users);
      let countQuery = db.select({ count: count() }).from(users);

      if (input?.search) {
        const searchPattern = `%${input.search}%`;
        query = query.where(like(users.name, searchPattern)) as any;
        countQuery = countQuery.where(like(users.name, searchPattern)) as any;
      }

      const items = await (query as any).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
      const [total] = await countQuery;

      return {
        users: items,
        total: total?.count || 0,
      };
    }),

  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  listFlaggedContent: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        page: z.number().min(1).optional(),
        limit: z.number().min(1).max(100).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const offset = (page - 1) * limit;

      let conditions: any[] = [];
      if (input?.status) {
        conditions.push(eq(moderationQueue.status, input.status));
      }

      const items = await db
        .select()
        .from(moderationQueue)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(moderationQueue.createdAt))
        .limit(limit)
        .offset(offset);

      const [total] = await db
        .select({ count: count() })
        .from(moderationQueue)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        items,
        total: total?.count || 0,
      };
    }),

  reviewContent: adminProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["approved", "rejected"]),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Delegates to the hardened db helper: pending-only state guard,
      // transactional publish, duplicate-publish safe.
      const result = await reviewModerationItem(
        input.id,
        ctx.user.id,
        input.status,
        input.reviewNote
      );
      if (!result.updated) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Moderation item is missing or was already reviewed",
        });
      }
      return { success: true };
    }),

  /**
   * Takedown-request review (TAKE IT DOWN Act intake from /api/takedown).
   * Nothing else in the codebase reads takedown_requests — these procedures
   * are the actioning path.
   */
  takedown: router({
    list: adminProcedure
      .input(
        z
          .object({
            status: z.enum(["open", "actioned", "rejected", "test"]).optional(),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { requests: [] };
        const requests = await listTakedownRequests(input?.status);
        return { requests };
      }),

    resolve: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          action: z.enum(["remove_content", "reject"]),
          note: z.string().trim().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [request] = await db
          .select()
          .from(takedownRequests)
          .where(eq(takedownRequests.id, input.id))
          .limit(1);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Takedown request not found" });
        }
        if (request.status !== "open") {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Request is already ${request.status}`,
          });
        }

        // remove_content deletes the public gallery row FIRST and only then
        // marks the request actioned — a request must never read "actioned"
        // while its content is still up. Content the URL no longer resolves
        // to (removed earlier / raced) is fine: the goal state — content
        // absent — already holds. URLs that never pointed at a gallery item
        // (CDN images, external links) can't be actioned automatically and
        // must be rejected or handled out of band.
        let itemRemoved = false;
        if (input.action === "remove_content") {
          const target = await resolveTakedownTarget(request.url);
          if (target.kind === "unresolvable") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "The reported URL doesn't reference a gallery item we can remove (CDN or external link?). Reject the request or handle it manually.",
            });
          }
          if (target.kind === "gallery_item") {
            const removal = await removeGalleryItem(target.item.id);
            itemRemoved = removal.removed;
          }
        }

        const { updated, request: resolved } = await resolveTakedownRequest({
          id: input.id,
          action: input.action,
          adminNote: input.note,
          adminUserId: ctx.user.id,
        });
        if (!updated || !resolved) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Request was resolved concurrently — refresh the list",
          });
        }

        await logTakedownAction({
          adminUserId: ctx.user.id,
          action: input.action,
          ticket: resolved.ticket,
          url: resolved.url,
          ip: resolved.ip,
        });

        return { success: true, status: resolved.status, itemRemoved };
      }),
  }),

  getGenerationAnalytics: adminProcedure
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const period = input?.period || "daily";
      let dateFormat: string;
      let daysBack: number;

      switch (period) {
        case "weekly":
          dateFormat = "%Y-%u"; // year-week
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
          period: sql<string>`DATE_FORMAT(${generations.createdAt}, ${dateFormat})`,
          count: count(),
        })
        .from(generations)
        .where(
          sql`${generations.createdAt} >= DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
        )
        .groupBy(sql`DATE_FORMAT(${generations.createdAt}, ${dateFormat})`)
        .orderBy(sql`DATE_FORMAT(${generations.createdAt}, ${dateFormat})`);

      return results;
    }),

  getRevenueAnalytics: adminProcedure
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
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
          total: sql<number>`COALESCE(SUM(amount), 0)`,
          count: count(),
        })
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.type, "purchase"),
            sql`${creditTransactions.createdAt} >= DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
          )
        )
        .groupBy(sql`DATE_FORMAT(${creditTransactions.createdAt}, ${dateFormat})`)
        .orderBy(sql`DATE_FORMAT(${creditTransactions.createdAt}, ${dateFormat})`);

      return results;
    }),

  getWebhookEvents: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).optional(),
        limit: z.number().min(1).max(100).optional(),
        status: z.enum(["processed", "failed", "ignored"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [], total: 0 };

      const page = input?.page || 1;
      const limit = input?.limit || 30;
      const offset = (page - 1) * limit;

      let conditions: any[] = [];
      if (input?.status) {
        conditions.push(eq(webhookEvents.status, input.status));
      }

      const items = await db
        .select()
        .from(webhookEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(webhookEvents.createdAt))
        .limit(limit)
        .offset(offset);

      const [total] = await db
        .select({ count: count() })
        .from(webhookEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        events: items,
        total: total?.count || 0,
      };
    }),

  sendSystemNotification: adminProcedure
    .input(
      z.object({
        userId: z.number().optional(), // if omitted, send to all
        title: z.string(),
        message: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.userId) {
        await createNotification(
          input.userId,
          "system",
          input.title,
          input.message
        );
      } else {
        // Send to all users
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const allUsers = await db.select({ id: users.id }).from(users);
        for (const user of allUsers) {
          await createNotification(
            user.id,
            "system",
            input.title,
            input.message
          );
        }
      }
      return { success: true };
    }),
});
