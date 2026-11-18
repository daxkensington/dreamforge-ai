import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), generateImage: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.generateImage }));
vi.mock("./_core/toolStatus", () => ({ requireToolActive: vi.fn() }));

import { enforceRateLimit } from "./rate-limit";
import { demoRouter } from "./routers/demo";

describe("rate limit storage failure policy", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("fails open by default without logging the key or error details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.getDb.mockRejectedValue(new Error("query for private@example.com failed"));
    await expect(enforceRateLimit("login:private@example.com", 1, 1000)).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private@example.com");
    warn.mockRestore();
  });

  it("denies the demo before the provider when limiter storage is missing or errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const caller = demoRouter.createCaller({ user: null, session: null, ip: "1.2.3.4" });
    mocks.getDb.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("db offline"));
    for (let i = 0; i < 2; i++) {
      await expect(caller.generate({ prompt: "a cat on a spaceship" })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    }
    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("1.2.3.4");
    warn.mockRestore();
  });

  it("does not leak SQL exception details and fails closed when a query fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = { execute: vi.fn(), batch: vi.fn().mockRejectedValue(new Error("key private@example.com")) };
    mocks.getDb.mockResolvedValue(db);
    await expect(enforceRateLimit("login:private@example.com", 1, 1000, undefined, { failClosed: true }))
      .rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private@example.com");
    warn.mockRestore();
  });

  it("keeps quota denials distinct and does not call the provider", async () => {
    const db = { execute: vi.fn(), batch: vi.fn().mockResolvedValue([null, null, { rows: [{ allowed: false }] }]) };
    mocks.getDb.mockResolvedValue(db);
    const caller = demoRouter.createCaller({ user: null, session: null, ip: "1.2.3.4" });
    await expect(caller.generate({ prompt: "a cat on a spaceship" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });
});
