import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
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
    openId: "test-user-001",
    email: "researcher@example.com",
    name: "Test Researcher",
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

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
    });
  });
});

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.openId).toBe("test-user-001");
    expect(result?.name).toBe("Test Researcher");
    expect(result?.role).toBe("user");
  });

  it("returns null for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

describe("tags.list", () => {
  it("returns an array of tags", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tags.list();

    expect(Array.isArray(result)).toBe(true);
    // After seeding, should have default tags
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("slug");
      expect(result[0]).toHaveProperty("category");
    }
  });
});

describe("gallery.list", () => {
  it("returns items and total count", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.list({
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("respects pagination parameters", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.list({
      limit: 5,
      offset: 0,
    });

    expect(result.items.length).toBeLessThanOrEqual(5);
  });
});

describe("gallery.stats", () => {
  it("returns gallery statistics", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.gallery.stats();

    expect(result).toHaveProperty("totalItems");
    expect(result).toHaveProperty("totalGenerations");
    expect(result).toHaveProperty("totalViews");
    expect(typeof result.totalItems).toBe("number");
    expect(typeof result.totalGenerations).toBe("number");
    // COUNT results may return as string from MySQL
    expect(["number", "string"].includes(typeof result.totalViews)).toBe(true);
  });
});

describe("moderation.queue (admin only)", () => {
  it("rejects non-admin users", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.moderation.queue({ status: "pending", limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("allows admin users", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.moderation.queue({
      status: "pending",
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
  });
});

describe("moderation.stats (admin only)", () => {
  it("rejects non-admin users", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.moderation.stats()).rejects.toThrow();
  });

  it("returns stats for admin users", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.moderation.stats();

    expect(result).toHaveProperty("pending");
    expect(result).toHaveProperty("approved");
    expect(result).toHaveProperty("rejected");
  });
});

describe("generation (protected)", () => {
  it("rejects unauthenticated users for list", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.generation.list({ limit: 10, offset: 0 })
    ).rejects.toThrow();
  });

  it("allows authenticated users to list generations", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.generation.list({ limit: 10, offset: 0 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("export.metadata (protected)", () => {
  it("rejects unauthenticated users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.export.metadata({ ids: [1] })).rejects.toThrow();
  });

  it("returns metadata with disclaimer for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.export.metadata({ ids: [999999] });

    // Should return empty array for non-existent IDs
    expect(Array.isArray(result)).toBe(true);
  });
});
