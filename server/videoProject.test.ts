import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the image generation helper
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/result.png" }),
}));

// Mock the LLM helper
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "{}" } }],
  }),
}));

// Mock the db functions for video projects
const mockCreateVideoProject = vi.fn();
const mockUpdateVideoProject = vi.fn();
const mockGetVideoProject = vi.fn();
const mockListVideoProjects = vi.fn();
const mockDeleteVideoProject = vi.fn();
const mockCreateRevision = vi.fn();
const mockGetLatestRevisionVersion = vi.fn();
const mockGetUserCollaboratorRole = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    createVideoProject: (...args: any[]) => mockCreateVideoProject(...args),
    updateVideoProject: (...args: any[]) => mockUpdateVideoProject(...args),
    getVideoProject: (...args: any[]) => mockGetVideoProject(...args),
    listVideoProjects: (...args: any[]) => mockListVideoProjects(...args),
    deleteVideoProject: (...args: any[]) => mockDeleteVideoProject(...args),
    createRevision: (...args: any[]) => mockCreateRevision(...args),
    getLatestRevisionVersion: (...args: any[]) => mockGetLatestRevisionVersion(...args),
    getUserCollaboratorRole: (...args: any[]) => mockGetUserCollaboratorRole(...args),
  };
});

import { appRouter } from "./routers";

const mockCtx = {
  user: {
    id: 1,
    openId: "test-user-123",
    name: "Test Creator",
    email: "test@dreamforge.ai",
    role: "user" as const,
    createdAt: new Date(),
  },
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const caller = appRouter.createCaller(mockCtx as any);

describe("Video Project CRUD & Templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Save (Create) ────────────────────────────────────────────
  describe("videoProject.save (create)", () => {
    it("should create a new storyboard project", async () => {
      mockCreateVideoProject.mockResolvedValueOnce({ id: 42 });

      const result = await caller.videoProject.save({
        type: "storyboard",
        title: "Mars Expedition Storyboard",
        description: "A 6-scene storyboard about Mars exploration",
        data: { title: "Mars Expedition", scenes: [{ sceneNumber: 1 }] },
      });

      expect(result.id).toBe(42);
      expect(result.action).toBe("created");
      expect(mockCreateVideoProject).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "storyboard",
          title: "Mars Expedition Storyboard",
          description: "A 6-scene storyboard about Mars exploration",
        })
      );
    });

    it("should create a script project", async () => {
      mockCreateVideoProject.mockResolvedValueOnce({ id: 43 });

      const result = await caller.videoProject.save({
        type: "script",
        title: "Product Launch Script",
        data: { title: "Launch", scenes: [] },
      });

      expect(result.id).toBe(43);
      expect(result.action).toBe("created");
    });

    it("should create a scene-direction project", async () => {
      mockCreateVideoProject.mockResolvedValueOnce({ id: 44 });

      const result = await caller.videoProject.save({
        type: "scene-direction",
        title: "Battle Scene Direction",
        data: { sceneTitle: "The Final Stand", keyframes: [] },
      });

      expect(result.id).toBe(44);
      expect(result.action).toBe("created");
    });

    it("should create a soundtrack project", async () => {
      mockCreateVideoProject.mockResolvedValueOnce({ id: 45 });

      const result = await caller.videoProject.save({
        type: "soundtrack",
        title: "Soundtrack: Orchestral Cinematic",
        data: { primaryGenre: "Orchestral Cinematic" },
      });

      expect(result.id).toBe(45);
      expect(result.action).toBe("created");
    });

    it("should include optional templateId when provided", async () => {
      mockCreateVideoProject.mockResolvedValueOnce({ id: 46 });

      await caller.videoProject.save({
        type: "storyboard",
        title: "From Template",
        data: {},
        templateId: "product-launch",
      });

      expect(mockCreateVideoProject).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "product-launch" })
      );
    });
  });

  // ─── Save (Update) ────────────────────────────────────────────
  describe("videoProject.save (update)", () => {
    it("should update an existing project", async () => {
      // getVideoProject is called to check ownership
      mockGetVideoProject.mockResolvedValueOnce({ id: 42, userId: 1, type: "storyboard" });
      // getLatestRevisionVersion for auto-revision
      mockGetLatestRevisionVersion.mockResolvedValueOnce(1);
      mockCreateRevision.mockResolvedValueOnce({ id: 200 });
      mockUpdateVideoProject.mockResolvedValueOnce({ success: true });

      const result = await caller.videoProject.save({
        id: 42,
        type: "storyboard",
        title: "Updated Mars Storyboard",
        description: "Updated description",
        data: { title: "Updated", scenes: [{ sceneNumber: 1 }, { sceneNumber: 2 }] },
      });

      expect(result.id).toBe(42);
      expect(result.action).toBe("updated");
      expect(mockUpdateVideoProject).toHaveBeenCalledWith(42, 1, {
        title: "Updated Mars Storyboard",
        description: "Updated description",
        data: expect.any(Object),
        thumbnailUrl: undefined,
      });
    });
  });

  // ─── List ─────────────────────────────────────────────────────
  describe("videoProject.list", () => {
    it("should list all user projects", async () => {
      mockListVideoProjects.mockResolvedValueOnce({
        projects: [
          { id: 1, type: "storyboard", title: "Project A", createdAt: new Date(), updatedAt: new Date() },
          { id: 2, type: "script", title: "Project B", createdAt: new Date(), updatedAt: new Date() },
        ],
        total: 2,
      });

      const result = await caller.videoProject.list();

      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockListVideoProjects).toHaveBeenCalledWith(1, undefined);
    });

    it("should filter by type", async () => {
      mockListVideoProjects.mockResolvedValueOnce({
        projects: [{ id: 1, type: "storyboard", title: "Storyboard A" }],
        total: 1,
      });

      const result = await caller.videoProject.list({ type: "storyboard" });

      expect(result.projects).toHaveLength(1);
      expect(mockListVideoProjects).toHaveBeenCalledWith(1, { type: "storyboard" });
    });

    it("should support pagination", async () => {
      mockListVideoProjects.mockResolvedValueOnce({
        projects: [],
        total: 25,
      });

      const result = await caller.videoProject.list({ limit: 10, offset: 20 });

      expect(mockListVideoProjects).toHaveBeenCalledWith(1, { limit: 10, offset: 20 });
    });
  });

  // ─── Get ──────────────────────────────────────────────────────
  describe("videoProject.get", () => {
    it("should return a project by id", async () => {
      mockGetVideoProject.mockResolvedValueOnce({
        id: 42,
        userId: 1,
        type: "storyboard",
        title: "Mars Storyboard",
        data: { title: "Mars", scenes: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await caller.videoProject.get({ id: 42 });

      expect(result.id).toBe(42);
      expect(result.title).toBe("Mars Storyboard");
      expect(mockGetVideoProject).toHaveBeenCalledWith(42, 1);
    });

    it("should throw NOT_FOUND for nonexistent project", async () => {
      mockGetVideoProject.mockResolvedValueOnce(null);

      await expect(caller.videoProject.get({ id: 999 })).rejects.toThrow("Project not found");
    });
  });

  // ─── Delete ───────────────────────────────────────────────────
  describe("videoProject.delete", () => {
    it("should delete a project", async () => {
      mockDeleteVideoProject.mockResolvedValueOnce({ success: true });

      const result = await caller.videoProject.delete({ id: 42 });

      expect(result.success).toBe(true);
      expect(mockDeleteVideoProject).toHaveBeenCalledWith(42, 1);
    });
  });

  // ─── Export Data ──────────────────────────────────────────────
  describe("videoProject.exportData", () => {
    it("should return structured export data", async () => {
      const now = new Date();
      mockGetVideoProject.mockResolvedValueOnce({
        id: 42,
        userId: 1,
        type: "storyboard",
        title: "Mars Storyboard",
        description: "A storyboard about Mars",
        data: { title: "Mars", scenes: [{ sceneNumber: 1 }] },
        createdAt: now,
        updatedAt: now,
      });

      const result = await caller.videoProject.exportData({ id: 42 });

      expect(result.id).toBe(42);
      expect(result.type).toBe("storyboard");
      expect(result.title).toBe("Mars Storyboard");
      expect(result.data).toBeDefined();
      expect(result.createdAt).toEqual(now);
    });

    it("should throw NOT_FOUND for nonexistent project", async () => {
      mockGetVideoProject.mockResolvedValueOnce(null);

      await expect(caller.videoProject.exportData({ id: 999 })).rejects.toThrow("Project not found");
    });
  });

  // ─── Templates ────────────────────────────────────────────────
  describe("videoProject.templates", () => {
    it("should return all templates when no category filter", async () => {
      const result = await caller.videoProject.templates({});

      expect(result.length).toBeGreaterThan(0);
      // Each template should have required fields
      result.forEach((t: any) => {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(t.toolType).toBeTruthy();
        expect(t.icon).toBeTruthy();
        expect(t.prefill).toBeDefined();
      });
    });

    it("should filter templates by category", async () => {
      const result = await caller.videoProject.templates({ category: "commercial" });

      expect(result.length).toBeGreaterThan(0);
      result.forEach((t: any) => {
        expect(t.category).toBe("commercial");
      });
    });

    it("should return empty array for nonexistent category", async () => {
      const result = await caller.videoProject.templates({ category: "nonexistent" });

      expect(result).toHaveLength(0);
    });
  });

  // ─── Get Template ─────────────────────────────────────────────
  describe("videoProject.getTemplate", () => {
    it("should return a specific template by id", async () => {
      const result = await caller.videoProject.getTemplate({ id: "product-launch" });

      expect(result.id).toBe("product-launch");
      expect(result.name).toBeTruthy();
      expect(result.prefill).toBeDefined();
    });

    it("should throw NOT_FOUND for nonexistent template", async () => {
      await expect(caller.videoProject.getTemplate({ id: "nonexistent-template" })).rejects.toThrow("Template not found");
    });
  });
});
