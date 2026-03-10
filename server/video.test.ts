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

describe("Video Studio Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Storyboard Generator ──────────────────────────────────────
  describe("video.generateStoryboard", () => {
    const mockStoryboard = {
      title: "Cosmic Journey",
      synopsis: "An astronaut discovers alien life on Mars",
      totalDuration: 120,
      scenes: [
        {
          sceneNumber: 1,
          duration: 30,
          cameraAngle: "Wide establishing shot",
          cameraMovement: "Slow dolly forward",
          visualDescription: "Mars landscape at sunset with red dust clouds",
          narration: "In the year 2150...",
          mood: "Epic and mysterious",
          transition: "Cross dissolve",
        },
        {
          sceneNumber: 2,
          duration: 30,
          cameraAngle: "Medium close-up",
          cameraMovement: "Tracking shot",
          visualDescription: "Astronaut walking through alien garden",
          narration: "The first signs of life appeared...",
          mood: "Wonder and discovery",
          transition: "Cut",
        },
      ],
    };

    it("should generate a storyboard from a concept", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockStoryboard) } }],
      } as any);
      vi.mocked(generateImage)
        .mockResolvedValueOnce({ url: "https://cdn.example.com/scene1.png" })
        .mockResolvedValueOnce({ url: "https://cdn.example.com/scene2.png" });

      const result = await caller.video.generateStoryboard({
        concept: "An astronaut discovers alien life on Mars",
        sceneCount: 2,
        style: "cinematic",
        aspectRatio: "16:9",
        generateImages: true,
      });

      expect(result.status).toBe("completed");
      expect(result.title).toBe("Cosmic Journey");
      expect(result.synopsis).toBeTruthy();
      expect(result.scenes).toHaveLength(2);
      expect(result.scenes[0].imageUrl).toBe("https://cdn.example.com/scene1.png");
      expect(invokeLLM).toHaveBeenCalledTimes(1);
      expect(generateImage).toHaveBeenCalledTimes(2);
    });

    it("should generate storyboard without images when generateImages is false", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockStoryboard) } }],
      } as any);

      const result = await caller.video.generateStoryboard({
        concept: "A fantasy quest through enchanted forests",
        sceneCount: 2,
        generateImages: false,
      });

      expect(result.status).toBe("completed");
      expect(result.scenes).toHaveLength(2);
      expect(generateImage).not.toHaveBeenCalled();
    });

    it("should use default values for optional parameters", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockStoryboard) } }],
      } as any);
      vi.mocked(generateImage).mockResolvedValue({ url: "https://cdn.example.com/scene.png" });

      const result = await caller.video.generateStoryboard({
        concept: "A simple test concept",
      });

      expect(result.status).toBe("completed");
      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("cinematic"),
            }),
          ]),
        })
      );
    });

    it("should handle LLM failure gracefully", async () => {
      vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM service unavailable"));

      const result = await caller.video.generateStoryboard({
        concept: "A test concept that will fail",
      });

      expect(result.status).toBe("failed");
      expect(result.scenes).toHaveLength(0);
    });
  });

  // ─── Scene Director ────────────────────────────────────────────
  describe("video.directScene", () => {
    const mockDirection = {
      sceneTitle: "The Final Stand",
      overallDirection: "Epic battle sequence with sweeping camera movements",
      keyframes: [
        {
          frameNumber: 1,
          timestamp: "00:00",
          composition: "Wide shot of battlefield",
          cameraPosition: "High angle crane shot",
          lighting: "Golden hour backlighting",
          movement: "Slow descent to ground level",
          notes: "Establish scale of the scene",
        },
        {
          frameNumber: 2,
          timestamp: "00:03",
          composition: "Medium shot of warrior",
          cameraPosition: "Eye level tracking",
          lighting: "Dramatic rim lighting",
          movement: "Tracking alongside subject",
          notes: "Focus on determination",
        },
      ],
    };

    it("should direct a scene with keyframe generation", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockDirection) } }],
      } as any);
      vi.mocked(generateImage)
        .mockResolvedValueOnce({ url: "https://cdn.example.com/kf1.png" })
        .mockResolvedValueOnce({ url: "https://cdn.example.com/kf2.png" });

      const result = await caller.video.directScene({
        narrative: "A warrior makes their final stand against an army",
        keyframeCount: 2,
        cameraStyle: "crane",
        mood: "epic",
      });

      expect(result.status).toBe("completed");
      expect(result.sceneTitle).toBe("The Final Stand");
      expect(result.keyframes).toHaveLength(2);
      expect(result.keyframes[0].imageUrl).toBe("https://cdn.example.com/kf1.png");
      expect(result.cameraStyle).toBe("crane");
      expect(result.mood).toBe("epic");
    });

    it("should use default camera style and mood", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockDirection) } }],
      } as any);
      vi.mocked(generateImage).mockResolvedValue({ url: "https://cdn.example.com/kf.png" });

      const result = await caller.video.directScene({
        narrative: "A simple scene description",
      });

      expect(result.status).toBe("completed");
      expect(result.cameraStyle).toBe("tracking");
      expect(result.mood).toBe("epic");
    });

    it("should handle image generation failure for individual keyframes", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockDirection) } }],
      } as any);
      vi.mocked(generateImage)
        .mockResolvedValueOnce({ url: "https://cdn.example.com/kf1.png" })
        .mockRejectedValueOnce(new Error("Image gen failed"));

      const result = await caller.video.directScene({
        narrative: "A test scene",
        keyframeCount: 2,
      });

      expect(result.status).toBe("completed");
      expect(result.keyframes[0].imageUrl).toBe("https://cdn.example.com/kf1.png");
      expect(result.keyframes[1].imageUrl).toBeNull();
    });
  });

  // ─── Video Style Transfer ──────────────────────────────────────
  describe("video.styleTransfer", () => {
    it("should apply anime style to an image", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/styled.png" });

      const result = await caller.video.styleTransfer({
        imageUrl: "https://example.com/frame.png",
        videoStyle: "anime",
        preserveMotion: true,
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/styled.png");
      expect(result.style).toBe("anime");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("anime"),
          originalImages: [{ url: "https://example.com/frame.png", mimeType: "image/png" }],
        })
      );
    });

    it("should apply noir style without motion preservation", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/noir.png" });

      const result = await caller.video.styleTransfer({
        imageUrl: "https://example.com/frame.png",
        videoStyle: "noir",
        preserveMotion: false,
      });

      expect(result.status).toBe("completed");
      expect(result.style).toBe("noir");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.not.stringContaining("Preserve the original composition"),
        })
      );
    });

    it("should handle all video styles", async () => {
      const styles = ["anime", "noir", "watercolor", "oil-painting", "pixel-art", "comic-book", "claymation", "retro-vhs"] as const;

      for (const videoStyle of styles) {
        vi.mocked(generateImage).mockResolvedValueOnce({ url: `https://cdn.example.com/${videoStyle}.png` });

        const result = await caller.video.styleTransfer({
          imageUrl: "https://example.com/frame.png",
          videoStyle,
        });

        expect(result.status).toBe("completed");
        expect(result.style).toBe(videoStyle);
      }
    });

    it("should handle generation failure", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Style transfer failed"));

      const result = await caller.video.styleTransfer({
        imageUrl: "https://example.com/frame.png",
        videoStyle: "watercolor",
      });

      expect(result.status).toBe("failed");
      expect(result.url).toBeNull();
    });
  });

  // ─── Video Upscaler ────────────────────────────────────────────
  describe("video.upscaleFrame", () => {
    it("should upscale a frame at 2x with light denoising", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/upscaled.png" });

      const result = await caller.video.upscaleFrame({
        imageUrl: "https://example.com/frame.png",
        scaleFactor: "2x",
        enhanceDetails: true,
        denoiseLevel: "light",
      });

      expect(result.status).toBe("completed");
      expect(result.url).toBe("https://cdn.example.com/upscaled.png");
      expect(result.scaleFactor).toBe("2x");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("2x resolution"),
        })
      );
    });

    it("should upscale at 4x with heavy denoising", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/upscaled-4x.png" });

      const result = await caller.video.upscaleFrame({
        imageUrl: "https://example.com/frame.png",
        scaleFactor: "4x",
        enhanceDetails: true,
        denoiseLevel: "heavy",
      });

      expect(result.status).toBe("completed");
      expect(result.scaleFactor).toBe("4x");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining("4x resolution"),
        })
      );
    });

    it("should upscale without detail enhancement", async () => {
      vi.mocked(generateImage).mockResolvedValueOnce({ url: "https://cdn.example.com/upscaled.png" });

      const result = await caller.video.upscaleFrame({
        imageUrl: "https://example.com/frame.png",
        scaleFactor: "2x",
        enhanceDetails: false,
        denoiseLevel: "none",
      });

      expect(result.status).toBe("completed");
      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.not.stringContaining("Enhance fine details"),
        })
      );
    });

    it("should handle upscale failure", async () => {
      vi.mocked(generateImage).mockRejectedValueOnce(new Error("Upscale failed"));

      const result = await caller.video.upscaleFrame({
        imageUrl: "https://example.com/frame.png",
      });

      expect(result.status).toBe("failed");
      expect(result.url).toBeNull();
    });
  });

  // ─── Soundtrack Suggester ──────────────────────────────────────
  describe("video.suggestSoundtrack", () => {
    const mockSuggestion = {
      primaryGenre: "Orchestral Cinematic",
      subGenres: ["Epic Score", "Ambient Electronic"],
      tempo: "80-120 BPM",
      keyInstruments: ["Strings", "French Horn", "Synthesizer", "Percussion"],
      moodProgression: "Building from quiet tension to triumphant climax",
      description: "A sweeping orchestral score that captures the grandeur of space exploration",
      referenceTracks: [
        { title: "Interstellar Main Theme", artist: "Hans Zimmer", reason: "Similar epic space atmosphere" },
        { title: "Time", artist: "Hans Zimmer", reason: "Building emotional progression" },
      ],
      soundEffects: ["Spaceship engine hum", "Radio static", "Wind on Mars surface"],
      licensingNotes: "Consider royalty-free orchestral libraries for production use",
    };

    it("should suggest a soundtrack for a video concept", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockSuggestion) } }],
      } as any);

      const result = await caller.video.suggestSoundtrack({
        concept: "An astronaut explores Mars",
        mood: "epic",
        duration: 60,
      });

      expect(result.status).toBe("completed");
      expect(result.primaryGenre).toBe("Orchestral Cinematic");
      expect(result.subGenres).toHaveLength(2);
      expect(result.keyInstruments).toContain("Strings");
      expect(result.referenceTracks).toHaveLength(2);
      expect(result.soundEffects).toHaveLength(3);
      expect(result.mood).toBe("epic");
      expect(result.duration).toBe(60);
    });

    it("should handle different moods", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockSuggestion) } }],
      } as any);

      const result = await caller.video.suggestSoundtrack({
        concept: "A romantic sunset scene",
        mood: "romantic",
        duration: 30,
      });

      expect(result.status).toBe("completed");
      expect(result.mood).toBe("romantic");
      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("romantic"),
            }),
          ]),
        })
      );
    });

    it("should handle LLM failure", async () => {
      vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM unavailable"));

      const result = await caller.video.suggestSoundtrack({
        concept: "A test concept",
      });

      expect(result.status).toBe("failed");
      expect(result.primaryGenre).toBe("");
    });
  });

  // ─── Text-to-Video Script ─────────────────────────────────────
  describe("video.generateScript", () => {
    const mockScript = {
      title: "The Future of AI",
      logline: "A documentary exploring how AI transforms creative industries",
      targetDuration: 60,
      format: "documentary",
      scenes: [
        {
          sceneNumber: 1,
          startTime: "00:00",
          endTime: "00:15",
          location: "Modern tech office",
          visualDescription: "Sleek office with holographic displays showing AI art",
          cameraDirection: "Slow tracking shot through the office",
          narration: "In the age of artificial intelligence...",
          dialogue: "",
          soundDesign: "Ambient electronic music, keyboard clicks",
          productionNotes: "Use practical lighting with blue accents",
        },
        {
          sceneNumber: 2,
          startTime: "00:15",
          endTime: "00:30",
          location: "Artist studio",
          visualDescription: "Artist collaborating with AI on a digital canvas",
          cameraDirection: "Over-the-shoulder shot, rack focus",
          narration: "Artists are finding new ways to collaborate...",
          dialogue: "This is just the beginning.",
          soundDesign: "Soft piano, brush strokes",
          productionNotes: "Warm lighting, intimate feel",
        },
      ],
      productionBudget: "Low-medium ($5,000-$15,000)",
      equipmentNeeded: ["4K Camera", "Gimbal Stabilizer", "LED Panel Lights", "Wireless Mic"],
    };

    it("should generate a narrative video script", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockScript) } }],
      } as any);

      const result = await caller.video.generateScript({
        concept: "How AI is transforming creative industries",
        duration: 60,
        format: "documentary",
        tone: "professional",
      });

      expect(result.status).toBe("completed");
      expect(result.title).toBe("The Future of AI");
      expect(result.logline).toBeTruthy();
      expect(result.scenes).toHaveLength(2);
      expect(result.scenes[0].visualDescription).toBeTruthy();
      expect(result.scenes[0].cameraDirection).toBeTruthy();
      expect(result.productionBudget).toBeTruthy();
      expect(result.equipmentNeeded).toHaveLength(4);
      expect(result.tone).toBe("professional");
    });

    it("should handle different formats and tones", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockScript) } }],
      } as any);

      const result = await caller.video.generateScript({
        concept: "A funny cat video",
        duration: 30,
        format: "social-media",
        tone: "humorous",
      });

      expect(result.status).toBe("completed");
      expect(result.tone).toBe("humorous");
      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("humorous"),
            }),
          ]),
        })
      );
    });

    it("should use default values for optional parameters", async () => {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify(mockScript) } }],
      } as any);

      const result = await caller.video.generateScript({
        concept: "A simple video concept",
      });

      expect(result.status).toBe("completed");
      expect(invokeLLM).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining("professional"),
            }),
          ]),
        })
      );
    });

    it("should handle LLM failure", async () => {
      vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("Script generation failed"));

      const result = await caller.video.generateScript({
        concept: "A test concept",
      });

      expect(result.status).toBe("failed");
      expect(result.title).toBe("");
      expect(result.scenes).toHaveLength(0);
    });
  });
});
