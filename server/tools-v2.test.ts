import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock imageGeneration
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/generated.png" }),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            colors: [
              { hex: "#FF5733", name: "Flame Red", percentage: 35 },
              { hex: "#33FF57", name: "Spring Green", percentage: 25 },
              { hex: "#3357FF", name: "Royal Blue", percentage: 20 },
              { hex: "#F5F5DC", name: "Beige", percentage: 12 },
              { hex: "#2F2F2F", name: "Charcoal", percentage: 8 },
            ],
            mood: "Vibrant and energetic",
            complementary: [
              { hex: "#00C9A7", name: "Turquoise" },
              { hex: "#845EC2", name: "Purple" },
            ],
            harmonies: {
              analogous: ["#FF5733", "#FF8C33", "#FFB833"],
              triadic: ["#FF5733", "#33FF57", "#3357FF"],
              splitComplementary: ["#FF5733", "#33FFB8", "#3357FF"],
            },
          }),
        },
      },
    ],
  }),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/stored.png", key: "test-key" }),
}));
// Mock credit deduction (always succeeds in tests)
vi.mock('./stripe', () => ({
  deductCredits: vi.fn().mockResolvedValue({ success: true, remaining: 99 }),
  CREDIT_COSTS: {
    'text-to-image': 1, 'image-to-image': 1, 'upscale': 2, 'style-transfer': 2,
    'background-edit': 1, 'face-enhance': 2, 'batch-process': 5, 'animate': 3,
    'object-remove': 1, 'color-grade': 1, 'sketch-to-image': 1, 'image-merge': 2,
    'prompt-assist': 0, 'storyboard': 3, 'scene-director': 3, 'video-style-transfer': 3,
    'video-upscaler': 3, 'soundtrack-suggest': 1, 'text-to-video-script': 2,
  },
  getOrCreateBalance: vi.fn().mockResolvedValue({ balance: 100 }),
  getCreditHistory: vi.fn().mockResolvedValue([]),
  addCredits: vi.fn().mockResolvedValue(undefined),
  createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }),
  CREDIT_PACKAGES: [],
}));


import { appRouter } from "./routers";

const mockAuthCtx = {
  user: {
    id: 1,
    openId: "test-user-v2",
    name: "Test Creator",
    email: "test@dreamforge.ai",
    role: "user" as const,
    createdAt: new Date(),
  },
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const mockUnauthCtx = {
  user: null,
  setCookie: vi.fn(),
  clearCookie: vi.fn(),
};

const caller = appRouter.createCaller(mockAuthCtx as any);
const unauthCaller = appRouter.createCaller(mockUnauthCtx as any);

beforeAll(() => {
  vi.clearAllMocks();
});

describe("Tools V2 - Color Palette Extractor", () => {
  it("should require authentication", async () => {
    await expect(
      unauthCaller.tools.extractPalette({ imageUrl: "https://example.com/img.png" })
    ).rejects.toThrow();
  });

  it("should extract palette with default options", async () => {
    const result = await caller.tools.extractPalette({
      imageUrl: "https://example.com/img.png",
    });
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });

  it("should accept custom palette size", async () => {
    const result = await caller.tools.extractPalette({
      imageUrl: "https://example.com/img.png",
      paletteSize: 8,
    });
    expect(result).toBeDefined();
  });

  it("should accept includeComplementary option", async () => {
    const result = await caller.tools.extractPalette({
      imageUrl: "https://example.com/img.png",
      includeComplementary: false,
    });
    expect(result).toBeDefined();
  });

  it("should reject invalid palette size", async () => {
    await expect(
      caller.tools.extractPalette({
        imageUrl: "https://example.com/img.png",
        paletteSize: 20,
      })
    ).rejects.toThrow();
  });
});

describe("Tools V2 - Image Variations Generator", () => {
  it("should require authentication", async () => {
    await expect(
      unauthCaller.tools.generateVariations({
        imageUrl: "https://example.com/img.png",
        count: 3,
        variationType: "moderate",
      })
    ).rejects.toThrow();
  });

  it("should generate variations with default count", async () => {
    const result = await caller.tools.generateVariations({
      imageUrl: "https://example.com/img.png",
      count: 2,
      variationType: "subtle",
    });
    expect(result).toBeDefined();
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);
  });

  it("should support all variation types", async () => {
    for (const vt of ["subtle", "moderate", "dramatic", "style-mix"] as const) {
      const result = await caller.tools.generateVariations({
        imageUrl: "https://example.com/img.png",
        count: 2,
        variationType: vt,
      });
      expect(result.total).toBe(2);
    }
  });

  it("should reject count > 6", async () => {
    await expect(
      caller.tools.generateVariations({
        imageUrl: "https://example.com/img.png",
        count: 10,
        variationType: "moderate",
      })
    ).rejects.toThrow();
  });

  it("should reject count < 2", async () => {
    await expect(
      caller.tools.generateVariations({
        imageUrl: "https://example.com/img.png",
        count: 1,
        variationType: "moderate",
      })
    ).rejects.toThrow();
  });
});

describe("Tools V2 - Inpainting Editor", () => {
  it("should require authentication", async () => {
    await expect(
      unauthCaller.tools.inpaint({
        imageUrl: "https://example.com/img.png",
        editPrompt: "Add a hat",
      })
    ).rejects.toThrow();
  });

  it("should edit image with basic prompt", async () => {
    const result = await caller.tools.inpaint({
      imageUrl: "https://example.com/img.png",
      editPrompt: "Add a sunset sky",
    });
    expect(result).toBeDefined();
    expect(result.status).toBe("completed");
    expect(result.url).toBeDefined();
  });

  it("should accept optional region description", async () => {
    const result = await caller.tools.inpaint({
      imageUrl: "https://example.com/img.png",
      editPrompt: "Add flowers",
      regionDescription: "the garden area on the left",
    });
    expect(result).toBeDefined();
  });

  it("should accept preserveStyle option", async () => {
    const result = await caller.tools.inpaint({
      imageUrl: "https://example.com/img.png",
      editPrompt: "Change wall color to blue",
      preserveStyle: false,
    });
    expect(result).toBeDefined();
  });

  it("should reject empty edit prompt", async () => {
    await expect(
      caller.tools.inpaint({
        imageUrl: "https://example.com/img.png",
        editPrompt: "",
      })
    ).rejects.toThrow();
  });
});

describe("Tools V2 - Face Enhancer", () => {
  it("should require authentication", async () => {
    await expect(
      unauthCaller.tools.enhanceFace({
        imageUrl: "https://example.com/portrait.png",
      })
    ).rejects.toThrow();
  });

  it("should enhance face with default settings", async () => {
    const result = await caller.tools.enhanceFace({
      imageUrl: "https://example.com/portrait.png",
    });
    expect(result).toBeDefined();
    expect(result.status).toBe("completed");
    expect(result.url).toBeDefined();
  });

  it("should accept all enhancement levels", async () => {
    for (const level of ["light", "moderate", "heavy"] as const) {
      const result = await caller.tools.enhanceFace({
        imageUrl: "https://example.com/portrait.png",
        enhancementLevel: level,
      });
      expect(result.status).toBe("completed");
    }
  });

  it("should accept preserveIdentity option", async () => {
    const result = await caller.tools.enhanceFace({
      imageUrl: "https://example.com/portrait.png",
      preserveIdentity: false,
    });
    expect(result).toBeDefined();
  });
});

describe("Tools V2 - Image to Prompt Analyzer", () => {
  it("should require authentication", async () => {
    await expect(
      unauthCaller.tools.analyzeImage({
        imageUrl: "https://example.com/img.png",
      })
    ).rejects.toThrow();
  });

  it("should analyze image and return prompt", async () => {
    const result = await caller.tools.analyzeImage({
      imageUrl: "https://example.com/img.png",
    });
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });

  it("should return structured analysis data", async () => {
    const result = await caller.tools.analyzeImage({
      imageUrl: "https://example.com/img.png",
    });
    // The result should have prompt, tags, and analysis fields
    expect(result).toBeDefined();
    expect(typeof result.status).toBe("string");
  });
});
