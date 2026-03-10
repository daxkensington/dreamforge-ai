import { vi, describe, it, expect, beforeAll } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock the stripe module
vi.mock("./stripe", () => ({
  getOrCreateBalance: vi.fn().mockResolvedValue({ balance: 500, lifetimeSpent: 200 }),
  deductCredits: vi.fn().mockResolvedValue({ success: true, balance: 499, needed: 1 }),
  addCredits: vi.fn().mockResolvedValue({ success: true }),
  getCreditHistory: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, type: "purchase", amount: 500, description: "Bought Creator Pack", createdAt: new Date() },
    { id: 2, userId: 1, type: "usage", amount: -1, description: "Used image-generation", createdAt: new Date() },
  ]),
  createCheckoutSession: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session_test" }),
  CREDIT_PACKAGES: [
    { id: "starter", name: "Starter", credits: 100, price: 499, priceDisplay: "$4.99", perCredit: "$0.05", description: "100 credits", popular: false },
    { id: "creator", name: "Creator", credits: 500, price: 1999, priceDisplay: "$19.99", perCredit: "$0.04", description: "500 credits", popular: true },
  ],
  CREDIT_COSTS: {
    "image-generation": 1,
    "upscale": 2,
    "style-transfer": 1,
    "video-storyboard": 3,
  } as Record<string, number>,
}));

// Mock image generation
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/result.png" }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Mocked LLM response" } }],
  }),
}));

import { getOrCreateBalance, deductCredits, getCreditHistory, createCheckoutSession, CREDIT_PACKAGES, CREDIT_COSTS } from "./stripe";
import { appRouter } from "./routers";

const mockCtx = {
  user: {
    id: 1,
    openId: "test-user-123",
    name: "Test Creator",
    email: "test@dreamforge.ai",
    role: "user" as const,
    createdAt: new Date(),
  },
  req: { headers: { origin: "http://localhost:3000" } },
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const adminCtx = {
  user: {
    id: 99,
    openId: "admin-user-99",
    name: "Admin User",
    email: "admin@dreamforge.ai",
    role: "admin" as const,
    createdAt: new Date(),
  },
  req: { headers: { origin: "http://localhost:3000" } },
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const caller = appRouter.createCaller(mockCtx as any);
const adminCaller = appRouter.createCaller(adminCtx as any);

describe("Credits System", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  describe("credits.getBalance", () => {
    it("should return the user's credit balance", async () => {
      const result = await caller.credits.getBalance();
      expect(result).toHaveProperty("balance");
      expect(result).toHaveProperty("lifetimeSpent");
      expect(result.balance).toBe(500);
      expect(result.lifetimeSpent).toBe(200);
      expect(getOrCreateBalance).toHaveBeenCalledWith(1);
    });
  });

  describe("credits.getPackages", () => {
    it("should return available credit packages", async () => {
      const result = await caller.credits.getPackages();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("credits");
      expect(result[0]).toHaveProperty("priceDisplay");
    });
  });

  describe("credits.getCosts", () => {
    it("should return credit costs per tool", async () => {
      const result = await caller.credits.getCosts();
      expect(result).toHaveProperty("image-generation");
      expect(result).toHaveProperty("upscale");
      expect(typeof result["image-generation"]).toBe("number");
    });
  });

  describe("credits.getHistory", () => {
    it("should return transaction history", async () => {
      const result = await caller.credits.getHistory();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty("type");
      expect(result[0]).toHaveProperty("amount");
      expect(getCreditHistory).toHaveBeenCalledWith(1, 50);
    });

    it("should accept custom limit", async () => {
      await caller.credits.getHistory({ limit: 10 });
      expect(getCreditHistory).toHaveBeenCalledWith(1, 10);
    });
  });

  describe("credits.createCheckout", () => {
    it("should create a Stripe checkout session", async () => {
      const result = await caller.credits.createCheckout({
        packageId: "creator",
        origin: "http://localhost:3000",
      });
      expect(result).toHaveProperty("url");
      expect(result.url).toContain("stripe.com");
      expect(createCheckoutSession).toHaveBeenCalledWith(
        1,
        "test@dreamforge.ai",
        "Test Creator",
        "creator",
        "http://localhost:3000"
      );
    });
  });

  describe("credits.deduct", () => {
    it("should deduct credits for a tool usage", async () => {
      const result = await caller.credits.deduct({
        tool: "image-generation",
        description: "Generated an image",
      });
      expect(result.success).toBe(true);
      expect(deductCredits).toHaveBeenCalled();
    });

    it("should throw when insufficient credits", async () => {
      vi.mocked(deductCredits).mockResolvedValueOnce({
        success: false,
        balance: 0,
        needed: 1,
      });
      await expect(
        caller.credits.deduct({ tool: "upscale" })
      ).rejects.toThrow("Insufficient credits");
    });
  });
});

describe("Notifications System", () => {
  describe("notifications.list", () => {
    it("should return empty list when db is null", async () => {
      const result = await caller.notifications.list();
      expect(result).toHaveProperty("notifications");
      expect(result).toHaveProperty("unreadCount");
      expect(result.notifications).toEqual([]);
      expect(result.unreadCount).toBe(0);
    });

    it("should accept unreadOnly filter", async () => {
      const result = await caller.notifications.list({ unreadOnly: true });
      expect(result.notifications).toEqual([]);
    });
  });

  describe("notifications.getPreferences", () => {
    it("should return default preferences when db is null", async () => {
      const result = await caller.notifications.getPreferences();
      expect(Array.isArray(result)).toBe(true);
      // Returns empty because db is null
    });
  });

  describe("notifications.markAsRead", () => {
    it("should throw when db is null", async () => {
      await expect(
        caller.notifications.markAsRead({ id: 1 })
      ).rejects.toThrow();
    });
  });

  describe("notifications.markAllRead", () => {
    it("should throw when db is null", async () => {
      await expect(caller.notifications.markAllRead()).rejects.toThrow();
    });
  });

  describe("notifications.updatePreference", () => {
    it("should throw when db is null", async () => {
      await expect(
        caller.notifications.updatePreference({
          type: "collaboration",
          enabled: false,
        })
      ).rejects.toThrow();
    });
  });
});

describe("Admin Dashboard", () => {
  describe("admin.getPlatformStats", () => {
    it("should return zero stats when db is null", async () => {
      const result = await adminCaller.admin.getPlatformStats();
      expect(result).toEqual({
        totalUsers: 0,
        totalGenerations: 0,
        totalRevenue: 0,
        totalGalleryItems: 0,
      });
    });

    it("should reject non-admin users", async () => {
      await expect(caller.admin.getPlatformStats()).rejects.toThrow();
    });
  });

  describe("admin.listUsers", () => {
    it("should return empty list when db is null", async () => {
      const result = await adminCaller.admin.listUsers();
      expect(result).toEqual({ users: [], total: 0 });
    });

    it("should accept search parameter", async () => {
      const result = await adminCaller.admin.listUsers({ search: "test" });
      expect(result).toEqual({ users: [], total: 0 });
    });

    it("should reject non-admin users", async () => {
      await expect(caller.admin.listUsers()).rejects.toThrow();
    });
  });

  describe("admin.updateUserRole", () => {
    it("should reject non-admin users", async () => {
      await expect(
        caller.admin.updateUserRole({ userId: 2, role: "admin" })
      ).rejects.toThrow();
    });

    it("should throw when db is null", async () => {
      await expect(
        adminCaller.admin.updateUserRole({ userId: 2, role: "admin" })
      ).rejects.toThrow();
    });
  });

  describe("admin.listFlaggedContent", () => {
    it("should return empty list when db is null", async () => {
      const result = await adminCaller.admin.listFlaggedContent();
      expect(result).toEqual({ items: [], total: 0 });
    });

    it("should accept status filter", async () => {
      const result = await adminCaller.admin.listFlaggedContent({
        status: "pending",
      });
      expect(result).toEqual({ items: [], total: 0 });
    });

    it("should reject non-admin users", async () => {
      await expect(caller.admin.listFlaggedContent()).rejects.toThrow();
    });
  });

  describe("admin.reviewContent", () => {
    it("should reject non-admin users", async () => {
      await expect(
        caller.admin.reviewContent({ id: 1, status: "approved" })
      ).rejects.toThrow();
    });

    it("should throw when db is null", async () => {
      await expect(
        adminCaller.admin.reviewContent({ id: 1, status: "approved" })
      ).rejects.toThrow();
    });
  });

  describe("admin.getGenerationAnalytics", () => {
    it("should return empty array when db is null", async () => {
      const result = await adminCaller.admin.getGenerationAnalytics();
      expect(result).toEqual([]);
    });

    it("should accept period parameter", async () => {
      const result = await adminCaller.admin.getGenerationAnalytics({
        period: "weekly",
      });
      expect(result).toEqual([]);
    });

    it("should reject non-admin users", async () => {
      await expect(
        caller.admin.getGenerationAnalytics()
      ).rejects.toThrow();
    });
  });

  describe("admin.getRevenueAnalytics", () => {
    it("should return empty array when db is null", async () => {
      const result = await adminCaller.admin.getRevenueAnalytics();
      expect(result).toEqual([]);
    });

    it("should reject non-admin users", async () => {
      await expect(caller.admin.getRevenueAnalytics()).rejects.toThrow();
    });
  });

  describe("admin.sendSystemNotification", () => {
    it("should reject non-admin users", async () => {
      await expect(
        caller.admin.sendSystemNotification({
          title: "Test",
          message: "Test message",
        })
      ).rejects.toThrow();
    });
  });
});
