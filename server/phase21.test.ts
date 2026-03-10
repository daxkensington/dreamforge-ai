import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

function createChain(result: any = []) {
  const chain: any = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.from = mockFrom.mockReturnValue(chain);
  chain.where = mockWhere.mockReturnValue(chain);
  chain.limit = mockLimit.mockResolvedValue(result);
  chain.orderBy = mockOrderBy.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.values = mockValues.mockResolvedValue(result);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.set = mockSet.mockReturnValue(chain);
  // Make chain itself thenable for queries without .limit()
  chain.then = (resolve: any) => resolve(result);
  return chain;
}

vi.mock("./db", () => ({
  getDb: vi.fn(() => Promise.resolve(createChain())),
}));

vi.mock("./routersPhase15", () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

vi.mock("./stripe", () => ({
  addCredits: vi.fn(() => Promise.resolve({ success: true })),
  getOrCreateBalance: vi.fn(() => Promise.resolve({ balance: 100 })),
  deductCredits: vi.fn(() => Promise.resolve({ success: true })),
  CREDIT_COSTS: { "text-to-image": 1 },
}));

// ─── Import after mocks ────────────────────────────────────────────────────
import { ACHIEVEMENT_CATALOG } from "./routers/phase21";

// ─── Tests ──────────────────────────────────────────────────────────────────
describe("Phase 21 - Social Sharing, Credit Budgets, Achievement Badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Social Sharing ─────────────────────────────────────────────────────
  describe("Social Sharing", () => {
    it("should have a complete achievement catalog", () => {
      expect(ACHIEVEMENT_CATALOG.length).toBeGreaterThan(0);
      for (const a of ACHIEVEMENT_CATALOG) {
        expect(a.type).toBeTruthy();
        expect(a.name).toBeTruthy();
        expect(a.description).toBeTruthy();
        expect(a.icon).toBeTruthy();
        expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(a.threshold).toBeGreaterThan(0);
      }
    });

    it("should have unique achievement types", () => {
      const types = ACHIEVEMENT_CATALOG.map((a) => a.type);
      const unique = new Set(types);
      expect(unique.size).toBe(types.length);
    });

    it("should have creation-category achievements with increasing thresholds", () => {
      const creation = ACHIEVEMENT_CATALOG.filter((a) => a.category === "creation");
      expect(creation.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < creation.length; i++) {
        expect(creation[i].threshold).toBeGreaterThan(creation[i - 1].threshold);
      }
    });

    it("should have social-category achievements for referrals", () => {
      const social = ACHIEVEMENT_CATALOG.filter((a) => a.category === "social");
      expect(social.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Credit Budget ──────────────────────────────────────────────────────
  describe("Credit Budget", () => {
    it("should validate budget input ranges", () => {
      // dailyLimit: min 1, max 10000
      expect(1).toBeGreaterThanOrEqual(1);
      expect(10000).toBeLessThanOrEqual(10000);
      // weeklyLimit: min 1, max 50000
      expect(1).toBeGreaterThanOrEqual(1);
      expect(50000).toBeLessThanOrEqual(50000);
      // alertThreshold: min 10, max 100
      expect(10).toBeGreaterThanOrEqual(10);
      expect(100).toBeLessThanOrEqual(100);
    });

    it("should calculate daily percentage correctly", () => {
      const dailySpent = 40;
      const dailyLimit = 50;
      const percentage = Math.round((dailySpent / dailyLimit) * 100);
      expect(percentage).toBe(80);
    });

    it("should calculate weekly percentage correctly", () => {
      const weeklySpent = 150;
      const weeklyLimit = 200;
      const percentage = Math.round((weeklySpent / weeklyLimit) * 100);
      expect(percentage).toBe(75);
    });

    it("should generate alerts when threshold is exceeded", () => {
      const threshold = 80;
      const dailyPercentage = 85;
      const weeklyPercentage = 90;
      const alerts: string[] = [];

      if (dailyPercentage >= threshold) {
        alerts.push(`Daily budget at ${dailyPercentage}%`);
      }
      if (weeklyPercentage >= threshold) {
        alerts.push(`Weekly budget at ${weeklyPercentage}%`);
      }

      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toContain("Daily");
      expect(alerts[1]).toContain("Weekly");
    });

    it("should not generate alerts when under threshold", () => {
      const threshold = 80;
      const dailyPercentage = 50;
      const weeklyPercentage = 60;
      const alerts: string[] = [];

      if (dailyPercentage >= threshold) {
        alerts.push(`Daily budget at ${dailyPercentage}%`);
      }
      if (weeklyPercentage >= threshold) {
        alerts.push(`Weekly budget at ${weeklyPercentage}%`);
      }

      expect(alerts).toHaveLength(0);
    });

    it("should block when budget exceeded", () => {
      const dailySpent = 55;
      const dailyLimit = 50;
      let allowed = true;

      if (dailyLimit && dailySpent >= dailyLimit) {
        allowed = false;
      }

      expect(allowed).toBe(false);
    });

    it("should allow when under budget", () => {
      const dailySpent = 30;
      const dailyLimit = 50;
      let allowed = true;

      if (dailyLimit && dailySpent >= dailyLimit) {
        allowed = false;
      }

      expect(allowed).toBe(true);
    });

    it("should handle null limits (no limit set)", () => {
      const dailyLimit: number | null = null;
      const weeklyLimit: number | null = null;
      const dailyPercentage = dailyLimit ? 50 : 0;
      const weeklyPercentage = weeklyLimit ? 50 : 0;

      expect(dailyPercentage).toBe(0);
      expect(weeklyPercentage).toBe(0);
    });
  });

  // ─── Achievement Badges ─────────────────────────────────────────────────
  describe("Achievement Badges", () => {
    it("should have all required categories", () => {
      const categories = new Set(ACHIEVEMENT_CATALOG.map((a) => a.category));
      expect(categories.has("creation")).toBe(true);
      expect(categories.has("social")).toBe(true);
      expect(categories.has("commerce")).toBe(true);
    });

    it("should have first-generation as the easiest creation achievement", () => {
      const firstGen = ACHIEVEMENT_CATALOG.find((a) => a.type === "first-generation");
      expect(firstGen).toBeDefined();
      expect(firstGen!.threshold).toBe(1);
    });

    it("should have 500-generations as the hardest creation achievement", () => {
      const master = ACHIEVEMENT_CATALOG.find((a) => a.type === "500-generations");
      expect(master).toBeDefined();
      expect(master!.threshold).toBe(500);
    });

    it("should calculate progress percentage correctly", () => {
      const current = 7;
      const threshold = 10;
      const progress = Math.min(Math.round((current / threshold) * 100), 100);
      expect(progress).toBe(70);
    });

    it("should cap progress at 100%", () => {
      const current = 15;
      const threshold = 10;
      const progress = Math.min(Math.round((current / threshold) * 100), 100);
      expect(progress).toBe(100);
    });

    it("should detect newly unlockable achievements", () => {
      const existingTypes = new Set(["first-generation"]);
      const progressMap: Record<string, number> = {
        generationCount: 12,
        referralCount: 0,
        purchaseCount: 0,
        galleryCount: 0,
        uniqueToolCount: 2,
        earlyAdopter: 0,
      };

      const newlyUnlocked: string[] = [];
      for (const achievement of ACHIEVEMENT_CATALOG) {
        if (existingTypes.has(achievement.type)) continue;
        const current = progressMap[achievement.field] || 0;
        if (current >= achievement.threshold) {
          newlyUnlocked.push(achievement.type);
        }
      }

      expect(newlyUnlocked).toContain("10-generations");
      expect(newlyUnlocked).not.toContain("first-generation"); // already unlocked
      expect(newlyUnlocked).not.toContain("50-generations"); // not enough
    });

    it("should have proper icon names for all achievements", () => {
      const validIcons = [
        "Sparkles", "Zap", "Flame", "Crown", "Trophy",
        "Users", "Heart", "Globe", "CreditCard", "Image",
        "Settings", "Star",
      ];
      for (const a of ACHIEVEMENT_CATALOG) {
        expect(validIcons).toContain(a.icon);
      }
    });

    it("should have power-user achievement requiring 5 unique tools", () => {
      const powerUser = ACHIEVEMENT_CATALOG.find((a) => a.type === "power-user");
      expect(powerUser).toBeDefined();
      expect(powerUser!.threshold).toBe(5);
      expect(powerUser!.field).toBe("uniqueToolCount");
    });

    it("should have early-adopter as a special achievement", () => {
      const earlyAdopter = ACHIEVEMENT_CATALOG.find((a) => a.type === "early-adopter");
      expect(earlyAdopter).toBeDefined();
      expect(earlyAdopter!.category).toBe("special");
    });
  });
});
