import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock image generation
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/generated.png" }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ improved: "Enhanced prompt with cinematic lighting", suggestions: ["Add more detail", "Specify style"] }) } }],
  }),
}));

// Mock dbExtended
vi.mock("./dbExtended", () => ({
  toggleLike: vi.fn().mockResolvedValue({ liked: true, count: 5 }),
  getLikeStatus: vi.fn().mockResolvedValue({ liked: true }),
  getLikeCounts: vi.fn().mockResolvedValue([{ galleryItemId: 1, count: 5 }]),
  addComment: vi.fn().mockResolvedValue({ id: 1, content: "Great work!", createdAt: new Date() }),
  getComments: vi.fn().mockResolvedValue([{ id: 1, content: "Great work!", userId: 1, createdAt: new Date() }]),
  deleteComment: vi.fn().mockResolvedValue({ success: true }),
  toggleFollow: vi.fn().mockResolvedValue({ following: true }),
  getFollowStatus: vi.fn().mockResolvedValue({ following: true }),
  getFollowingFeed: vi.fn().mockResolvedValue([]),
  createCharacter: vi.fn().mockResolvedValue({ id: 1, name: "Hero", userId: 1, createdAt: new Date() }),
  listCharacters: vi.fn().mockResolvedValue([{ id: 1, name: "Hero", userId: 1, description: "A brave hero", referenceImages: [], styleNotes: "anime style", createdAt: new Date() }]),
  getCharacter: vi.fn().mockResolvedValue({ id: 1, name: "Hero", userId: 1, description: "A brave hero", referenceImages: [], styleNotes: "anime style", createdAt: new Date() }),
  updateCharacter: vi.fn().mockResolvedValue({ success: true }),
  deleteCharacter: vi.fn().mockResolvedValue({ success: true }),
  createBrandKit: vi.fn().mockResolvedValue({ id: 1, name: "My Brand", userId: 1, createdAt: new Date() }),
  listBrandKits: vi.fn().mockResolvedValue([{ id: 1, name: "My Brand", userId: 1, colorPalette: ["#000", "#fff"], stylePrompt: "cinematic", typography: "Inter", createdAt: new Date() }]),
  getBrandKit: vi.fn().mockResolvedValue({ id: 1, name: "My Brand", userId: 1, colorPalette: ["#000", "#fff"], stylePrompt: "cinematic", typography: "Inter", createdAt: new Date() }),
  updateBrandKit: vi.fn().mockResolvedValue({ success: true }),
  deleteBrandKit: vi.fn().mockResolvedValue({ success: true }),
  createApiKey: vi.fn().mockResolvedValue({ id: 1 }),
  listApiKeys: vi.fn().mockResolvedValue([{ id: 1, name: "Test Key", keyPrefix: "df_abc12345", active: true, lastUsedAt: null, createdAt: new Date() }]),
  revokeApiKey: vi.fn().mockResolvedValue({ success: true }),
  deleteApiKey: vi.fn().mockResolvedValue({ success: true }),
  getApiKeyByHash: vi.fn().mockResolvedValue(null),
  createSceneKeyframe: vi.fn().mockResolvedValue({ id: 1 }),
  listSceneKeyframes: vi.fn().mockResolvedValue([{ id: 1, projectId: 1, sceneIndex: 0, prompt: "test", status: "completed", imageUrl: "https://cdn.example.com/kf.png" }]),
  updateSceneKeyframe: vi.fn().mockResolvedValue({ success: true }),
  deleteSceneKeyframes: vi.fn().mockResolvedValue({ success: true }),
  searchGenerations: vi.fn().mockResolvedValue({ items: [{ id: 1, prompt: "test", imageUrl: "https://cdn.example.com/img.png", mediaType: "image", status: "completed", createdAt: new Date() }], total: 1 }),
}));

// Mock db (for getVideoProject)
vi.mock("./db", () => ({
  getVideoProject: vi.fn().mockResolvedValue({ id: 1, userId: 1, title: "Test Project", type: "storyboard", data: "{}" }),
}));

import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
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

describe("Extended Features (P0-P11)", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  // ─── P0: Video Generation ─────────────────────────────────────────
  describe("videoGen.generateKeyframes", () => {
    it("should generate keyframes for a project", async () => {
      const result = await caller.videoGen.generateKeyframes({
        projectId: 1,
        scenes: [
          { index: 0, prompt: "A hero stands on a cliff at sunset" },
          { index: 1, prompt: "The hero draws a sword" },
        ],
      });
      expect(result.status).toBe("generating");
      expect(result.keyframeIds).toHaveLength(2);
    });
  });

  describe("videoGen.getKeyframes", () => {
    it("should return keyframes for a project", async () => {
      const result = await caller.videoGen.getKeyframes({ projectId: 1 });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("status");
    });
  });

  describe("videoGen.regenerateKeyframe", () => {
    it("should regenerate a single keyframe", async () => {
      const result = await caller.videoGen.regenerateKeyframe({
        projectId: 1,
        keyframeId: 1,
        prompt: "Updated scene description",
      });
      expect(result.status).toBe("generating");
    });
  });

  // ─── P3: Social Features ──────────────────────────────────────────
  describe("social.toggleLike", () => {
    it("should toggle like on a gallery item", async () => {
      const result = await caller.social.toggleLike({ galleryItemId: 1 });
      expect(result).toHaveProperty("liked");
      expect(result).toHaveProperty("count");
    });
  });

  describe("social.getLikeStatus", () => {
    it("should return like status", async () => {
      const result = await caller.social.getLikeStatus({ galleryItemId: 1 });
      expect(result).toHaveProperty("liked");
    });
  });

  describe("social.getLikeCounts", () => {
    it("should return like counts for multiple items", async () => {
      const publicCaller = appRouter.createCaller({} as any);
      const result = await publicCaller.social.getLikeCounts({ galleryItemIds: [1, 2, 3] });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("social.addComment", () => {
    it("should add a comment to a gallery item", async () => {
      const result = await caller.social.addComment({
        galleryItemId: 1,
        content: "Great work!",
      });
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("content");
    });
  });

  describe("social.getComments", () => {
    it("should return comments for a gallery item", async () => {
      const publicCaller = appRouter.createCaller({} as any);
      const result = await publicCaller.social.getComments({ galleryItemId: 1 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("social.deleteComment", () => {
    it("should delete a comment", async () => {
      const result = await caller.social.deleteComment({ commentId: 1 });
      expect(result).toHaveProperty("success");
    });
  });

  describe("social.toggleFollow", () => {
    it("should toggle follow on a user", async () => {
      const result = await caller.social.toggleFollow({ userId: 2 });
      expect(result).toHaveProperty("following");
    });

    it("should reject following yourself", async () => {
      await expect(caller.social.toggleFollow({ userId: 1 })).rejects.toThrow();
    });
  });

  describe("social.getFollowStatus", () => {
    it("should return follow status", async () => {
      const result = await caller.social.getFollowStatus({ userId: 2 });
      expect(result).toHaveProperty("following");
    });
  });

  // ─── P4: Character Consistency ────────────────────────────────────
  describe("character.create", () => {
    it("should create a character", async () => {
      const result = await caller.character.create({
        name: "Hero",
        description: "A brave hero with golden armor",
        styleNotes: "anime style, vibrant colors",
      });
      expect(result).toHaveProperty("id");
    });
  });

  describe("character.list", () => {
    it("should list user's characters", async () => {
      const result = await caller.character.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("name");
    });
  });

  describe("character.get", () => {
    it("should get a specific character", async () => {
      const result = await caller.character.get({ id: 1 });
      expect(result.name).toBe("Hero");
    });
  });

  describe("character.update", () => {
    it("should update a character", async () => {
      const result = await caller.character.update({
        id: 1,
        name: "Updated Hero",
        description: "An updated hero",
      });
      expect(result).toHaveProperty("success");
    });
  });

  describe("character.delete", () => {
    it("should delete a character", async () => {
      const result = await caller.character.delete({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });

  describe("character.generateWithCharacter", () => {
    it("should generate an image using character details", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/char-gen.png" });
      const result = await caller.character.generateWithCharacter({
        characterId: 1,
        prompt: "Standing in a forest clearing",
      });
      expect(result.url).toBe("https://cdn.example.com/char-gen.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Hero"),
        })
      );
    });
  });

  // ─── P5: Multi-Model ──────────────────────────────────────────────
  describe("models.list", () => {
    it("should return available models", async () => {
      const publicCaller = appRouter.createCaller({} as any);
      const result = await publicCaller.models.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("speed");
      expect(result[0]).toHaveProperty("quality");
    });
  });

  describe("models.compare", () => {
    it("should compare outputs across multiple models", async () => {
      vi.mocked(generateImage)
        .mockResolvedValueOnce({ url: "https://cdn.example.com/model1.png" })
        .mockResolvedValueOnce({ url: "https://cdn.example.com/model2.png" });

      const result = await caller.models.compare({
        prompt: "A beautiful sunset",
        modelIds: ["default", "artistic"],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("modelId");
      expect(result[0]).toHaveProperty("url");
    });
  });

  // ─── P7: Prompt Assistant ─────────────────────────────────────────
  describe("promptAssist.improve", () => {
    it("should improve a prompt with AI", async () => {
      const result = await caller.promptAssist.improve({
        prompt: "a cat",
        style: "cinematic",
        mood: "dramatic",
      });
      expect(result).toHaveProperty("improved");
      expect(result).toHaveProperty("suggestions");
      expect(invokeLLM).toHaveBeenCalled();
    });
  });

  describe("promptAssist.suggest", () => {
    it("should suggest creative prompts", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ suggestions: [{ prompt: "A dragon", category: "subject", preview: "Epic dragon" }] }) } }],
      } as any);
      const result = await caller.promptAssist.suggest({ category: "subject" });
      expect(result).toHaveProperty("suggestions");
    });
  });

  // ─── P8: Brand Kits ───────────────────────────────────────────────
  describe("brandKit.create", () => {
    it("should create a brand kit", async () => {
      const result = await caller.brandKit.create({
        name: "My Brand",
        colorPalette: ["#000000", "#ffffff"],
        stylePrompt: "cinematic lighting",
        typography: "Inter",
      });
      expect(result).toHaveProperty("id");
    });
  });

  describe("brandKit.list", () => {
    it("should list user's brand kits", async () => {
      const result = await caller.brandKit.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("colorPalette");
    });
  });

  describe("brandKit.get", () => {
    it("should get a specific brand kit", async () => {
      const result = await caller.brandKit.get({ id: 1 });
      expect(result.name).toBe("My Brand");
    });
  });

  describe("brandKit.update", () => {
    it("should update a brand kit", async () => {
      const result = await caller.brandKit.update({
        id: 1,
        name: "Updated Brand",
        colorPalette: ["#ff0000", "#00ff00"],
      });
      expect(result).toHaveProperty("success");
    });
  });

  describe("brandKit.delete", () => {
    it("should delete a brand kit", async () => {
      const result = await caller.brandKit.delete({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });

  describe("brandKit.presets", () => {
    it("should return built-in style presets", async () => {
      const publicCaller = appRouter.createCaller({} as any);
      const result = await publicCaller.brandKit.presets();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("prompt");
      expect(result[0]).toHaveProperty("colors");
    });
  });

  // ─── P9: Smart Search ─────────────────────────────────────────────
  describe("search.generations", () => {
    it("should search generations by query", async () => {
      const result = await caller.search.generations({ query: "sunset" });
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
    });

    it("should filter by media type", async () => {
      const result = await caller.search.generations({ mediaType: "image" });
      expect(result).toHaveProperty("items");
    });

    it("should support pagination", async () => {
      const result = await caller.search.generations({ limit: 10, offset: 20 });
      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
    });
  });

  // ─── P11: API Keys ────────────────────────────────────────────────
  describe("apiKey.create", () => {
    it("should create an API key and return the raw key", async () => {
      const result = await caller.apiKey.create({ name: "Test Key" });
      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("prefix");
      expect(result.key).toMatch(/^df_/);
      expect(result.prefix).toMatch(/^df_/);
    });
  });

  describe("apiKey.list", () => {
    it("should list user's API keys", async () => {
      const result = await caller.apiKey.list();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("keyPrefix");
      expect(result[0]).toHaveProperty("active");
    });
  });

  describe("apiKey.revoke", () => {
    it("should revoke an API key", async () => {
      const result = await caller.apiKey.revoke({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });

  describe("apiKey.delete", () => {
    it("should delete an API key", async () => {
      const result = await caller.apiKey.delete({ id: 1 });
      expect(result).toHaveProperty("success");
    });
  });
});
