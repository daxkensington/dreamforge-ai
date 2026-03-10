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
  CREDIT_COSTS: { image_generation: 2, video_generation: 5, tool_usage: 1 },
  CREDIT_PACKAGES: [
    { id: "starter", name: "Starter", credits: 100, price: 499 },
    { id: "creator", name: "Creator", credits: 500, price: 1999 },
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

import { appRouter } from "./routers";
import { getOrCreateBalance } from "./stripe";

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

describe("Phase 17 — Navbar Credits, Webhook Logging, Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Credit Balance in Navbar", () => {
    it("should return credit balance for authenticated user", async () => {
      const caller = createCaller({ id: 1, name: "Test", email: "test@test.com", role: "user" });
      (getOrCreateBalance as any).mockResolvedValue({ userId: 1, balance: 150 });

      const result = await caller.credits.getBalance();
      expect(result).toBeDefined();
      expect(result.balance).toBe(150);
      expect(getOrCreateBalance).toHaveBeenCalledWith(1);
    });

    it("should return zero balance for new user", async () => {
      const caller = createCaller({ id: 2, name: "New", email: "new@test.com", role: "user" });
      (getOrCreateBalance as any).mockResolvedValue({ userId: 2, balance: 0 });

      const result = await caller.credits.getBalance();
      expect(result.balance).toBe(0);
    });

    it("should fail for unauthenticated user", async () => {
      const caller = createCaller();
      await expect(caller.credits.getBalance()).rejects.toThrow();
    });
  });

  describe("Webhook Event Logging", () => {
    it("admin should be able to list webhook events", async () => {
      const { getDb } = await import("./db");
      let callCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          // First call: items query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Second call: count query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
      });
      (getDb as any).mockResolvedValue({ select: mockSelect });

      const caller = createCaller({ id: 1, name: "Admin", email: "admin@test.com", role: "admin" });
      const result = await caller.admin.getWebhookEvents();
      expect(result).toBeDefined();
      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("total");
    });

    it("admin should be able to filter webhook events by status", async () => {
      const { getDb } = await import("./db");
      let callCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
      });
      (getDb as any).mockResolvedValue({ select: mockSelect });

      const caller = createCaller({ id: 1, name: "Admin", email: "admin@test.com", role: "admin" });
      const result = await caller.admin.getWebhookEvents({ status: "processed" });
      expect(result).toBeDefined();
      expect(result).toHaveProperty("events");
    });

    it("admin should be able to paginate webhook events", async () => {
      const { getDb } = await import("./db");
      let callCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          };
        } else {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 0 }]),
            }),
          };
        }
      });
      (getDb as any).mockResolvedValue({ select: mockSelect });

      const caller = createCaller({ id: 1, name: "Admin", email: "admin@test.com", role: "admin" });
      const result = await caller.admin.getWebhookEvents({ page: 2, limit: 10 });
      expect(result).toBeDefined();
    });

    it("non-admin should not access webhook events", async () => {
      const caller = createCaller({ id: 2, name: "User", email: "user@test.com", role: "user" });
      await expect(caller.admin.getWebhookEvents()).rejects.toThrow();
    });
  });

  describe("Credit Packages", () => {
    it("should list available credit packages (public)", async () => {
      const caller = createCaller();
      const result = await caller.credits.getPackages();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("credits");
      expect(result[0]).toHaveProperty("price");
    });
  });

  describe("Credit Costs", () => {
    it("should define costs for different generation types", async () => {
      const { CREDIT_COSTS } = await import("./stripe");
      expect(CREDIT_COSTS).toBeDefined();
      expect(CREDIT_COSTS.image_generation).toBeGreaterThan(0);
    });
  });
});
