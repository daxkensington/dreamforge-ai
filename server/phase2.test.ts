import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import {
  createGeneration,
  getGenerationById,
  getGalleryItems,
  getGalleryStats,
  getGenerationsForExport,
  getUserGenerations,
  publishGalleryItem,
  updateGeneration,
  updateUserProfile,
} from "./db";
import { deductCredits, refundCredits } from "./stripe";
import { TOOL_CREDIT_COSTS } from "../shared/creditCosts";

// Stub the LLM module — generation.enhancePrompt must never make live
// network calls in tests. Per-test behavior is set with mockInvokeLLM below.
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// Stub the image-generation chain — generation.create must never reach real
// providers (fal/Replicate/RunPod) in tests. Per-test behavior is set with
// mockGenerateImage below.
vi.mock("./_core/imageGeneration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/imageGeneration")>();
  return {
    ...actual,
    generateImage: vi.fn(async () => ({ url: "https://cdn.example.com/phase2-generated.png" })),
  };
});

// Stub the db layer — no test may touch the real database. getDb() returning
// null sends the tier lookup, rate limiter, and tool kill-switch down their
// designed no-DB paths (free tier / fail open), and the helpers below stand in
// for the rows each procedure reads or writes. Pattern matches batch.test.ts
// and collaboration.test.ts.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => null),
    createGeneration: vi.fn(async () => 101),
    updateGeneration: vi.fn(async () => undefined),
    setGenerationTags: vi.fn(async () => undefined),
    getUserGenerations: vi.fn(async () => []),
    getGenerationById: vi.fn(async () => undefined),
    getGalleryItems: vi.fn(async () => ({ items: [], total: 0 })),
    getGalleryStats: vi.fn(async () => ({ totalItems: 0, totalGenerations: 0, totalViews: 0 })),
    getGenerationsForExport: vi.fn(async () => []),
    publishGalleryItem: vi.fn(async () => 1),
    updateUserProfile: vi.fn(async () => undefined),
  };
});

// Stub the credit ledger — deduction/refund must never hit Stripe or the
// credit balance tables in tests.
vi.mock("./stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe")>();
  return {
    ...actual,
    deductCredits: vi.fn(async () => ({ success: true, balance: 95, needed: 5 })),
    refundCredits: vi.fn(async () => undefined),
  };
});

const mockInvokeLLM = vi.mocked(invokeLLM);
const mockGenerateImage = vi.mocked(generateImage);
const mockCreateGeneration = vi.mocked(createGeneration);
const mockUpdateGeneration = vi.mocked(updateGeneration);
const mockGetUserGenerations = vi.mocked(getUserGenerations);
const mockGetGenerationById = vi.mocked(getGenerationById);
const mockGetGalleryItems = vi.mocked(getGalleryItems);
const mockGetGalleryStats = vi.mocked(getGalleryStats);
const mockGetGenerationsForExport = vi.mocked(getGenerationsForExport);
const mockPublishGalleryItem = vi.mocked(publishGalleryItem);
const mockUpdateUserProfile = vi.mocked(updateUserProfile);
const mockDeductCredits = vi.mocked(deductCredits);
const mockRefundCredits = vi.mocked(refundCredits);

// Fresh call history per test; factory implementations survive clearing, and
// tests that need specific rows set them explicitly.
beforeEach(() => {
  vi.clearAllMocks();
});

function llmResult(content: string) {
  return {
    id: "chatcmpl-test",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        message: { role: "assistant" as const, content },
        finish_reason: "stop",
      },
    ],
  };
}

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
    openId: "test-user-phase2",
    email: "researcher@example.com",
    name: "Phase2 Researcher",
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

/* Minimal generations row matching drizzle/schema.ts. Tests pass it (via
   `as any`) to the mocked db helpers in place of a real row. */
function fakeGeneration(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-01-02T03:04:05Z");
  return {
    id: 5,
    userId: 1,
    prompt: "A serene mountain lake at dawn",
    negativePrompt: null,
    modelVersion: "built-in-v1",
    mediaType: "image",
    width: 768,
    height: 768,
    duration: null,
    imageUrl: "https://cdn.example.com/lake.png",
    thumbnailUrl: "https://cdn.example.com/lake.png",
    fileKey: null,
    status: "completed",
    errorMessage: null,
    parentGenerationId: null,
    animationStyle: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Generation Create Tests ────────────────────────────────────────────────

describe("generation.create", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.create({
        prompt: "A crystalline dragon",
        mediaType: "image",
        width: 512,
        height: 768,
      })
    ).rejects.toThrow();
  });

  it("validates prompt is required and non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.create({
        prompt: "",
        mediaType: "image",
        width: 512,
        height: 768,
      })
    ).rejects.toThrow();
  });

  it("validates width bounds", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.create({
        prompt: "Test prompt",
        mediaType: "image",
        width: 100, // below minimum 256
        height: 768,
      })
    ).rejects.toThrow();
  });

  it("validates height bounds", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.create({
        prompt: "Test prompt",
        mediaType: "image",
        width: 512,
        height: 2000, // above maximum 1536
      })
    ).rejects.toThrow();
  });

  it("validates mediaType enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.create({
        prompt: "Test prompt",
        mediaType: "audio" as any, // invalid
        width: 512,
        height: 768,
      })
    ).rejects.toThrow();
  });

  it("validates duration bounds for video", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.create({
        prompt: "Test prompt",
        mediaType: "video",
        width: 512,
        height: 768,
        duration: 20, // above maximum 8
      })
    ).rejects.toThrow();
  });

  it("validates prompt max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const longPrompt = "x".repeat(2001);
    await expect(
      caller.generation.create({
        prompt: longPrompt,
        mediaType: "image",
        width: 512,
        height: 768,
      })
    ).rejects.toThrow();
  });

  it("accepts valid image generation input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.create({
      prompt: "A beautiful sunset over mountains",
      mediaType: "image",
      width: 768,
      height: 768,
      modelVersion: "built-in-v1",
    });

    // Credits are charged up front for the requested tool...
    expect(mockDeductCredits).toHaveBeenCalledWith(
      ctx.user.id,
      TOOL_CREDIT_COSTS["text-to-image"] ?? 1,
      expect.stringContaining("Generated image"),
    );
    // ...a "generating" row is inserted...
    expect(mockCreateGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ctx.user.id,
        prompt: "A beautiful sunset over mountains",
        mediaType: "image",
        width: 768,
        height: 768,
        modelVersion: "built-in-v1",
        status: "generating",
      }),
    );
    expect(mockGenerateImage).toHaveBeenCalledOnce();
    // ...and the row is flipped to completed with the provider URL.
    expect(mockUpdateGeneration).toHaveBeenCalledWith(101, {
      status: "completed",
      imageUrl: "https://cdn.example.com/phase2-generated.png",
      thumbnailUrl: "https://cdn.example.com/phase2-generated.png",
    });
    expect(result).toEqual({
      id: 101,
      status: "completed",
      imageUrl: "https://cdn.example.com/phase2-generated.png",
      mediaType: "image",
      newAchievements: [],
    });
  });

  it("accepts valid video generation input", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.create({
      prompt: "A phoenix rising from flames",
      mediaType: "video",
      width: 768,
      height: 768,
      duration: 4,
      modelVersion: "animatediff-v2",
    });

    expect(mockDeductCredits).toHaveBeenCalledWith(
      ctx.user.id,
      TOOL_CREDIT_COSTS["text-to-video"] ?? 1,
      expect.stringContaining("Generated video"),
    );
    expect(mockCreateGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ctx.user.id,
        prompt: "A phoenix rising from flames",
        mediaType: "video",
        duration: 4,
        modelVersion: "animatediff-v2",
        status: "generating",
      }),
    );
    expect(result).toEqual({
      id: 101,
      status: "completed",
      imageUrl: "https://cdn.example.com/phase2-generated.png",
      mediaType: "video",
      newAchievements: [],
    });
    expect(result.mediaType).toBe("video");
  });

  it("marks the generation failed and refunds credits when the provider errors", async () => {
    mockGenerateImage.mockRejectedValueOnce(new Error("provider exploded"));

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.create({
      prompt: "A beautiful sunset over mountains",
      mediaType: "image",
      width: 768,
      height: 768,
      modelVersion: "built-in-v1",
    });

    // The router maps provider errors to a failed row, not a thrown error...
    expect(result).toEqual({ id: 101, status: "failed", error: "provider exploded" });
    expect(mockUpdateGeneration).toHaveBeenCalledWith(101, {
      status: "failed",
      errorMessage: "provider exploded",
    });
    // ...and refunds the credit charge.
    expect(mockRefundCredits).toHaveBeenCalledWith(
      ctx.user.id,
      TOOL_CREDIT_COSTS["text-to-image"] ?? 1,
      expect.stringContaining("Refund"),
    );
  });
});

// ─── Generation Enhance Prompt Tests ────────────────────────────────────────

describe("generation.enhancePrompt", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.enhancePrompt({ prompt: "A dragon" })
    ).rejects.toThrow();
  });

  it("validates prompt is non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.enhancePrompt({ prompt: "" })
    ).rejects.toThrow();
  });

  it("returns enhanced prompt for valid input", async () => {
    mockInvokeLLM.mockResolvedValue(
      llmResult(
        "A majestic dragon soaring over snow-capped mountains at golden hour, cinematic lighting"
      )
    );

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.enhancePrompt({
      prompt: "A dragon flying over mountains",
    });

    expect(result).toHaveProperty("enhanced");
    expect(typeof result.enhanced).toBe("string");
    expect(result.enhanced).toBe(
      "A majestic dragon soaring over snow-capped mountains at golden hour, cinematic lighting"
    );
    expect(mockInvokeLLM).toHaveBeenCalledOnce();
  });

  it("falls back to the original prompt when the LLM call fails", async () => {
    mockInvokeLLM.mockRejectedValue(new Error("LLM unavailable"));

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.enhancePrompt({
      prompt: "A dragon flying over mountains",
    });

    expect(result.enhanced).toBe("A dragon flying over mountains");
  });
});

// ─── User Profile Tests ─────────────────────────────────────────────────────

describe("user.updateProfile", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.user.updateProfile({ name: "Test" })
    ).rejects.toThrow();
  });

  it("validates name max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.user.updateProfile({ name: "x".repeat(101) })
    ).rejects.toThrow();
  });

  it("validates bio max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.user.updateProfile({ bio: "x".repeat(501) })
    ).rejects.toThrow();
  });

  it("validates institution max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.user.updateProfile({ institution: "x".repeat(257) })
    ).rejects.toThrow();
  });

  it("accepts valid profile update", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const input = {
      name: "Dr. Research",
      bio: "Studying synthetic media generation",
      institution: "MIT Media Lab",
    };
    const result = await caller.user.updateProfile(input);

    expect(result).toEqual({ success: true });
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(ctx.user.id, input);
  });
});

// ─── Gallery List with Sort Tests ───────────────────────────────────────────

describe("gallery.list with sort", () => {
  const galleryFixture = () => {
    const item = {
      id: 7,
      generationId: 3,
      userId: 1,
      title: "Neon Samurai",
      description: null,
      featured: false,
      viewCount: 42,
      approvedAt: null,
      approvedBy: null,
      createdAt: new Date("2026-01-02T03:04:05Z"),
      updatedAt: new Date("2026-01-02T03:04:05Z"),
      generation: fakeGeneration({ id: 3 }),
      userName: "Phase2 Researcher",
      tags: [],
    };
    return { items: [item], total: 1 };
  };

  it("accepts sort parameter 'newest'", async () => {
    mockGetGalleryItems.mockResolvedValue(galleryFixture() as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.list({
      limit: 10,
      offset: 0,
      sort: "newest",
    });

    expect(mockGetGalleryItems).toHaveBeenCalledWith({ limit: 10, offset: 0, sort: "newest" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 7, title: "Neon Samurai" });
    expect(result.total).toBe(1);
  });

  it("accepts sort parameter 'oldest'", async () => {
    mockGetGalleryItems.mockResolvedValue(galleryFixture() as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.list({
      limit: 10,
      offset: 0,
      sort: "oldest",
    });

    expect(mockGetGalleryItems).toHaveBeenCalledWith({ limit: 10, offset: 0, sort: "oldest" });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });

  it("accepts sort parameter 'most_viewed'", async () => {
    mockGetGalleryItems.mockResolvedValue(galleryFixture() as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.list({
      limit: 10,
      offset: 0,
      sort: "most_viewed",
    });

    expect(mockGetGalleryItems).toHaveBeenCalledWith({ limit: 10, offset: 0, sort: "most_viewed" });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });

  it("rejects invalid sort parameter", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.gallery.list({
        limit: 10,
        offset: 0,
        sort: "invalid_sort" as any,
      })
    ).rejects.toThrow();
  });

  it("defaults to newest when no sort specified", async () => {
    mockGetGalleryItems.mockResolvedValue(galleryFixture() as any);

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.list({
      limit: 10,
      offset: 0,
    });

    // No sort key is invented — the db layer's default ordering applies.
    expect(mockGetGalleryItems).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
  });
});

// ─── Generation Submit to Gallery Tests ─────────────────────────────────────

describe("generation.submitToGallery", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.submitToGallery({
        generationId: 1,
        title: "Test submission",
      })
    ).rejects.toThrow();
  });

  it("validates title is required", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.submitToGallery({
        generationId: 1,
        title: "",
      })
    ).rejects.toThrow();
  });

  it("validates title max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.submitToGallery({
        generationId: 1,
        title: "x".repeat(257),
      })
    ).rejects.toThrow();
  });

  it("rejects non-existent generation", async () => {
    mockGetGenerationById.mockResolvedValue(undefined);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.submitToGallery({
        generationId: 999999,
        title: "Test",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mockGetGenerationById).toHaveBeenCalledWith(999999);
    expect(mockPublishGalleryItem).not.toHaveBeenCalled();
  });

  it("rejects another user's generation", async () => {
    mockGetGenerationById.mockResolvedValue(fakeGeneration({ id: 5, userId: 2 }) as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.submitToGallery({
        generationId: 5,
        title: "Not mine",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockPublishGalleryItem).not.toHaveBeenCalled();
  });

  it("rejects generations that are not completed", async () => {
    mockGetGenerationById.mockResolvedValue(
      fakeGeneration({ id: 5, status: "generating" }) as any,
    );

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.submitToGallery({
        generationId: 5,
        title: "Still rendering",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Only completed generations can be submitted",
    });
    expect(mockPublishGalleryItem).not.toHaveBeenCalled();
  });

  it("publishes a completed generation to the gallery", async () => {
    mockGetGenerationById.mockResolvedValue(fakeGeneration({ id: 5 }) as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.submitToGallery({
      generationId: 5,
      title: "Lake at dawn",
      description: "Morning light study",
    });

    expect(mockPublishGalleryItem).toHaveBeenCalledWith({
      generationId: 5,
      userId: ctx.user.id,
      title: "Lake at dawn",
      description: "Morning light study",
    });
    expect(result).toEqual({ published: true });
  });
});

// ─── Moderation Review Tests ────────────────────────────────────────────────

describe("moderation.review", () => {
  it("rejects non-admin users", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.moderation.review({
        id: 1,
        status: "approved",
      })
    ).rejects.toThrow();
  });

  it("validates status enum", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.moderation.review({
        id: 1,
        status: "pending" as any, // not valid for review
      })
    ).rejects.toThrow();
  });

  it("validates note max length", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.moderation.review({
        id: 1,
        status: "approved",
        note: "x".repeat(1001),
      })
    ).rejects.toThrow();
  });
});

// ─── Tags Tests ─────────────────────────────────────────────────────────────

describe("tags.create", () => {
  it("rejects non-admin users", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.tags.create({
        name: "Test Tag",
        slug: "test-tag",
        category: "theme",
      })
    ).rejects.toThrow();
  });

  it("validates category enum", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.tags.create({
        name: "Test Tag",
        slug: "test-tag",
        category: "invalid" as any,
      })
    ).rejects.toThrow();
  });
});

// ─── Export Tests ────────────────────────────────────────────────────────────

describe("export.metadata", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.export.metadata({ ids: [1] })).rejects.toThrow();
  });

  it("validates ids array is non-empty", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.export.metadata({ ids: [] })).rejects.toThrow();
  });

  it("validates ids array max length", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const tooManyIds = Array.from({ length: 51 }, (_, i) => i + 1);
    await expect(caller.export.metadata({ ids: tooManyIds })).rejects.toThrow();
  });

  it("returns empty array for non-existent IDs", async () => {
    mockGetGenerationsForExport.mockResolvedValue([]);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.export.metadata({ ids: [999999] });

    expect(result).toEqual([]);
    expect(mockGetGenerationsForExport).toHaveBeenCalledWith([999999], ctx.user.id);
  });

  it("maps owned generations to export metadata with tags and disclaimer", async () => {
    const createdAt = new Date("2026-01-02T03:04:05Z");
    mockGetGenerationsForExport.mockResolvedValue([
      fakeGeneration({
        id: 3,
        prompt: "Crystal dragon over a volcano",
        modelVersion: "flux-schnell",
        width: 1024,
        height: 1024,
        imageUrl: "https://cdn.example.com/dragon.png",
        createdAt,
        updatedAt: createdAt,
        tags: [
          { name: "Fantasy", slug: "fantasy", category: "genre" },
          { name: "Cyberpunk", slug: "cyberpunk", category: "genre" },
        ],
      }),
    ] as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.export.metadata({ ids: [3, 4] });

    expect(mockGetGenerationsForExport).toHaveBeenCalledWith([3, 4], ctx.user.id);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 3,
      prompt: "Crystal dragon over a volcano",
      negativePrompt: null,
      modelVersion: "flux-schnell",
      mediaType: "image",
      width: 1024,
      height: 1024,
      imageUrl: "https://cdn.example.com/dragon.png",
      tags: [
        { name: "Fantasy", slug: "fantasy", category: "genre" },
        { name: "Cyberpunk", slug: "cyberpunk", category: "genre" },
      ],
      createdAt,
      disclaimer:
        "100% synthetic media — all content mathematically generated, no real individuals depicted or harmed.",
    });
  });
});

// ─── Gallery Stats Tests ────────────────────────────────────────────────────

describe("gallery.stats", () => {
  it("returns stats for public users", async () => {
    mockGetGalleryStats.mockResolvedValue({
      totalItems: 5,
      totalGenerations: 42,
      totalViews: 1230,
    });

    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.stats();

    expect(result).toEqual({
      totalItems: 5,
      totalGenerations: 42,
      totalViews: 1230,
    });
    expect(mockGetGalleryStats).toHaveBeenCalledOnce();
  });
});

// ─── Generation List Tests ──────────────────────────────────────────────────

describe("generation.list", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.list({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("validates limit bounds", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.list({ limit: 0, offset: 0 })
    ).rejects.toThrow();
  });

  it("validates limit max", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.list({ limit: 101, offset: 0 })
    ).rejects.toThrow();
  });

  it("returns array for authenticated users", async () => {
    mockGetUserGenerations.mockResolvedValue([
      fakeGeneration({ id: 11 }),
      fakeGeneration({ id: 12 }),
    ] as any);

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.list({ limit: 10, offset: 0 });

    expect(mockGetUserGenerations).toHaveBeenCalledWith(ctx.user.id, 10, 0);
    expect(Array.isArray(result)).toBe(true);
    expect(result.map((g) => g.id)).toEqual([11, 12]);
  });
});
