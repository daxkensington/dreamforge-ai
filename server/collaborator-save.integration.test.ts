import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ role: "editor", project: { id: 77, userId: 1, title: "Before", data: {} as unknown }, update: vi.fn(), revision: vi.fn(), notify: vi.fn() }));
vi.mock("./db", async original => ({ ...(await original<Record<string, unknown>>()),
  updateEditableVideoProject: (...args: unknown[]) => mocks.update(...args), createRevision: (...args: unknown[]) => mocks.revision(...args), getLatestRevisionVersion: vi.fn(async () => 4),
}));
vi.mock("./routersPhase15", async original => ({ ...(await original<Record<string, unknown>>()), createNotification: (...args: unknown[]) => mocks.notify(...args) }));
vi.mock("./_core/imageGeneration", () => ({ generateImage: vi.fn(), isAutomaticImageConfigured: () => false }));
import { appRouter } from "./routers";
const caller = (id = 2) => appRouter.createCaller({ user: { id, openId: "fixture", role: "user" } as never, session: null, ip: "loopback-fixture" });
const edit = { id: 77, type: "storyboard" as const, title: "Persisted editor change", data: { scenes: [{ description: "New scene" }] } };
describe("collaborator video project save integration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.role = "editor"; mocks.project = { id: 77, userId: 1, title: "Before", data: {} };
    mocks.revision.mockResolvedValue({ id: 5 }); mocks.notify.mockResolvedValue(undefined);
    mocks.update.mockImplementation(async (id, actor, updates) => { if (id !== mocks.project.id || (actor !== mocks.project.userId && mocks.role !== "editor")) return null; mocks.project = { ...mocks.project, ...updates }; return mocks.project; });
  });
  it("persists an editor update before acknowledging success and notifies the actual owner", async () => {
    expect(await caller().videoProject.save(edit)).toEqual({ id: 77, action: "updated" });
    expect(mocks.project).toMatchObject({ title: edit.title, data: edit.data });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(77, 2, expect.objectContaining({ title: edit.title, data: edit.data }));
    expect(mocks.notify).toHaveBeenCalledWith(1, "collaboration", "Project Edited", expect.stringContaining(edit.title), { projectId: 77 });
    expect(mocks.revision).toHaveBeenCalledWith(expect.objectContaining({ projectId: 77, userId: 2, version: 5, data: edit.data }));
  });
  it.each(["viewer", "revoked"])("rejects %s without a revision, owner notification or false success", async role => {
    mocks.role = role;
    await expect(caller().videoProject.save(edit)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.project.title).toBe("Before"); expect(mocks.revision).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("preserves a committed save when optional revision or notification writes fail", async () => {
    mocks.revision.mockRejectedValueOnce(new Error("Revision unavailable")); mocks.notify.mockRejectedValueOnce(new Error("Notification unavailable"));
    expect(await caller().videoProject.save(edit)).toEqual({ id: 77, action: "updated" }); expect(mocks.project.title).toBe(edit.title);
  });
  it("does not notify an owner about their own update", async () => {
    expect(await caller(1).videoProject.save(edit)).toEqual({ id: 77, action: "updated" }); expect(mocks.notify).not.toHaveBeenCalled();
  });
});
