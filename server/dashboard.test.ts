import { describe, it, expect, vi } from "vitest";

// Mock the DB functions that getUsageStats and getActivityTimeline depend on
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    getUserUsageStats: vi.fn().mockResolvedValue({
      totalGenerations: 12,
      completedGenerations: 10,
      failedGenerations: 2,
      images: 8,
      videos: 3,
      animations: 1,
      modelUsage: [
        { model: "grok", count: 6 },
        { model: "dall-e-3", count: 4 },
      ],
      galleryItems: 5,
      totalViews: 120,
      dailyActivity: [
        { date: "2026-03-20", count: 3 },
        { date: "2026-03-21", count: 5 },
      ],
      monthlyUsage: { images: 8, videos: 3, animations: 1 },
      quota: {
        images: { used: 8, limit: 25 },
        videos: { used: 3, limit: 5 },
        animations: { used: 1, limit: 3 },
        gallerySubmissions: { used: 2, limit: 5 },
      },
    }),
    getUserActivityTimeline: vi.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          prompt: "Test prompt",
          mediaType: "image",
          modelVersion: "grok",
          status: "completed",
          createdAt: new Date(),
        },
      ],
      total: 1,
    }),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): {
  ctx: TrpcContext;
} {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-dashboard",
    email: "creator@example.com",
    name: "Dashboard Creator",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

// ─── user.getUsageStats Tests ───────────────────────────────────────────────

describe("user.getUsageStats", () => {
  it("should return usage stats for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(stats).toHaveProperty("totalGenerations");
    expect(stats).toHaveProperty("completedGenerations");
    expect(stats).toHaveProperty("failedGenerations");
    expect(stats).toHaveProperty("images");
    expect(stats).toHaveProperty("videos");
    expect(stats).toHaveProperty("animations");
    expect(stats).toHaveProperty("modelUsage");
    expect(stats).toHaveProperty("galleryItems");
    expect(stats).toHaveProperty("totalViews");
    expect(stats).toHaveProperty("dailyActivity");
    expect(stats).toHaveProperty("monthlyUsage");
    expect(stats).toHaveProperty("quota");
  });

  it("should return numeric values for all stat fields", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(typeof stats.totalGenerations).toBe("number");
    expect(typeof stats.completedGenerations).toBe("number");
    expect(typeof stats.failedGenerations).toBe("number");
    expect(typeof stats.images).toBe("number");
    expect(typeof stats.videos).toBe("number");
    expect(typeof stats.animations).toBe("number");
    expect(typeof stats.galleryItems).toBe("number");
    expect(typeof stats.totalViews).toBe("number");
  });

  it("should return modelUsage as an array of objects with model and count", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(Array.isArray(stats.modelUsage)).toBe(true);
    for (const item of stats.modelUsage) {
      expect(item).toHaveProperty("model");
      expect(item).toHaveProperty("count");
      expect(typeof item.model).toBe("string");
      expect(typeof item.count).toBe("number");
    }
  });

  it("should return dailyActivity as an array of date/count objects", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(Array.isArray(stats.dailyActivity)).toBe(true);
    for (const item of stats.dailyActivity) {
      expect(item).toHaveProperty("date");
      expect(item).toHaveProperty("count");
      expect(typeof item.count).toBe("number");
    }
  });

  it("should return quota with used and limit for each category", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(stats.quota).toHaveProperty("images");
    expect(stats.quota).toHaveProperty("videos");
    expect(stats.quota).toHaveProperty("animations");
    expect(stats.quota).toHaveProperty("gallerySubmissions");

    for (const key of ["images", "videos", "animations", "gallerySubmissions"] as const) {
      expect(stats.quota[key]).toHaveProperty("used");
      expect(stats.quota[key]).toHaveProperty("limit");
      expect(typeof stats.quota[key].used).toBe("number");
      expect(typeof stats.quota[key].limit).toBe("number");
      expect(stats.quota[key].limit).toBeGreaterThan(0);
    }
  });

  it("should return Free tier limits (25 images, 5 videos, 3 animations, 5 gallery)", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(stats.quota.images.limit).toBe(25);
    expect(stats.quota.videos.limit).toBe(5);
    expect(stats.quota.animations.limit).toBe(3);
    expect(stats.quota.gallerySubmissions.limit).toBe(5);
  });

  it("should return non-negative values for all counts", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(stats.totalGenerations).toBeGreaterThanOrEqual(0);
    expect(stats.completedGenerations).toBeGreaterThanOrEqual(0);
    expect(stats.failedGenerations).toBeGreaterThanOrEqual(0);
    expect(stats.images).toBeGreaterThanOrEqual(0);
    expect(stats.videos).toBeGreaterThanOrEqual(0);
    expect(stats.animations).toBeGreaterThanOrEqual(0);
    expect(stats.galleryItems).toBeGreaterThanOrEqual(0);
    expect(stats.totalViews).toBeGreaterThanOrEqual(0);
  });

  it("should return monthlyUsage with images, videos, and animations", async () => {
    const { ctx } = createAuthContext();
    const stats = await caller(ctx).user.getUsageStats();

    expect(stats.monthlyUsage).toHaveProperty("images");
    expect(stats.monthlyUsage).toHaveProperty("videos");
    expect(stats.monthlyUsage).toHaveProperty("animations");
    expect(typeof stats.monthlyUsage.images).toBe("number");
    expect(typeof stats.monthlyUsage.videos).toBe("number");
    expect(typeof stats.monthlyUsage.animations).toBe("number");
  });

  it("should reject unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    await expect(caller(ctx).user.getUsageStats()).rejects.toThrow();
  });
});

// ─── user.getActivityTimeline Tests ─────────────────────────────────────────

describe("user.getActivityTimeline", () => {
  it("should return activity timeline for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).user.getActivityTimeline({ limit: 10, offset: 0 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("should return timeline items with correct shape", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).user.getActivityTimeline({ limit: 10, offset: 0 });

    for (const item of result.items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("prompt");
      expect(item).toHaveProperty("mediaType");
      expect(item).toHaveProperty("modelVersion");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("createdAt");
    }
  });

  it("should respect limit parameter", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).user.getActivityTimeline({ limit: 5, offset: 0 });

    expect(result.items.length).toBeLessThanOrEqual(5);
  });

  it("should work with default parameters (no input)", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).user.getActivityTimeline();

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });

  it("should reject limit over 100", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).user.getActivityTimeline({ limit: 101, offset: 0 })
    ).rejects.toThrow();
  });

  it("should reject negative offset", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).user.getActivityTimeline({ limit: 10, offset: -1 })
    ).rejects.toThrow();
  });

  it("should reject unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    await expect(
      caller(ctx).user.getActivityTimeline({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("should return total count as non-negative number", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).user.getActivityTimeline({ limit: 10, offset: 0 });

    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
