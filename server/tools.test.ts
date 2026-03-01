import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock the image generation helper
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/result.png" }),
}));

// Mock the LLM helper
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "A majestic dragon perched on a crystal mountain, oil painting style, dramatic golden hour lighting, wide landscape composition, warm earth tones, intricate scales and armor, high quality, detailed, professional." } }],
  }),
}));

import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";

// Import the router for direct procedure calls
import { appRouter } from "./routers";

// Create a mock authenticated context
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

describe("AI Tools Suite", () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  // ─── Image Upscaler ─────────────────────────────────────────────
  describe("tools.upscale", () => {
    it("should upscale an image at 2x with detail enhancement", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/upscaled-2x.png" });

      const result = await caller.tools.upscale({
        imageUrl: "https://example.com/photo.png",
        scaleFactor: "2x",
        enhanceDetails: true,
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/upscaled-2x.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("high resolution 2K"),
          originalImages: [{ url: "https://example.com/photo.png", mimeType: "image/png" }],
        })
      );
    });

    it("should upscale an image at 4x", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/upscaled-4x.png" });

      const result = await caller.tools.upscale({
        imageUrl: "https://example.com/photo.png",
        scaleFactor: "4x",
        enhanceDetails: false,
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/upscaled-4x.png");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("ultra high resolution 4K"),
        })
      );
    });

    it("should include detail enhancement text when enabled", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/enhanced.png" });

      await caller.tools.upscale({
        imageUrl: "https://example.com/photo.png",
        scaleFactor: "2x",
        enhanceDetails: true,
      });

      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("enhanced fine details"),
        })
      );
    });

    it("should handle generateImage failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Service unavailable"));

      const result = await caller.tools.upscale({
        imageUrl: "https://example.com/photo.png",
        scaleFactor: "2x",
        enhanceDetails: true,
      });

      expect(result.status).toBe("failed");
      expect(result.url).toBeNull();
      expect(result.error).toBe("Service unavailable");
    });

    it("should reject invalid URL", async () => {
      await expect(
        caller.tools.upscale({
          imageUrl: "not-a-url",
          scaleFactor: "2x",
          enhanceDetails: true,
        })
      ).rejects.toThrow();
    });
  });

  // ─── Style Transfer ─────────────────────────────────────────────
  describe("tools.styleTransfer", () => {
    it("should apply oil-painting style to an image", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/oil-painting.png" });

      const result = await caller.tools.styleTransfer({
        imageUrl: "https://example.com/photo.png",
        style: "oil-painting",
        intensity: 0.7,
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/oil-painting.png");
      expect(result.style).toBe("oil-painting");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("oil painting"),
          originalImages: [{ url: "https://example.com/photo.png", mimeType: "image/png" }],
        })
      );
    });

    it("should apply anime style with strong intensity", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/anime.png" });

      const result = await caller.tools.styleTransfer({
        imageUrl: "https://example.com/photo.png",
        style: "anime",
        intensity: 0.9,
      });

      expect(result.status).toBe("completed");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("strongly"),
        })
      );
    });

    it("should apply subtle intensity label for low values", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/subtle.png" });

      await caller.tools.styleTransfer({
        imageUrl: "https://example.com/photo.png",
        style: "watercolor",
        intensity: 0.2,
      });

      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("subtly"),
        })
      );
    });

    it("should handle all 10 style options", async () => {
      const styles = [
        "oil-painting", "watercolor", "pencil-sketch", "anime", "pop-art",
        "cyberpunk", "art-nouveau", "pixel-art", "impressionist", "comic-book",
      ] as const;

      for (const style of styles) {
        vi.mocked(generateImage).mockResolvedValueOnce({ url: `https://cdn.example.com/${style}.png` });
        const result = await caller.tools.styleTransfer({
          imageUrl: "https://example.com/photo.png",
          style,
          intensity: 0.5,
        });
        expect(result.status).toBe("completed");
      }
    });

    it("should reject invalid style", async () => {
      await expect(
        caller.tools.styleTransfer({
          imageUrl: "https://example.com/photo.png",
          style: "invalid-style" as any,
          intensity: 0.5,
        })
      ).rejects.toThrow();
    });

    it("should reject intensity out of range", async () => {
      await expect(
        caller.tools.styleTransfer({
          imageUrl: "https://example.com/photo.png",
          style: "anime",
          intensity: 1.5,
        })
      ).rejects.toThrow();
    });

    it("should handle generateImage failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Timeout"));

      const result = await caller.tools.styleTransfer({
        imageUrl: "https://example.com/photo.png",
        style: "cyberpunk",
        intensity: 0.7,
      });

      expect(result.status).toBe("failed");
      expect(result.url).toBeNull();
      expect(result.error).toBe("Timeout");
    });
  });

  // ─── Background Editor ──────────────────────────────────────────
  describe("tools.backgroundEdit", () => {
    it("should remove background from an image", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/no-bg.png" });

      const result = await caller.tools.backgroundEdit({
        imageUrl: "https://example.com/photo.png",
        mode: "remove",
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/no-bg.png");
      expect(result.mode).toBe("remove");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("Remove the background"),
        })
      );
    });

    it("should replace background with custom prompt", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/new-bg.png" });

      const result = await caller.tools.backgroundEdit({
        imageUrl: "https://example.com/photo.png",
        mode: "replace",
        replacementPrompt: "tropical beach at sunset",
      });

      expect(result.status).toBe("completed");
      expect(result.mode).toBe("replace");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("tropical beach at sunset"),
        })
      );
    });

    it("should use default backdrop when no replacement prompt given", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/default-bg.png" });

      await caller.tools.backgroundEdit({
        imageUrl: "https://example.com/photo.png",
        mode: "replace",
      });

      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("professional studio backdrop"),
        })
      );
    });

    it("should reject invalid mode", async () => {
      await expect(
        caller.tools.backgroundEdit({
          imageUrl: "https://example.com/photo.png",
          mode: "blur" as any,
        })
      ).rejects.toThrow();
    });

    it("should handle generateImage failure gracefully", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Rate limited"));

      const result = await caller.tools.backgroundEdit({
        imageUrl: "https://example.com/photo.png",
        mode: "remove",
      });

      expect(result.status).toBe("failed");
      expect(result.url).toBeNull();
      expect(result.error).toBe("Rate limited");
    });
  });

  // ─── Smart Prompt Builder ───────────────────────────────────────
  describe("tools.buildPrompt", () => {
    it("should build a prompt from subject only", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: "A majestic dragon with iridescent scales, highly detailed, professional quality." } }],
      } as any);

      const result = await caller.tools.buildPrompt({
        subject: "A majestic dragon",
      });

      expect(result.status).toBe("completed");
      expect(result.prompt).toContain("dragon");
      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user", content: expect.stringContaining("A majestic dragon") }),
          ]),
        })
      );
    });

    it("should include all optional fields in the LLM input", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: "Full prompt with all details." } }],
      } as any);

      await caller.tools.buildPrompt({
        subject: "A warrior",
        style: "Fantasy",
        mood: "Epic",
        lighting: "Golden Hour",
        composition: "Wide Landscape",
        colorPalette: "Warm Tones",
        additionalDetails: "intricate armor",
      });

      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringMatching(/Subject: A warrior[\s\S]*Style: Fantasy[\s\S]*Mood\/Atmosphere: Epic[\s\S]*Lighting: Golden Hour[\s\S]*Composition: Wide Landscape[\s\S]*Color Palette: Warm Tones[\s\S]*Additional Details: intricate armor/),
            }),
          ]),
        })
      );
    });

    it("should fallback to basic prompt when LLM fails", async () => {
      vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM unavailable"));

      const result = await caller.tools.buildPrompt({
        subject: "A sunset over mountains",
        style: "Watercolor",
        mood: "Serene",
      });

      expect(result.status).toBe("completed");
      expect(result.prompt).toContain("A sunset over mountains");
      expect(result.prompt).toContain("Watercolor");
      expect(result.prompt).toContain("Serene");
      expect(result.prompt).toContain("High quality");
    });

    it("should reject empty subject", async () => {
      await expect(
        caller.tools.buildPrompt({ subject: "" })
      ).rejects.toThrow();
    });

    it("should reject subject exceeding max length", async () => {
      await expect(
        caller.tools.buildPrompt({ subject: "x".repeat(501) })
      ).rejects.toThrow();
    });

    it("should omit null optional fields from LLM input", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: "Simple prompt." } }],
      } as any);

      await caller.tools.buildPrompt({
        subject: "A cat",
        mood: "Peaceful",
      });

      const callArgs = vi.mocked(invokeLLM).mock.calls.at(-1)?.[0];
      const userContent = (callArgs as any)?.messages?.find((m: any) => m.role === "user")?.content;
      expect(userContent).toContain("Subject: A cat");
      expect(userContent).toContain("Mood/Atmosphere: Peaceful");
      expect(userContent).not.toContain("Style:");
      expect(userContent).not.toContain("Lighting:");
    });
  });
});
