import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
}));

// Mock stripe module
vi.mock("./stripe", () => ({
  getOrCreateBalance: vi.fn(),
  deductCredits: vi.fn(),
  addCredits: vi.fn(),
  getCreditHistory: vi.fn(),
  createCheckoutSession: vi.fn(),
  CREDIT_COSTS: {
    "text-to-image": 1,
    "image-to-image": 1,
    "text-to-video": 5,
    "style-transfer": 2,
    "super-resolution": 2,
    storyboard: 3,
    "prompt-assist": 0,
  },
  CREDIT_PACKAGES: [
    { id: "starter", name: "Starter Pack", credits: 100, price: 499, priceDisplay: "$4.99", perCredit: "$0.05", popular: false, description: "Test" },
    { id: "creator", name: "Creator Pack", credits: 500, price: 1999, priceDisplay: "$19.99", perCredit: "$0.04", popular: true, description: "Test" },
  ],
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "mocked" } }],
  }),
}));

// Mock image generation
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/img.png" }),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/file.png", key: "file.png" }),
}));

// Mock notification
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock routersPhase15 createNotification
vi.mock("./routersPhase15", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    createNotification: vi.fn().mockResolvedValue(undefined),
  };
});

import { appRouter } from "./routers";
import { getOrCreateBalance, addCredits } from "./stripe";

const createCaller = (user?: any) => {
  return appRouter.createCaller({
    user: user || null,
    req: { headers: { origin: "http://localhost:3000" } } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  });
};

const testUser = { id: 1, name: "TestUser", email: "test@test.com", role: "user" as const };
const testUser2 = { id: 2, name: "Friend", email: "friend@test.com", role: "user" as const };

describe("Phase 18 — Usage Analytics, Low Credit Warning, Referral Credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Usage Analytics ──────────────────────────────────────────────────────
  describe("Usage Analytics — getUsageByTool", () => {
    it("should return tool usage breakdown for authenticated user", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { tool: "Used text-to-image", totalCredits: 10, usageCount: 10 },
                  { tool: "Used style-transfer", totalCredits: 6, usageCount: 3 },
                ]),
              }),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.usageAnalytics.getUsageByTool({ period: "30d" });
      expect(result).toBeDefined();
      expect(result).toHaveProperty("tools");
      expect(result).toHaveProperty("totalSpent");
      expect(result.totalSpent).toBe(16);
      expect(result.tools.length).toBe(2);
      expect(result.tools[0].tool).toBe("text-to-image");
    });

    it("should return empty data when no usage exists", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.usageAnalytics.getUsageByTool();
      expect(result.tools).toEqual([]);
      expect(result.totalSpent).toBe(0);
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.usageAnalytics.getUsageByTool()).rejects.toThrow();
    });

    it("should accept different period filters", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);

      const result7d = await caller.usageAnalytics.getUsageByTool({ period: "7d" });
      expect(result7d).toBeDefined();

      const result90d = await caller.usageAnalytics.getUsageByTool({ period: "90d" });
      expect(result90d).toBeDefined();

      const resultAll = await caller.usageAnalytics.getUsageByTool({ period: "all" });
      expect(resultAll).toBeDefined();
    });
  });

  describe("Usage Analytics — getSpendingTimeline", () => {
    it("should return daily spending timeline", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([
                  { period: "2026-03-01", spent: 5, count: 5 },
                  { period: "2026-03-02", spent: 8, count: 4 },
                ]),
              }),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.usageAnalytics.getSpendingTimeline({ period: "daily" });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty("period");
      expect(result[0]).toHaveProperty("spent");
    });

    it("should support weekly and monthly periods", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const weekly = await caller.usageAnalytics.getSpendingTimeline({ period: "weekly" });
      expect(weekly).toBeDefined();

      const monthly = await caller.usageAnalytics.getSpendingTimeline({ period: "monthly" });
      expect(monthly).toBeDefined();
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.usageAnalytics.getSpendingTimeline()).rejects.toThrow();
    });
  });

  describe("Usage Analytics — getSummary", () => {
    it("should return usage summary for authenticated user", async () => {
      const { getDb } = await import("./db");
      let selectCallCount = 0;
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount <= 3) {
            // Spent, purchased, bonus queries — return array directly from where
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 20, count: 10 }]),
              }),
            };
          } else if (selectCallCount === 4) {
            // Most used tool query — has groupBy/orderBy/limit
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([{ tool: "Used text-to-image", totalCredits: 20 }]),
                    }),
                  }),
                }),
              }),
            };
          } else {
            // Avg per day query
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 30 }]),
              }),
            };
          }
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.usageAnalytics.getSummary();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("totalSpent");
      expect(result).toHaveProperty("totalPurchased");
      expect(result).toHaveProperty("totalBonuses");
      expect(result).toHaveProperty("mostUsedTool");
      expect(result).toHaveProperty("avgPerDay");
      expect(result).toHaveProperty("transactionCount");
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.usageAnalytics.getSummary()).rejects.toThrow();
    });
  });

  // ─── Low Credit Warning ───────────────────────────────────────────────────
  describe("Enhanced Credits — Low Credit Warning", () => {
    it("should return isLow=true when balance is below threshold", async () => {
      (getOrCreateBalance as any).mockResolvedValue({ userId: 1, balance: 5, lifetimeSpent: 45 });

      const caller = createCaller(testUser);
      const result = await caller.enhancedCredits.getBalanceWithWarning();
      expect(result).toBeDefined();
      expect(result.balance).toBe(5);
      expect(result.isLow).toBe(true);
      expect(result.threshold).toBe(10);
    });

    it("should return isLow=false when balance is above threshold", async () => {
      (getOrCreateBalance as any).mockResolvedValue({ userId: 1, balance: 50, lifetimeSpent: 0 });

      const caller = createCaller(testUser);
      const result = await caller.enhancedCredits.getBalanceWithWarning();
      expect(result.balance).toBe(50);
      expect(result.isLow).toBe(false);
    });

    it("should return isLow=true when balance is exactly at threshold", async () => {
      (getOrCreateBalance as any).mockResolvedValue({ userId: 1, balance: 9, lifetimeSpent: 41 });

      const caller = createCaller(testUser);
      const result = await caller.enhancedCredits.getBalanceWithWarning();
      expect(result.isLow).toBe(true);
    });

    it("should return isLow=false when balance equals threshold", async () => {
      (getOrCreateBalance as any).mockResolvedValue({ userId: 1, balance: 10, lifetimeSpent: 40 });

      const caller = createCaller(testUser);
      const result = await caller.enhancedCredits.getBalanceWithWarning();
      expect(result.isLow).toBe(false);
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.enhancedCredits.getBalanceWithWarning()).rejects.toThrow();
    });
  });

  // ─── Referral System ──────────────────────────────────────────────────────
  describe("Referral System — getMyReferral", () => {
    it("should return referral code and stats for authenticated user", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ referralCode: "ABCD1234" }]),
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.referral.getMyReferral();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("code");
      expect(result).toHaveProperty("referrals");
      expect(result).toHaveProperty("stats");
      expect(result.code).toBe("ABCD1234");
      expect(result.stats.totalReferrals).toBe(0);
    });

    it("should generate code if user doesn't have one", async () => {
      const { getDb } = await import("./db");
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ referralCode: null }]),
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        update: mockUpdate,
      });

      const caller = createCaller(testUser);
      const result = await caller.referral.getMyReferral();
      expect(result).toBeDefined();
      expect(result.code).toBeTruthy();
      expect(typeof result.code).toBe("string");
      expect(result.code!.length).toBe(8);
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.referral.getMyReferral()).rejects.toThrow();
    });
  });

  describe("Referral System — applyCode", () => {
    it("should reject invalid referral code", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      await expect(caller.referral.applyCode({ code: "INVALID" })).rejects.toThrow("Invalid referral code");
    });

    it("should reject self-referral", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 1, name: "TestUser", referralCode: "MYCODE" }]),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      await expect(caller.referral.applyCode({ code: "MYCODE" })).rejects.toThrow("cannot use your own");
    });

    it("should reject duplicate referral", async () => {
      const { getDb } = await import("./db");
      let selectCallCount = 0;
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                  // Find referrer
                  return Promise.resolve([{ id: 2, name: "Friend", referralCode: "FRIEND" }]);
                }
                // Check existing referral — already referred
                return Promise.resolve([{ id: 1, referrerId: 3, referredUserId: 1 }]);
              }),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      await expect(caller.referral.applyCode({ code: "FRIEND" })).rejects.toThrow("already used a referral");
    });

    it("should successfully apply valid referral code", async () => {
      const { getDb } = await import("./db");
      let selectCallCount = 0;
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                  // Find referrer
                  return Promise.resolve([{ id: 2, name: "Friend", referralCode: "FRIEND" }]);
                }
                // No existing referral
                return Promise.resolve([]);
              }),
            }),
          }),
        }),
        insert: mockInsert,
      });
      (addCredits as any).mockResolvedValue(undefined);

      const caller = createCaller(testUser);
      const result = await caller.referral.applyCode({ code: "FRIEND" });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.creditsEarned).toBe(15);
      expect(addCredits).toHaveBeenCalledTimes(2); // referrer + referred
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.referral.applyCode({ code: "TEST" })).rejects.toThrow();
    });

    it("should reject empty code", async () => {
      const caller = createCaller(testUser);
      await expect(caller.referral.applyCode({ code: "" })).rejects.toThrow();
    });
  });

  describe("Referral System — getConstants", () => {
    it("should return referral bonus constants (public)", async () => {
      const caller = createCaller();
      const result = await caller.referral.getConstants();
      expect(result).toBeDefined();
      expect(result.referrerBonus).toBe(25);
      expect(result.referredBonus).toBe(15);
      expect(result.lowCreditThreshold).toBe(10);
    });

    it("should be accessible without authentication", async () => {
      const caller = createCaller();
      const result = await caller.referral.getConstants();
      expect(result).toBeDefined();
      expect(typeof result.referrerBonus).toBe("number");
    });
  });

  // ─── Integration Tests ────────────────────────────────────────────────────
  describe("Integration — Credit System Coherence", () => {
    it("credit packages should still be accessible", async () => {
      const caller = createCaller();
      const packages = await caller.credits.getPackages();
      expect(packages).toBeDefined();
      expect(packages.length).toBeGreaterThan(0);
    });

    it("credit costs should still be accessible", async () => {
      const caller = createCaller();
      const costs = await caller.credits.getCosts();
      expect(costs).toBeDefined();
      expect(costs["text-to-image"]).toBeDefined();
    });

    it("enhanced balance should include all fields", async () => {
      (getOrCreateBalance as any).mockResolvedValue({ userId: 1, balance: 25, lifetimeSpent: 25 });

      const caller = createCaller(testUser);
      const result = await caller.enhancedCredits.getBalanceWithWarning();
      expect(result).toHaveProperty("balance");
      expect(result).toHaveProperty("lifetimeSpent");
      expect(result).toHaveProperty("isLow");
      expect(result).toHaveProperty("threshold");
      expect(typeof result.balance).toBe("number");
      expect(typeof result.isLow).toBe("boolean");
    });
  });
});
