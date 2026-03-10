import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
}));

// Mock stripe module
vi.mock("./stripe", () => ({
  getOrCreateBalance: vi.fn().mockResolvedValue({ balance: 100, lifetimeSpent: 50 }),
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
import { addCredits, getOrCreateBalance } from "./stripe";

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
const adminUser = { id: 99, name: "Admin", email: "admin@test.com", role: "admin" as const };

describe("Phase 19 — Auto-Apply Referral, Tiered Rewards, Usage Digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Auto-Apply Referral ─────────────────────────────────────────────────
  describe("Auto-Apply Referral — autoReferral.autoApply", () => {
    it("should successfully auto-apply a valid referral code", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 2, name: "Referrer", referralCode: "ABC12345" },
              ]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };

      // First call: find referrer by code
      // Second call: check existing referral (empty)
      // Third call: count completed referrals (for tier check)
      let selectCallCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Find referrer by code
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: 2, name: "Referrer", referralCode: "ABC12345" },
                ]),
              }),
            }),
          };
        }
        if (selectCallCount === 2) {
          // Check existing referral for this user
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        // Count completed referrals for tier check
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 1 }]),
          }),
        };
      });

      (getDb as any).mockResolvedValue(mockDb);
      (addCredits as any).mockResolvedValue(undefined);

      const caller = createCaller(testUser);
      const result = await caller.autoReferral.autoApply({ code: "ABC12345" });

      expect(result.success).toBe(true);
      expect(result.creditsEarned).toBe(15);
      expect(result.message).toContain("15 bonus credits");
      expect(addCredits).toHaveBeenCalledTimes(2); // referrer + referred
    });

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
      const result = await caller.autoReferral.autoApply({ code: "INVALID" });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("invalid_code");
    });

    it("should reject self-referral", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: 1, name: "TestUser", referralCode: "MYCODE01" },
              ]),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.autoReferral.autoApply({ code: "MYCODE01" });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("self_referral");
    });

    it("should reject if user already referred", async () => {
      const { getDb } = await import("./db");

      let selectCallCount = 0;
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { id: 2, name: "Referrer", referralCode: "ABC12345" },
                  ]),
                }),
              }),
            };
          }
          // Already has a referral
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 99 }]),
              }),
            }),
          };
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.autoReferral.autoApply({ code: "ABC12345" });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("already_referred");
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.autoReferral.autoApply({ code: "ABC12345" })).rejects.toThrow();
    });
  });

  // ─── Tiered Referral Rewards ─────────────────────────────────────────────
  describe("Tiered Referral — getTierProgress", () => {
    it("should return tier progress for authenticated user", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 5 }]),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.tieredReferral.getTierProgress();

      expect(result).toBeDefined();
      expect(result.totalReferrals).toBe(5);
      expect(result.tiers).toHaveLength(5);
      // 5 referrals: past Bronze (3), not yet Silver (7)
      expect(result.currentTier?.name).toBe("Bronze");
      expect(result.nextTier?.name).toBe("Silver");
    });

    it("should return null currentTier when no referrals", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.tieredReferral.getTierProgress();

      expect(result.totalReferrals).toBe(0);
      expect(result.currentTier).toBeNull();
      expect(result.nextTier?.name).toBe("Bronze");
      expect(result.tierBonusesEarned).toBe(0);
    });

    it("should calculate tier bonuses earned correctly", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 20 }]),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.tieredReferral.getTierProgress();

      // 20 referrals: Bronze (3, +30) + Silver (7, +50) + Gold (15, +100) = 180
      expect(result.currentTier?.name).toBe("Gold");
      expect(result.nextTier?.name).toBe("Platinum");
      expect(result.tierBonusesEarned).toBe(180);
    });

    it("should show Diamond as max tier with no next tier", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 60 }]),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.tieredReferral.getTierProgress();

      expect(result.currentTier?.name).toBe("Diamond");
      expect(result.nextTier).toBeNull();
      // All tiers: 30 + 50 + 100 + 200 + 500 = 880
      expect(result.tierBonusesEarned).toBe(880);
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.tieredReferral.getTierProgress()).rejects.toThrow();
    });
  });

  describe("Tiered Referral — getTiers (public)", () => {
    it("should return all tier definitions without auth", async () => {
      const caller = createCaller();
      const result = await caller.tieredReferral.getTiers();

      expect(result.tiers).toHaveLength(5);
      expect(result.tiers[0].name).toBe("Bronze");
      expect(result.tiers[4].name).toBe("Diamond");
    });
  });

  // ─── Usage Digest ────────────────────────────────────────────────────────
  describe("Usage Digest — getPreferences", () => {
    it("should return digest preferences for authenticated user", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { digestEnabled: true, digestFrequency: "weekly", lastDigestSentAt: null },
              ]),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.digest.getPreferences();

      expect(result.enabled).toBe(true);
      expect(result.frequency).toBe("weekly");
    });

    it("should return defaults when user has no preferences set", async () => {
      const { getDb } = await import("./db");
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { digestEnabled: null, digestFrequency: null, lastDigestSentAt: null },
              ]),
            }),
          }),
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.digest.getPreferences();

      expect(result.enabled).toBe(false);
      expect(result.frequency).toBe("weekly");
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.digest.getPreferences()).rejects.toThrow();
    });
  });

  describe("Usage Digest — updatePreferences", () => {
    it("should update digest preferences", async () => {
      const { getDb } = await import("./db");
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      (getDb as any).mockResolvedValue({
        update: mockUpdate,
      });

      const caller = createCaller(testUser);
      const result = await caller.digest.updatePreferences({
        enabled: true,
        frequency: "monthly",
      });

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("should validate frequency enum", async () => {
      const caller = createCaller(testUser);
      await expect(
        caller.digest.updatePreferences({
          enabled: true,
          frequency: "daily" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("Usage Digest — generatePreview", () => {
    it("should generate a digest preview with usage data", async () => {
      const { getDb } = await import("./db");

      let selectCallCount = 0;
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Current period spending
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 50, count: 20 }]),
              }),
            };
          }
          if (selectCallCount === 2) {
            // Previous period spending
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 40, count: 15 }]),
              }),
            };
          }
          if (selectCallCount === 3) {
            // Current period purchases
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 100 }]),
              }),
            };
          }
          if (selectCallCount === 4) {
            // Top tools
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([
                        { tool: "Used text-to-image", totalCredits: 30, usageCount: 15 },
                        { tool: "Used style-transfer", totalCredits: 20, usageCount: 5 },
                      ]),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      });

      (getOrCreateBalance as any).mockResolvedValue({ balance: 75 });

      const caller = createCaller(testUser);
      const result = await caller.digest.generatePreview({ period: "weekly" });

      expect(result).toBeDefined();
      expect(result!.totalSpent).toBe(50);
      expect(result!.totalGenerations).toBe(20);
      expect(result!.currentBalance).toBe(75);
      expect(result!.topTools.length).toBe(2);
      expect(result!.comparedToPrevious.spentChange).toBe(25); // (50-40)/40 * 100 = 25%
    });

    it("should return null when no usage data exists", async () => {
      const { getDb } = await import("./db");

      (getDb as any).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      // Override for the count queries
      let callCount = 0;
      (getDb as any).mockResolvedValue({
        select: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 3) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 0, count: 0 }]),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        }),
      });

      const caller = createCaller(testUser);
      const result = await caller.digest.generatePreview({ period: "weekly" });

      expect(result).toBeNull();
    });
  });

  describe("Usage Digest — sendNow", () => {
    it("should send a digest notification to the user", async () => {
      const { getDb } = await import("./db");

      let selectCallCount = 0;
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      (getDb as any).mockResolvedValue({
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Get user preferences
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([
                    { digestFrequency: "weekly", name: "TestUser" },
                  ]),
                }),
              }),
            };
          }
          if (selectCallCount === 2) {
            // Current period spending
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 30, count: 10 }]),
              }),
            };
          }
          if (selectCallCount === 3) {
            // Previous period
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 25, count: 8 }]),
              }),
            };
          }
          if (selectCallCount === 4) {
            // Purchases
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 50 }]),
              }),
            };
          }
          if (selectCallCount === 5) {
            // Top tools
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([
                        { tool: "Used text-to-image", totalCredits: 20, usageCount: 8 },
                      ]),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
        update: mockUpdate,
      });

      (getOrCreateBalance as any).mockResolvedValue({ balance: 70 });

      const caller = createCaller(testUser);
      const result = await caller.digest.sendNow();

      expect(result.success).toBe(true);
      expect(result.message).toContain("Digest sent");
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.digest.sendNow()).rejects.toThrow();
    });
  });

  describe("Usage Digest — sendScheduledDigests (admin only)", () => {
    it("should reject non-admin users", async () => {
      const caller = createCaller(testUser);
      await expect(caller.digest.sendScheduledDigests()).rejects.toThrow("Admin only");
    });

    it("should process eligible users for admin", async () => {
      const { getDb } = await import("./db");

      let selectCallCount = 0;
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      (getDb as any).mockResolvedValue({
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Get eligible users
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([
                  { id: 1, name: "User1", digestFrequency: "weekly", lastDigestSentAt: null },
                ]),
              }),
            };
          }
          if (selectCallCount === 2) {
            // Current period spending for user
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 20, count: 5 }]),
              }),
            };
          }
          if (selectCallCount === 3) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 15, count: 4 }]),
              }),
            };
          }
          if (selectCallCount === 4) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 50 }]),
              }),
            };
          }
          if (selectCallCount === 5) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockResolvedValue([
                        { tool: "Used text-to-image", totalCredits: 15, usageCount: 4 },
                      ]),
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
        update: mockUpdate,
      });

      (getOrCreateBalance as any).mockResolvedValue({ balance: 80 });

      const caller = createCaller(adminUser);
      const result = await caller.digest.sendScheduledDigests();

      expect(result.success).toBe(true);
      expect(result.totalEligible).toBe(1);
    });
  });
});
