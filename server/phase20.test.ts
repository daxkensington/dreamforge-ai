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
  deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 95, needed: 5 }),
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
import { getOrCreateBalance, deductCredits } from "./stripe";
import { anonymizeName, EXPIRATION_DAYS_BONUS, EXPIRATION_WARNING_DAYS } from "./routers/phase20";

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
const adminUser = { id: 99, name: "Admin", email: "admin@test.com", role: "admin" as const };

describe("Phase 20 — Leaderboard, Credit Expiration, Email Digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Leaderboard ──────────────────────────────────────────────────────────
  describe("Referral Leaderboard — leaderboard.getLeaderboard", () => {
    it("should return leaderboard entries with anonymized names", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([
                      { userId: 1, referralCount: 15, userName: "Alice" },
                      { userId: 2, referralCount: 8, userName: "Bob" },
                      { userId: 3, referralCount: 3, userName: "Charlie" },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller();
      const result = await caller.leaderboard.getLeaderboard({ limit: 20 });

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].displayName).toBe("Al***");
      expect(result.entries[0].referralCount).toBe(15);
      expect(result.entries[0].tier).toBeTruthy();
      expect(result.entries[0].tier?.name).toBe("Gold");
      expect(result.entries[1].displayName).toBe("Bo***");
      expect(result.entries[1].tier?.name).toBe("Silver");
      expect(result.entries[2].displayName).toBe("Ch***");
      expect(result.entries[2].tier?.name).toBe("Bronze");
    });

    it("should return empty leaderboard when no referrals exist", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller();
      const result = await caller.leaderboard.getLeaderboard({ limit: 10 });

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Leaderboard — leaderboard.getMyRank", () => {
    it("should return user's rank when they have referrals", async () => {
      const { getDb } = await import("./db");

      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // User's referral count: db.select({total}).from(referrals).where(...)
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 5 }]),
              }),
            };
          }
          // All referrers: db.select({}).from(referrals).where().groupBy().orderBy()
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                groupBy: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([
                    { referrerId: 10, cnt: 20 },
                    { referrerId: 11, cnt: 12 },
                    { referrerId: 1, cnt: 5 },
                    { referrerId: 12, cnt: 3 },
                  ]),
                }),
              }),
            }),
          };
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.leaderboard.getMyRank();

      expect(result.rank).toBe(3); // 2 users above (20 and 12 > 5)
      expect(result.referralCount).toBe(5);
      expect(result.totalParticipants).toBe(4);
    });

    it("should return null rank when user has no referrals", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.leaderboard.getMyRank();

      expect(result.rank).toBeNull();
      expect(result.referralCount).toBe(0);
    });
  });

  // ─── Name Anonymization ───────────────────────────────────────────────────
  describe("anonymizeName helper", () => {
    it("should anonymize names correctly", () => {
      expect(anonymizeName("Alice")).toBe("Al***");
      expect(anonymizeName("Bob")).toBe("Bo***");
      expect(anonymizeName("A")).toBe("An***");
      expect(anonymizeName(null)).toBe("An***");
      expect(anonymizeName("")).toBe("An***");
    });
  });

  // ─── Credit Expiration ────────────────────────────────────────────────────
  describe("Credit Expiration — creditExpiration.getExpiringCredits", () => {
    it("should return credits expiring within warning period", async () => {
      const { getDb } = await import("./db");

      const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: 1,
                  amount: 25,
                  description: "Referral bonus",
                  expiresAt: futureDate,
                  createdAt: new Date(),
                },
              ]),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.creditExpiration.getExpiringCredits();

      expect(result.expiringCredits).toHaveLength(1);
      expect(result.expiringCredits[0].amount).toBe(25);
      expect(result.expiringCredits[0].daysLeft).toBeGreaterThanOrEqual(2);
      expect(result.expiringCredits[0].daysLeft).toBeLessThanOrEqual(4);
      expect(result.totalExpiring).toBe(25);
    });

    it("should return empty when no credits are expiring", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.creditExpiration.getExpiringCredits();

      expect(result.expiringCredits).toHaveLength(0);
      expect(result.totalExpiring).toBe(0);
      expect(result.nextExpiration).toBeNull();
    });
  });

  describe("Credit Expiration — creditExpiration.getExpirationSummary", () => {
    it("should return summary with expiring credits", async () => {
      const { getDb } = await import("./db");

      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      let selectCallCount = 0;
      const mockDb = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // Expiring soon
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ total: 30, count: 2 }]),
              }),
            };
          }
          // Next expiration
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ expiresAt: futureDate }]),
                }),
              }),
            }),
          };
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.creditExpiration.getExpirationSummary();

      expect(result.hasExpiringCredits).toBe(true);
      expect(result.totalExpiringSoon).toBe(30);
      expect(result.daysUntilNextExpiration).toBeGreaterThanOrEqual(4);
      expect(result.daysUntilNextExpiration).toBeLessThanOrEqual(6);
    });
  });

  describe("Credit Expiration — creditExpiration.processExpired (admin)", () => {
    it("should reject non-admin users", async () => {
      const caller = createCaller(testUser);
      await expect(caller.creditExpiration.processExpired()).rejects.toThrow("Admin only");
    });

    it("should process expired credits for admin", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 1, userId: 1, amount: 15, description: "Referral bonus" },
            ]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);
      (getOrCreateBalance as any).mockResolvedValue({ balance: 20 });
      (deductCredits as any).mockResolvedValue({ success: true, balance: 5, needed: 15 });

      const caller = createCaller(adminUser);
      const result = await caller.creditExpiration.processExpired();

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.totalExpired).toBe(1);
    });
  });

  // ─── Expiration Constants ─────────────────────────────────────────────────
  describe("Expiration constants", () => {
    it("should have correct expiration values", () => {
      expect(EXPIRATION_DAYS_BONUS).toBe(90);
      expect(EXPIRATION_WARNING_DAYS).toBe(7);
    });
  });

  // ─── Email Digest ─────────────────────────────────────────────────────────
  describe("Email Digest — emailDigest.getEmailPreferences", () => {
    it("should return email digest preferences", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { emailDigestEnabled: true, email: "test@test.com" },
              ]),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.emailDigest.getEmailPreferences();

      expect(result.emailEnabled).toBe(true);
      expect(result.email).toBe("test@test.com");
    });

    it("should return defaults when user has no preferences", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.emailDigest.getEmailPreferences();

      expect(result.emailEnabled).toBe(false);
      expect(result.email).toBeNull();
    });
  });

  describe("Email Digest — emailDigest.updateEmailPreferences", () => {
    it("should update email digest preferences", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.emailDigest.updateEmailPreferences({ emailEnabled: true });

      expect(result.success).toBe(true);
    });
  });

  describe("Email Digest — emailDigest.sendTestEmail", () => {
    it("should return failure when user has no email", async () => {
      const { getDb } = await import("./db");

      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { email: null, name: "Test", digestFrequency: "weekly" },
              ]),
            }),
          }),
        }),
      };

      (getDb as any).mockResolvedValue(mockDb);

      const caller = createCaller(testUser);
      const result = await caller.emailDigest.sendTestEmail();

      expect(result.success).toBe(false);
      expect(result.message).toContain("No email");
    });
  });

  describe("Email Digest — emailDigest.sendScheduledEmailDigests (admin)", () => {
    it("should reject non-admin users", async () => {
      const caller = createCaller(testUser);
      await expect(caller.emailDigest.sendScheduledEmailDigests()).rejects.toThrow("Admin only");
    });
  });
});
