import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import {
  createGeneration,
  getDb,
  getGenerationById,
  getGalleryItems,
  getGalleryStats,
  getGenerationsForExport,
  getUserGenerations,
  publishGalleryItem,
  setGenerationTags,
  updateGeneration,
  updateUserProfile,
} from "./db";
import { deductCredits, refundCredits } from "./stripe";
import { TOOL_CREDIT_COSTS } from "../shared/creditCosts";
import { createNotification } from "./routersPhase15";
import { autoCheckAchievements } from "./routers/phase22";
import type { SubscriptionEntitlementInput } from "../shared/subscriptionEntitlement";

const imageTestConfig = vi.hoisted(() => ({
  falApiKey: "test-fal-not-a-real-key",
  openaiApiKey: "",
  grokApiKey: "",
  stabilityApiKey: "",
  replicateApiToken: "",
  togetherApiKey: "",
  geminiApiKey: "",
  cfAiToken: "",
  cfAccountId: "",
  runpodApiKey: "",
  runpodFluxEndpointId: "",
}));

const generationBillingMocks = vi.hoisted(() => ({
  read: vi.fn(), claim: vi.fn(), begin: vi.fn(), complete: vi.fn(), fail: vi.fn(), reconcile: vi.fn(),
  records: new Map<string, any>(),
}));
vi.mock("./_core/generationBilling", () => ({
  readGenerationRequest: (...args: any[]) => generationBillingMocks.read(...args),
  claimGenerationRequest: (...args: any[]) => generationBillingMocks.claim(...args),
  beginGenerationRequest: (...args: any[]) => generationBillingMocks.begin(...args),
  completeGenerationRequest: (...args: any[]) => generationBillingMocks.complete(...args),
  failGenerationRequestAndRefund: (...args: any[]) => generationBillingMocks.fail(...args),
  markGenerationReconciliation: (...args: any[]) => generationBillingMocks.reconcile(...args),
}));

// Provider configuration is synthetic. Render calls below are always mocked.
vi.mock("./_core/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./_core/env")>();
  return {
    ...actual,
    ENV: new Proxy(actual.ENV, {
      get(target, property) {
        if (Object.hasOwn(imageTestConfig, property)) {
          return imageTestConfig[property as keyof typeof imageTestConfig];
        }
        return Reflect.get(target, property);
      },
    }),
  };
});

vi.mock("./routersPhase15", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./routersPhase15")>();
  return { ...actual, createNotification: vi.fn(async () => undefined) };
});

vi.mock("./routers/phase22", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./routers/phase22")>();
  return { ...actual, autoCheckAchievements: vi.fn(async () => []) };
});

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
const mockSetGenerationTags = vi.mocked(setGenerationTags);
const mockGetUserGenerations = vi.mocked(getUserGenerations);
const mockGetGenerationById = vi.mocked(getGenerationById);
const mockGetGalleryItems = vi.mocked(getGalleryItems);
const mockGetGalleryStats = vi.mocked(getGalleryStats);
const mockGetGenerationsForExport = vi.mocked(getGenerationsForExport);
const mockPublishGalleryItem = vi.mocked(publishGalleryItem);
const mockUpdateUserProfile = vi.mocked(updateUserProfile);
const mockDeductCredits = vi.mocked(deductCredits);
const mockRefundCredits = vi.mocked(refundCredits);
const mockCreateNotification = vi.mocked(createNotification);
const mockAutoCheckAchievements = vi.mocked(autoCheckAchievements);

// Fresh call history per test; factory implementations survive clearing, and
// tests that need specific rows set them explicitly.
beforeEach(() => {
  vi.clearAllMocks();
  generationBillingMocks.records.clear();
  generationBillingMocks.read.mockReset().mockResolvedValue(null);
  generationBillingMocks.claim.mockReset().mockImplementation(async input => {
    const request = { ...input, id: 1, quotedCredits: input.credits, state: "reserved", generationId: null, result: null };
    generationBillingMocks.records.set(input.requestId, request);
    return { kind: "owned", request, owner: { ...input, id: 1, executionToken: "11111111-1111-4111-8111-111111111111" } };
  });
  generationBillingMocks.begin.mockReset().mockImplementation(async (owner, generationId) => {
    const request = { ...generationBillingMocks.records.get(owner.requestId), state: "rendering", generationId };
    generationBillingMocks.records.set(owner.requestId, request);
    return { kind: "begun", request };
  });
  generationBillingMocks.complete.mockReset().mockImplementation(async (owner, input) => ({
    kind: "completed", request: { ...generationBillingMocks.records.get(owner.requestId), state: "completed", result: input.result },
  }));
  generationBillingMocks.fail.mockReset().mockImplementation(async (owner, input) => ({
    kind: "refunded", request: { ...generationBillingMocks.records.get(owner.requestId), state: "refunded", generationId: input.generationId ?? null },
  }));
  generationBillingMocks.reconcile.mockReset().mockResolvedValue({ kind: "uncertain" });
  vi.mocked(getDb).mockResolvedValue(null);
  imageTestConfig.falApiKey = "test-fal-not-a-real-key";
  imageTestConfig.grokApiKey = "";
  mockGenerateImage.mockReset().mockResolvedValue({ url: "https://cdn.example.com/phase2-generated.png" });
  mockCreateGeneration.mockReset().mockResolvedValue(101);
  mockUpdateGeneration.mockReset().mockResolvedValue(undefined);
  mockSetGenerationTags.mockReset().mockResolvedValue(undefined);
  mockDeductCredits.mockReset().mockResolvedValue({ success: true, balance: 95, needed: 5 });
  mockRefundCredits.mockReset().mockResolvedValue(undefined as any);
  mockCreateNotification.mockReset().mockResolvedValue(undefined as any);
  mockAutoCheckAchievements.mockReset().mockResolvedValue([]);
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

function subscriptionRow(planName: string, overrides: Partial<SubscriptionEntitlementInput> = {}) {
  return {
    planName,
    status: "active",
    currentPeriodStart: new Date(Date.now() - 86_400_000),
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function useSubscriptionPlan(planName: "creator" | "pro", overrides: Partial<SubscriptionEntitlementInput> = {}) {
  vi.mocked(getDb).mockResolvedValue({
    execute: vi.fn().mockResolvedValue({ rows: [{ current_hits: 0, allowed: true }] }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([subscriptionRow(planName, overrides)]),
  } as any);
}

function expectGenerationQuote(userId: number, credits: number) {
  expect(generationBillingMocks.claim).toHaveBeenCalledTimes(1);
  expect(generationBillingMocks.claim).toHaveBeenCalledWith(expect.objectContaining({ userId, credits }));
}

function expectGenerationRefund(userId: number, credits: number) {
  expectGenerationQuote(userId, credits);
  expect(generationBillingMocks.fail).toHaveBeenCalledTimes(1);
  expect(generationBillingMocks.fail).toHaveBeenCalledWith(
    expect.objectContaining({ userId }), expect.objectContaining({ confirmedFailure: true, errorCode: "generation-failed" }),
  );
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
    expectGenerationQuote(ctx.user.id, TOOL_CREDIT_COSTS["text-to-image"] ?? 1);
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
    expect(generationBillingMocks.complete).toHaveBeenCalledWith(expect.objectContaining({ userId: ctx.user.id }), expect.objectContaining({
      imageUrl: "https://cdn.example.com/phase2-generated.png",
      thumbnailUrl: "https://cdn.example.com/phase2-generated.png",
    }));
    expect(result).toEqual({
      id: 101,
      status: "completed",
      imageUrl: "https://cdn.example.com/phase2-generated.png",
      mediaType: "image",
      requestId: expect.any(String),
      newAchievements: [],
      modelId: "built-in-v1",
      creditCost: 5,
      provenance: undefined,
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

    expectGenerationQuote(ctx.user.id, TOOL_CREDIT_COSTS["text-to-video"] ?? 1);
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
      requestId: expect.any(String),
      newAchievements: [],
    });
    expect(result.mediaType).toBe("video");
  });

  it.each(["provider exploded", "provider poll timed out", "image download unavailable", "storage write unavailable"])("holds an unconfirmed renderer error for reconciliation (%s)", async message => {
    mockGenerateImage.mockRejectedValueOnce(new Error(message));

    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.create({
      prompt: "A beautiful sunset over mountains",
      mediaType: "image",
      width: 768,
      height: 768,
      modelVersion: "built-in-v1",
    });

    expect(result).toMatchObject({ status: "generating", reconciliationRequired: true });
    expect(result).not.toHaveProperty("refundedCredits");
    expectGenerationQuote(ctx.user.id, TOOL_CREDIT_COSTS["text-to-image"] ?? 1);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
    expect(generationBillingMocks.complete).not.toHaveBeenCalled();
    expect(generationBillingMocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown explicit model before charging or creating a row", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.generation.create({
      prompt: "A crystal dragon over a volcano",
      mediaType: "image",
      width: 768,
      height: 768,
      modelVersion: "some-future-model",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(generationBillingMocks.claim).not.toHaveBeenCalled();
    expect(mockCreateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it("charges the model's registry price for known premium models", async () => {
    // Pro-plan user so the premium model gate (canAccessModel) passes.
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rows: [{ current_hits: 0, allowed: true }] }),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([subscriptionRow("pro")]),
    } as any);
    try {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.generation.create({
        prompt: "A crystal dragon over a volcano",
        mediaType: "image",
        width: 768,
        height: 768,
        modelVersion: "flux-pro", // registry premium image model, creditCost.base = 15
      });

      expect(result.status).toBe("completed");
      expectGenerationQuote(ctx.user.id, 15);
    } finally {
      vi.mocked(getDb).mockResolvedValue(null);
    }
  });

  it("rejects an image model for video before charging or executing", async () => {
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rows: [{ current_hits: 0, allowed: true }] }),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([subscriptionRow("pro")]),
    } as any);
    try {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.generation.create({
        prompt: "A phoenix rising from flames",
        mediaType: "video",
        width: 768,
        height: 768,
        duration: 4,
        modelVersion: "flux-pro",
      })).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(generationBillingMocks.claim).not.toHaveBeenCalled();
      expect(mockCreateGeneration).not.toHaveBeenCalled();
      expect(mockGenerateImage).not.toHaveBeenCalled();
    } finally {
      vi.mocked(getDb).mockResolvedValue(null);
    }
  });

  it("holds the exact premium quote when the renderer outcome is uncertain", async () => {
    vi.mocked(getDb).mockResolvedValue({
      execute: vi.fn().mockResolvedValue({ rows: [{ current_hits: 0, allowed: true }] }),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([subscriptionRow("pro")]),
    } as any);
    try {
      mockGenerateImage.mockRejectedValueOnce(new Error("provider exploded"));

      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.generation.create({
        prompt: "A crystal dragon over a volcano",
        mediaType: "image",
        width: 768,
        height: 768,
        modelVersion: "flux-pro",
      });

      expect(result).toMatchObject({ status: "generating", reconciliationRequired: true });
      expect(result).not.toHaveProperty("refundedCredits");
      expectGenerationQuote(ctx.user.id, 15);
      expect(generationBillingMocks.fail).not.toHaveBeenCalled();
      expect(generationBillingMocks.reconcile).toHaveBeenCalledTimes(1);
    } finally {
      vi.mocked(getDb).mockResolvedValue(null);
    }
  });

  it("exposes the executable image catalog without authentication or generation", async () => {
    const caller = appRouter.createCaller(createPublicContext().ctx);
    const catalog = await caller.generation.imageModels();
    expect(catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "built-in-v1", creditCost: 5, requiredTier: "free", isConfigured: true }),
      expect.objectContaining({ id: "flux-pro", creditCost: 15, requiredTier: "pro" }),
    ]));
    expect(generationBillingMocks.claim).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it.each(["built-in-v1", "auto"])("charges %s once at the fixed automatic price", async modelVersion => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await caller.generation.create({ prompt: "A mountain lake", width: 768, height: 768, modelVersion });
    expect(generationBillingMocks.claim).toHaveBeenCalledTimes(1);
    expectGenerationQuote(1, 5);
    expect(mockGenerateImage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ model: "auto" }));
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
  });

  it("executes a selected model alias and stores its canonical identity and real provider receipt", async () => {
    useSubscriptionPlan("creator");
    imageTestConfig.grokApiKey = "test-grok-not-a-real-key";
    const provenance = { provider: "grok", model: "grok-imagine-image", requestedModel: "grok", fallbackUsed: false };
    mockGenerateImage.mockResolvedValueOnce({ url: "https://cdn.example.com/grok.png", provenance });
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await caller.generation.create({ prompt: "A mountain lake", width: 768, height: 768, modelVersion: "grok" });
    expect(mockGenerateImage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ model: "grok", userTier: "creator" }));
    expectGenerationQuote(1, 5);
    expect(mockCreateGeneration).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ requestedModelId: "grok", modelId: "grok-image", quotedCredits: 5 }),
    }));
    expect(generationBillingMocks.complete).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }), expect.objectContaining({
      metadata: expect.objectContaining({ imageGeneration: provenance }),
    }));
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
  });

  it.each([
    ["gpt-4o-mini", "BAD_REQUEST"],
    ["fal-flux-kontext", "BAD_REQUEST"],
    ["flux-pro", "FORBIDDEN"],
  ])("rejects invalid standard image selection %s before debit", async (modelVersion, code) => {
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake", width: 768, height: 768, modelVersion }))
      .rejects.toMatchObject({ code });
    expect(generationBillingMocks.claim).not.toHaveBeenCalled();
    expect(mockCreateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it("rejects an unconfigured selection before debit without switching to configured Automatic", async () => {
    useSubscriptionPlan("creator");
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake", width: 768, height: 768, modelVersion: "grok-image" }))
      .rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(generationBillingMocks.claim).not.toHaveBeenCalled();
    expect(mockCreateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it.each(["canceled", "past_due", "incomplete", "unpaid", "paused"])("denies saved paid model access for %s before any debit", async status => {
    useSubscriptionPlan("pro", { status });
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake", modelVersion: "flux-pro" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(generationBillingMocks.claim).not.toHaveBeenCalled();
    expect(mockCreateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it.each([null, new Date("2020-01-01T00:00:00Z")])("denies active paid model access without an unexpired end (%s)", async currentPeriodEnd => {
    useSubscriptionPlan("pro", { currentPeriodEnd });
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake", modelVersion: "flux-pro" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(generationBillingMocks.claim).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it.each([
    { status: "active", cancelAtPeriodEnd: true },
    { status: "trialing", cancelAtPeriodEnd: false },
  ])("retains valid saved paid access for %j", async overrides => {
    useSubscriptionPlan("pro", overrides);
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake", modelVersion: "flux-pro" });
    expect(result.status).toBe("completed");
    expectGenerationQuote(1, 15);
    expect(mockGenerateImage).toHaveBeenCalledWith(expect.objectContaining({ model: "flux-pro", userTier: "pro" }));
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
  });

  it("does not create, render or refund when the wallet declines the debit", async () => {
    generationBillingMocks.claim.mockImplementationOnce(async input => ({
      kind: "replay", request: { ...input, id: 1, quotedCredits: input.credits, state: "rejected", generationId: null, result: null },
    }));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake" }))
      .resolves.toMatchObject({ status: "failed", creditCost: 0, quotedCredits: 5, refundedCredits: 0 });
    expect(generationBillingMocks.claim).toHaveBeenCalledTimes(1);
    expect(mockCreateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
  });

  it("refunds a successful debit once if the generation record cannot be created", async () => {
    mockCreateGeneration.mockRejectedValueOnce(new Error("record insert unavailable"));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake" })).resolves.toMatchObject({ id: undefined, status: "failed", refundedCredits: 5, creditCost: 0 });
    expect(generationBillingMocks.claim).toHaveBeenCalledTimes(1);
    expectGenerationRefund(1, 5);
    expect(mockUpdateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it("refunds and stops before rendering when record creation returns an invalid ID", async () => {
    mockCreateGeneration.mockResolvedValueOnce(0);
    const caller = appRouter.createCaller(createAuthContext().ctx);
    await expect(caller.generation.create({ prompt: "A mountain lake" })).resolves.toMatchObject({ id: undefined, status: "failed", refundedCredits: 5, creditCost: 0 });
    expectGenerationRefund(1, 5);
    expect(mockUpdateGeneration).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it("refunds tag persistence failure once before making a provider request", async () => {
    mockSetGenerationTags.mockRejectedValueOnce(new Error("tags unavailable"));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake", tagIds: [1] });
    expect(result.status).toBe("failed");
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expectGenerationRefund(1, 5);
  });

  it("retains pending reconciliation when the atomic failure settlement cannot be confirmed", async () => {
    mockSetGenerationTags.mockRejectedValueOnce(new Error("tags unavailable"));
    generationBillingMocks.fail.mockRejectedValueOnce(new Error("atomic settlement unavailable"));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake", tagIds: [1] });
    expect(result).toMatchObject({ status: "generating", reconciliationRequired: true });
    expect(result).not.toHaveProperty("refundedCredits");
    expect(generationBillingMocks.claim).toHaveBeenCalledTimes(1);
    expect(generationBillingMocks.fail).toHaveBeenCalledTimes(1);
    expect(generationBillingMocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])("holds a provider response with no downloadable URL for reconciliation (%s)", async url => {
    mockGenerateImage.mockResolvedValueOnce({ url });
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake" });
    expect(result).toMatchObject({ status: "generating", reconciliationRequired: true });
    expect(result).not.toHaveProperty("refundedCredits");
    expect(mockUpdateGeneration).not.toHaveBeenCalledWith(101, expect.objectContaining({ status: "completed" }));
    expectGenerationQuote(1, 5);
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
    expect(generationBillingMocks.complete).not.toHaveBeenCalled();
    expect(generationBillingMocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it("keeps uncertain completion pending and never enters the confirmed-failure refund path", async () => {
    generationBillingMocks.complete.mockRejectedValueOnce(new Error("completion acknowledgment unavailable"));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake" });
    expect(result.status).toBe("generating");
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
    expect(generationBillingMocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not refund a delivered result when its completion notification fails", async () => {
    mockCreateNotification.mockRejectedValueOnce(new Error("notification unavailable"));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake" });
    expect(result.status).toBe("completed");
    expect(generationBillingMocks.complete).toHaveBeenCalledTimes(1);
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
  });

  it("preserves delivered output when achievement checks fail", async () => {
    mockAutoCheckAchievements.mockRejectedValueOnce(new Error("achievements unavailable"));
    const caller = appRouter.createCaller(createAuthContext().ctx);
    const result = await caller.generation.create({ prompt: "A mountain lake" });
    expect(result).toMatchObject({ status: "completed", newAchievements: [] });
    expect(generationBillingMocks.complete).toHaveBeenCalledTimes(1);
    expect(generationBillingMocks.fail).not.toHaveBeenCalled();
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
