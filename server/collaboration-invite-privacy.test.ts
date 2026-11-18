import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getVideoProject: vi.fn(), addCollaborator: vi.fn() }));
vi.mock("./db", () => ({ ...mocks, getUserCollaboratorRole: vi.fn() }));
vi.mock("./_core/websocket", () => ({ broadcastChatFromServer: vi.fn(), getOnlineUsers: vi.fn() }));

import { collaborationRouter } from "./routers/collaboration";

describe("direct collaboration invitation privacy", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("gives the same share-link instruction without looking up either address", async () => {
    mocks.getVideoProject.mockResolvedValue({ id: 1, title: "Project" });
    const caller = collaborationRouter.createCaller({ user: { id: 1 }, session: null, ip: null } as any);
    for (const email of ["known@example.com", "unknown@example.com"]) {
      await expect(caller.inviteCollaborator({ projectId: 1, email })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED", message: expect.stringContaining("share link"),
      });
    }
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.addCollaborator).not.toHaveBeenCalled();
  });
  it("still rejects non-owners before showing the share-link instruction", async () => {
    mocks.getVideoProject.mockResolvedValue(null);
    const caller = collaborationRouter.createCaller({ user: { id: 1 }, session: null, ip: null } as any);
    await expect(caller.inviteCollaborator({ projectId: 1, email: "person@example.com" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
