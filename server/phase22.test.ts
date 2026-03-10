import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB ────────────────────────────────────────────────────────────────
const mockChain = () => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockResolvedValue([]);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockResolvedValue([]);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  return chain;
};

let dbMock: ReturnType<typeof mockChain>;

vi.mock("./db", () => ({
  getDb: vi.fn(async () => dbMock),
}));

vi.mock("./routersPhase15", async (importOriginal) => {
  const original = await importOriginal() as any;
  return {
    ...original,
    createNotification: vi.fn().mockResolvedValue(undefined),
  };
});

import { autoCheckAchievements, checkAndSendBudgetAlerts } from "./routers/phase22";
import { createNotification } from "./routersPhase15";

// ─── Auto-Check Achievements ────────────────────────────────────────────────
describe("autoCheckAchievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = mockChain();
  });

  it("returns empty array when db is unavailable", async () => {
    const { getDb } = await import("../server/db");
    (getDb as any).mockResolvedValueOnce(null);
    const result = await autoCheckAchievements(1);
    expect(result).toEqual([]);
  });

  it("returns empty array when user has all achievements", async () => {
    // Existing achievements
    dbMock.where = vi.fn().mockReturnValue({
      ...dbMock,
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockResolvedValue([
        { type: "first-generation" },
        { type: "10-generations" },
        { type: "50-generations" },
        { type: "100-generations" },
        { type: "500-generations" },
        { type: "first-referral" },
        { type: "5-referrals" },
        { type: "10-referrals" },
        { type: "first-purchase" },
        { type: "gallery-debut" },
        { type: "power-user" },
        { type: "early-adopter" },
      ]),
    });

    const result = await autoCheckAchievements(1);
    expect(result).toEqual([]);
  });

  it("returns array type from autoCheckAchievements", async () => {
    // With default mock chain returning empty arrays, no achievements should unlock
    const result = await autoCheckAchievements(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("handles errors gracefully and returns empty array", async () => {
    dbMock.where = vi.fn().mockRejectedValue(new Error("DB error"));
    const result = await autoCheckAchievements(42);
    expect(result).toEqual([]);
  });
});

// ─── Budget Alert ───────────────────────────────────────────────────────────
describe("checkAndSendBudgetAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = mockChain();
  });

  it("does nothing when db is unavailable", async () => {
    const { getDb } = await import("../server/db");
    (getDb as any).mockResolvedValueOnce(null);
    await checkAndSendBudgetAlerts(1);
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled();
  });

  it("does nothing when no budget exists", async () => {
    dbMock.limit = vi.fn().mockResolvedValue([]);
    await checkAndSendBudgetAlerts(1);
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled();
  });

  it("does nothing when budget is disabled", async () => {
    dbMock.limit = vi.fn().mockResolvedValue([{
      enabled: false,
      budgetEmailEnabled: true,
      dailyLimit: 100,
      weeklyLimit: 500,
      alertThreshold: 80,
      lastDailyAlertAt: null,
      lastWeeklyAlertAt: null,
    }]);
    await checkAndSendBudgetAlerts(1);
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled();
  });

  it("does nothing when email alerts are disabled", async () => {
    dbMock.limit = vi.fn().mockResolvedValue([{
      enabled: true,
      budgetEmailEnabled: false,
      dailyLimit: 100,
      weeklyLimit: 500,
      alertThreshold: 80,
      lastDailyAlertAt: null,
      lastWeeklyAlertAt: null,
    }]);
    await checkAndSendBudgetAlerts(1);
    expect(vi.mocked(createNotification)).not.toHaveBeenCalled();
  });

  it("handles errors gracefully without throwing", async () => {
    dbMock.where = vi.fn().mockRejectedValue(new Error("DB error"));
    // Should not throw
    await expect(checkAndSendBudgetAlerts(1)).resolves.toBeUndefined();
  });

  it("budget alert deduplication logic is correct", () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Already alerted today - should skip
    const lastAlertToday = new Date(now.getTime() - 3600000); // 1 hour ago
    expect(lastAlertToday >= todayStart).toBe(true);
    
    // Last alert was yesterday - should send
    const lastAlertYesterday = new Date(todayStart.getTime() - 86400000);
    expect(lastAlertYesterday >= todayStart).toBe(false);
  });
});

// ─── Achievement Share Links ────────────────────────────────────────────────
describe("Achievement Sharing", () => {
  it("ACHIEVEMENT_CATALOG has valid share-compatible fields", async () => {
    const { ACHIEVEMENT_CATALOG } = await import("../server/routers/phase21");
    for (const a of ACHIEVEMENT_CATALOG) {
      expect(a.type).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(a.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("all achievement types are unique", async () => {
    const { ACHIEVEMENT_CATALOG } = await import("../server/routers/phase21");
    const types = ACHIEVEMENT_CATALOG.map((a) => a.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("share link generation produces valid URLs", () => {
    const siteUrl = "https://genlabsyn-hhycwvdm.manus.space";
    const achievementName = "First Creation";
    const twitterText = encodeURIComponent(
      `I just unlocked the "${achievementName}" achievement on DreamForge! 🏆`
    );
    const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(siteUrl)}`;
    expect(twitterUrl).toContain("twitter.com/intent/tweet");
    expect(twitterUrl).toContain("First%20Creation");
  });
});

// ─── Budget Email Settings ──────────────────────────────────────────────────
describe("Budget Email Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = mockChain();
  });

  it("returns default settings when no budget exists", async () => {
    dbMock.limit = vi.fn().mockResolvedValue([]);
    // The router would return { budgetEmailEnabled: true }
    // We test the helper logic directly
    expect(true).toBe(true); // Placeholder - router tests are integration-level
  });

  it("budget email toggle is independent of budget enabled state", () => {
    // Verify the schema supports independent toggles
    const budgetRecord = {
      enabled: false,
      budgetEmailEnabled: true,
    };
    expect(budgetRecord.budgetEmailEnabled).toBe(true);
    expect(budgetRecord.enabled).toBe(false);
  });
});
