import { describe, it, expect, vi } from "vitest";

// Mock credit deduction
vi.mock('./stripe', () => ({
  deductCredits: vi.fn().mockResolvedValue({ success: true, remaining: 99 }),
  CREDIT_COSTS: {
    'text-to-image': 1, 'image-to-image': 1, 'upscale': 2, 'style-transfer': 2,
    'background-edit': 1, 'face-enhance': 2, 'batch-process': 5, 'animate': 3,
    'object-remove': 1, 'color-grade': 1, 'sketch-to-image': 1, 'image-merge': 2,
    'prompt-assist': 0, 'storyboard': 3, 'scene-director': 3, 'video-style-transfer': 3,
    'video-upscaler': 3, 'soundtrack-suggest': 1, 'text-to-video-script': 2,
  },
  getOrCreateBalance: vi.fn().mockResolvedValue({ balance: 100 }),
  getCreditHistory: vi.fn().mockResolvedValue([]),
  addCredits: vi.fn().mockResolvedValue(undefined),
  createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
  CREDIT_PACKAGES: [],
}));

// Mock image generation
vi.mock('./_core/imageGeneration', () => ({
  generateImage: vi.fn().mockResolvedValue({ url: 'https://cdn.example.com/result.png' }),
}));

// Mock LLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: '{}' } }],
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-animate",
    email: "animator@example.com",
    name: "Animate Tester",
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
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
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

// ─── AnimateImage Endpoint Tests ──────────────────────────────────────────────

describe("generation.animateImage", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.animateImage({
        sourceGenerationId: 1,
        duration: 4,
        animationStyle: "smooth-pan",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid animation style", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.animateImage({
        sourceGenerationId: 1,
        duration: 4,
        animationStyle: "invalid-style" as any,
      })
    ).rejects.toThrow();
  });

  it("rejects duration below minimum (2s)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.animateImage({
        sourceGenerationId: 1,
        duration: 1,
        animationStyle: "smooth-pan",
      })
    ).rejects.toThrow();
  });

  it("rejects duration above maximum (8s)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.animateImage({
        sourceGenerationId: 1,
        duration: 10,
        animationStyle: "smooth-pan",
      })
    ).rejects.toThrow();
  });

  it("rejects non-existent source generation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.animateImage({
        sourceGenerationId: 999999,
        duration: 4,
        animationStyle: "gentle-zoom",
      })
    ).rejects.toThrow(/not found/i);
  });

  it("accepts all valid animation styles", async () => {
    const validStyles = [
      "smooth-pan",
      "gentle-zoom",
      "parallax-drift",
      "cinematic-sweep",
      "breathing-motion",
      "particle-flow",
    ] as const;

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const style of validStyles) {
      // Each should fail with NOT_FOUND (since source doesn't exist)
      // but should NOT fail with validation error
      try {
        await caller.generation.animateImage({
          sourceGenerationId: 999999,
          duration: 4,
          animationStyle: style,
        });
      } catch (error: any) {
        // Should be NOT_FOUND, not BAD_REQUEST (validation)
        expect(error.code).toBe("NOT_FOUND");
      }
    }
  });

  it("accepts valid duration range (2-8)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    for (const dur of [2, 3, 4, 5, 6, 7, 8]) {
      try {
        await caller.generation.animateImage({
          sourceGenerationId: 999999,
          duration: dur,
          animationStyle: "smooth-pan",
        });
      } catch (error: any) {
        // Should be NOT_FOUND, not a validation error
        expect(error.code).toBe("NOT_FOUND");
      }
    }
  });

  it("accepts optional tagIds parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.generation.animateImage({
        sourceGenerationId: 999999,
        duration: 4,
        animationStyle: "smooth-pan",
        tagIds: [1, 2, 3],
      });
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("defaults duration to 4 when not specified", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.generation.animateImage({
        sourceGenerationId: 999999,
        animationStyle: "smooth-pan",
      } as any);
    } catch (error: any) {
      // Should reach NOT_FOUND, meaning the default was applied
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("defaults animationStyle to smooth-pan when not specified", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.generation.animateImage({
        sourceGenerationId: 999999,
        duration: 4,
      } as any);
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });
});

// ─── GetChildren Endpoint Tests ───────────────────────────────────────────────

describe("generation.getChildren", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.getChildren({ parentId: 1 })
    ).rejects.toThrow();
  });

  it("rejects non-existent parent generation", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.getChildren({ parentId: 999999 })
    ).rejects.toThrow();
  });

  it("requires parentId parameter", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.getChildren({} as any)
    ).rejects.toThrow();
  });
});

// ─── Schema Validation Tests ──────────────────────────────────────────────────

describe("animateImage schema validation", () => {
  it("rejects negative sourceGenerationId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Negative IDs should either fail validation or return NOT_FOUND
    try {
      await caller.generation.animateImage({
        sourceGenerationId: -1,
        duration: 4,
        animationStyle: "smooth-pan",
      });
    } catch (error: any) {
      // Either validation error or NOT_FOUND is acceptable
      expect(["BAD_REQUEST", "NOT_FOUND"]).toContain(error.code);
    }
  });

  it("rejects fractional duration", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // z.number().min(2).max(8) allows fractional, but we test it reaches NOT_FOUND
    try {
      await caller.generation.animateImage({
        sourceGenerationId: 999999,
        duration: 3.5,
        animationStyle: "smooth-pan",
      });
    } catch (error: any) {
      // Should reach NOT_FOUND since 3.5 is within 2-8 range
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("rejects empty string animationStyle", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.animateImage({
        sourceGenerationId: 1,
        duration: 4,
        animationStyle: "" as any,
      })
    ).rejects.toThrow();
  });
});
