import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  target: vi.fn(),
  remove: vi.fn(),
  resolve: vi.fn(),
  log: vi.fn(),
  revoke: vi.fn(),
  purge: vi.fn(),
}));
vi.mock("./db", async original => ({
  ...(await original<any>()),
  getDb: mocks.getDb,
  resolveTakedownTarget: mocks.target,
  removeGalleryItem: mocks.remove,
  resolveTakedownRequest: mocks.resolve,
  logTakedownAction: mocks.log,
}));
vi.mock("./_core/mediaLifecycle", () => ({
  revokeMediaUrls: mocks.revoke,
  purgeRevokedMedia: mocks.purge,
}));
import { adminRouter } from "./routersPhase15";
const caller = adminRouter.createCaller({
  user: { id: 99, role: "admin" } as any,
  session: null,
  ip: "127.0.0.1",
});
beforeEach(() => {
  vi.clearAllMocks();
  const ticket = {
    id: 1,
    status: "open",
    ticket: "TD-FIXTURE",
    url: "https://dreamforgex.ai/g/50",
    ip: "127.0.0.1",
  };
  mocks.getDb.mockResolvedValue({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [ticket] }) }),
    }),
  });
  mocks.target.mockResolvedValue({
    kind: "gallery_item",
    item: {
      id: 50,
      imageUrl: "https://dreamforgex.ai/img/private/owned.png",
      thumbnailUrl: null,
    },
  });
  mocks.revoke.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue({ removed: true });
  mocks.purge.mockResolvedValue({ deleted: 1, failed: 0 });
  mocks.resolve.mockResolvedValue({
    updated: true,
    request: { ...ticket, status: "actioned" },
  });
});
describe("takedown media revocation", () => {
  it("revokes origin reads durably before public removal and ticket resolution", async () => {
    await expect(
      caller.takedown.resolve({ id: 1, action: "remove_content" })
    ).resolves.toMatchObject({ success: true, itemRemoved: true });
    expect(mocks.revoke).toHaveBeenCalledWith(
      ["https://dreamforgex.ai/img/private/owned.png", null],
      "takedown"
    );
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remove.mock.invocationCallOrder[0]
    );
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resolve.mock.invocationCallOrder[0]
    );
  });
  it("does not action or remove content if durable revocation fails", async () => {
    mocks.revoke.mockRejectedValueOnce(new Error("registry unavailable"));
    await expect(
      caller.takedown.resolve({ id: 1, action: "remove_content" })
    ).rejects.toThrow("registry unavailable");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it("still resolves after object purge fails because durable revocation already blocks reads", async () => {
    mocks.purge.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(
      caller.takedown.resolve({ id: 1, action: "remove_content" })
    ).resolves.toMatchObject({ success: true });
    expect(mocks.revoke).toHaveBeenCalledTimes(1);
    expect(mocks.resolve).toHaveBeenCalledTimes(1);
  });
});
