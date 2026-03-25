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

// Mock DB so createGeneration doesn't throw "Database not available"
let genIdCounter = 1;
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
    createGeneration: vi.fn().mockImplementation(async () => ({ id: genIdCounter++ })),
    updateGeneration: vi.fn().mockResolvedValue(undefined),
    getUserUsageStats: vi.fn().mockResolvedValue(null),
    getUserActivityTimeline: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };
});

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
    openId: "test-user-batch",
    email: "creator@example.com",
    name: "Batch Tester",
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

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

// ─── Batch Generation ────────────────────────────────────────────────────────

describe("generation.batchCreate", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "test" }],
      })
    ).rejects.toThrow();
  });

  it("validates that prompts array is not empty", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [],
      })
    ).rejects.toThrow();
  });

  it("validates max 10 prompts", async () => {
    const { ctx } = createAuthContext();
    const tooMany = Array.from({ length: 11 }, (_, i) => ({
      prompt: `Prompt ${i + 1}`,
    }));
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: tooMany,
      })
    ).rejects.toThrow();
  });

  it("validates prompt text is required", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "" }],
      })
    ).rejects.toThrow();
  });

  it("validates prompt max length", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "x".repeat(2001) }],
      })
    ).rejects.toThrow();
  });

  it("accepts valid single prompt batch", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).generation.batchCreate({
      prompts: [{ prompt: "A beautiful sunset over mountains" }],
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].prompt).toBe("A beautiful sunset over mountains");
    expect(["completed", "failed"]).toContain(result.results[0].status);
  }, 30000);

  it("accepts valid multi-prompt batch", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).generation.batchCreate({
      prompts: [
        { prompt: "A red dragon in flight" },
        { prompt: "A blue ocean at sunset" },
        { prompt: "A green forest with fog" },
      ],
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(result.completed).toBeGreaterThanOrEqual(0);
    expect(result.completed).toBeLessThanOrEqual(3);
  }, 60000);

  it("accepts mixed media types in batch", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).generation.batchCreate({
      prompts: [
        { prompt: "A still image of a castle", mediaType: "image" },
        { prompt: "A flowing river animation", mediaType: "video" },
      ],
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);
  }, 60000);

  it("validates width and height bounds", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "test", width: 100 }],
      })
    ).rejects.toThrow();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "test", height: 2000 }],
      })
    ).rejects.toThrow();
  });

  it("validates duration bounds", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "test", mediaType: "video", duration: 1 }],
      })
    ).rejects.toThrow();
    await expect(
      caller(ctx).generation.batchCreate({
        prompts: [{ prompt: "test", mediaType: "video", duration: 10 }],
      })
    ).rejects.toThrow();
  });
});

// ─── Batch Tool Operations ───────────────────────────────────────────────────

describe("tools.batchProcess", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "upscale",
        images: ["https://example.com/img.png"],
      })
    ).rejects.toThrow();
  });

  it("validates that images array is not empty", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "upscale",
        images: [],
      })
    ).rejects.toThrow();
  });

  it("validates max 10 images", async () => {
    const { ctx } = createAuthContext();
    const tooMany = Array.from({ length: 11 }, (_, i) => `https://example.com/img${i}.png`);
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "upscale",
        images: tooMany,
      })
    ).rejects.toThrow();
  });

  it("validates image URLs are valid", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "upscale",
        images: ["not-a-url"],
      })
    ).rejects.toThrow();
  });

  it("validates tool enum values", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "invalid-tool" as any,
        images: ["https://example.com/img.png"],
      })
    ).rejects.toThrow();
  });

  it("accepts valid upscale batch request", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).tools.batchProcess({
      tool: "upscale",
      images: ["https://example.com/img1.png"],
      scaleFactor: "2x",
      enhanceDetails: true,
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(["completed", "failed"]).toContain(result.results[0].status);
  }, 30000);

  it("accepts valid style-transfer batch request", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).tools.batchProcess({
      tool: "style-transfer",
      images: ["https://example.com/img1.png"],
      style: "anime",
      intensity: 0.8,
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
  }, 30000);

  it("accepts valid background-edit batch request", async () => {
    const { ctx } = createAuthContext();
    const result = await caller(ctx).tools.batchProcess({
      tool: "background-edit",
      images: ["https://example.com/img1.png"],
      mode: "remove",
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(1);
    expect(result.results).toHaveLength(1);
  }, 30000);

  it("validates style-transfer style enum", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "style-transfer",
        images: ["https://example.com/img.png"],
        style: "invalid-style" as any,
      })
    ).rejects.toThrow();
  });

  it("validates background-edit mode enum", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "background-edit",
        images: ["https://example.com/img.png"],
        mode: "invalid-mode" as any,
      })
    ).rejects.toThrow();
  });

  it("validates intensity range for style-transfer", async () => {
    const { ctx } = createAuthContext();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "style-transfer",
        images: ["https://example.com/img.png"],
        style: "anime",
        intensity: 1.5,
      })
    ).rejects.toThrow();
    await expect(
      caller(ctx).tools.batchProcess({
        tool: "style-transfer",
        images: ["https://example.com/img.png"],
        style: "anime",
        intensity: 0.05,
      })
    ).rejects.toThrow();
  });
});
