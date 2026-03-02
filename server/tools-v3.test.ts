import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the image generation helper
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/result.png" }),
}));

// Mock the LLM helper
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "mocked response" } }],
  }),
}));

import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { appRouter } from "./routers";

const mockCtx = {
  user: {
    id: 1,
    openId: "test-user-v3",
    name: "Test Creator",
    email: "test@dreamforge.ai",
    role: "user" as const,
    createdAt: new Date(),
  },
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const caller = appRouter.createCaller(mockCtx as any);

describe("AI Tools Suite V3 — New Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mocks
    vi.mocked(generateImage).mockResolvedValue({ url: "https://cdn.example.com/result.png" });
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "mocked response" } }],
    } as any);
  });

  // ─── Outpainting / Image Expander ──────────────────────────────
  describe("tools.outpaint", () => {
    it("should expand an image to the right", async () => {
      const result = await caller.tools.outpaint({
        imageUrl: "https://example.com/photo.png",
        direction: "right",
        expansionSize: "medium",
        fillDescription: "a lush forest continuing into the distance",
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/result.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("right"),
          originalImages: [{ url: "https://example.com/photo.png", mimeType: "image/png" }],
        })
      );
    });

    it("should use default fill for 'all' direction", async () => {
      const result = await caller.tools.outpaint({
        imageUrl: "https://example.com/photo.png",
        direction: "all",
        expansionSize: "large",
      });

      expect(result.status).toBe("completed");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("all directions"),
        })
      );
    });

    it("should handle failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Timeout"));

      const result = await caller.tools.outpaint({
        imageUrl: "https://example.com/photo.png",
        direction: "up",
        expansionSize: "small",
      });

      expect(result.status).toBe("failed");
      expect(result.url).toBeNull();
      expect(result.error).toBe("Timeout");
    });

    it("should reject invalid URL", async () => {
      await expect(
        caller.tools.outpaint({
          imageUrl: "not-a-url",
          direction: "right",
          expansionSize: "medium",
        })
      ).rejects.toThrow();
    });
  });

  // ─── Object Eraser ─────────────────────────────────────────────
  describe("tools.eraseObject", () => {
    it("should erase an object from an image", async () => {
      const result = await caller.tools.eraseObject({
        imageUrl: "https://example.com/photo.png",
        objectDescription: "the red car in the background",
        fillMethod: "auto",
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/result.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("red car"),
        })
      );
    });

    it("should use default fill method", async () => {
      const result = await caller.tools.eraseObject({
        imageUrl: "https://example.com/photo.png",
        objectDescription: "the person on the left",
      });

      expect(result.status).toBe("completed");
    });

    it("should handle failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("API error"));

      const result = await caller.tools.eraseObject({
        imageUrl: "https://example.com/photo.png",
        objectDescription: "the tree",
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("API error");
    });
  });

  // ─── AI Text Effects ───────────────────────────────────────────
  describe("tools.textEffects", () => {
    it("should generate text with fire effect", async () => {
      const result = await caller.tools.textEffects({
        text: "DREAMFORGE",
        effect: "fire",
        background: "dark",
        size: "large",
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/result.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("DREAMFORGE"),
        })
      );
    });

    it("should handle all 10 effect types", async () => {
      const effects = ["fire", "neon", "gold", "ice", "nature", "galaxy", "chrome", "graffiti", "crystal", "water"] as const;

      for (const effect of effects) {
        vi.mocked(generateImage).mockResolvedValueOnce({ url: `https://cdn.example.com/${effect}.png` });
        const result = await caller.tools.textEffects({ text: "TEST", effect });
        expect(result.status).toBe("completed");
      }
    });

    it("should reject empty text", async () => {
      await expect(
        caller.tools.textEffects({ text: "", effect: "fire" })
      ).rejects.toThrow();
    });

    it("should handle failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Generation failed"));

      const result = await caller.tools.textEffects({ text: "HELLO", effect: "neon" });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Generation failed");
    });
  });

  // ─── Image Blender ─────────────────────────────────────────────
  describe("tools.blendImages", () => {
    it("should blend two images with merge mode", async () => {
      const result = await caller.tools.blendImages({
        imageUrl1: "https://example.com/photo1.png",
        imageUrl2: "https://example.com/photo2.png",
        blendMode: "merge",
        strength: 0.5,
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/result.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          originalImages: expect.arrayContaining([
            { url: "https://example.com/photo1.png", mimeType: "image/png" },
            { url: "https://example.com/photo2.png", mimeType: "image/png" },
          ]),
        })
      );
    });

    it("should support double-exposure blend mode", async () => {
      const result = await caller.tools.blendImages({
        imageUrl1: "https://example.com/photo1.png",
        imageUrl2: "https://example.com/photo2.png",
        blendMode: "double-exposure",
      });

      expect(result.status).toBe("completed");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("double-exposure"),
        })
      );
    });

    it("should handle failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Blend failed"));

      const result = await caller.tools.blendImages({
        imageUrl1: "https://example.com/photo1.png",
        imageUrl2: "https://example.com/photo2.png",
        blendMode: "morph",
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Blend failed");
    });

    it("should reject invalid URLs", async () => {
      await expect(
        caller.tools.blendImages({
          imageUrl1: "not-a-url",
          imageUrl2: "https://example.com/photo2.png",
          blendMode: "merge",
        })
      ).rejects.toThrow();
    });
  });

  // ─── Sketch to Image ──────────────────────────────────────────
  describe("tools.sketchToImage", () => {
    it("should convert a sketch to a realistic image", async () => {
      const result = await caller.tools.sketchToImage({
        imageUrl: "https://example.com/sketch.png",
        description: "a cozy cabin in the woods",
        outputStyle: "realistic",
        detailLevel: "high",
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/result.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("cozy cabin"),
          originalImages: [{ url: "https://example.com/sketch.png", mimeType: "image/png" }],
        })
      );
    });

    it("should use default output style and detail level", async () => {
      const result = await caller.tools.sketchToImage({
        imageUrl: "https://example.com/sketch.png",
        description: "a mountain landscape",
      });

      expect(result.status).toBe("completed");
    });

    it("should handle failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Conversion failed"));

      const result = await caller.tools.sketchToImage({
        imageUrl: "https://example.com/sketch.png",
        description: "a robot",
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Conversion failed");
    });
  });

  // ─── AI Color Grading ─────────────────────────────────────────
  describe("tools.colorGrade", () => {
    it("should apply cinematic color grade", async () => {
      const result = await caller.tools.colorGrade({
        imageUrl: "https://example.com/photo.png",
        grade: "cinematic",
        intensity: 0.7,
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/result.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("cinematic"),
          originalImages: [{ url: "https://example.com/photo.png", mimeType: "image/png" }],
        })
      );
    });

    it("should handle all 10 grade presets", async () => {
      const grades = ["cinematic", "vintage", "moody", "bright", "noir", "sunset", "teal-orange", "pastel", "dramatic", "film-noir"] as const;

      for (const grade of grades) {
        vi.mocked(generateImage).mockResolvedValueOnce({ url: `https://cdn.example.com/${grade}.png` });
        const result = await caller.tools.colorGrade({
          imageUrl: "https://example.com/photo.png",
          grade,
          intensity: 0.5,
        });
        expect(result.status).toBe("completed");
      }
    });

    it("should reject intensity out of range", async () => {
      await expect(
        caller.tools.colorGrade({
          imageUrl: "https://example.com/photo.png",
          grade: "cinematic",
          intensity: 2.0,
        })
      ).rejects.toThrow();
    });

    it("should handle failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Grading failed"));

      const result = await caller.tools.colorGrade({
        imageUrl: "https://example.com/photo.png",
        grade: "noir",
        intensity: 0.5,
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("Grading failed");
    });
  });
});
