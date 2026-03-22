import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  toggleLike, getLikeStatus, getLikeCounts, addComment, getComments, deleteComment,
  toggleFollow, getFollowStatus, getFollowingFeed,
  createCharacter, listCharacters, getCharacter, updateCharacter, deleteCharacter,
  createBrandKit, listBrandKits, getBrandKit, updateBrandKit, deleteBrandKit,
  createApiKey, listApiKeys, revokeApiKey, deleteApiKey, getApiKeyByHash,
  createSceneKeyframe, listSceneKeyframes, updateSceneKeyframe, deleteSceneKeyframes,
  searchGenerations,
} from "./dbExtended";
import { getVideoProject, getGenerationById } from "./db";
import { createNotification } from "./routersPhase15";
import { createHash, randomBytes } from "crypto";

// ─── P0: Video Generation (Scene Keyframes) ────────────────────────────────

export const videoGenRouter = router({
  generateKeyframes: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      scenes: z.array(z.object({
        index: z.number(),
        prompt: z.string().min(1),
      })).min(1).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await getVideoProject(input.projectId, ctx.user.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      // Delete existing keyframes for this project
      await deleteSceneKeyframes(input.projectId);

      // Create pending keyframes
      const keyframeIds: number[] = [];
      for (const scene of input.scenes) {
        const { id } = await createSceneKeyframe({
          projectId: input.projectId,
          sceneIndex: scene.index,
          prompt: scene.prompt,
          status: "pending",
        });
        keyframeIds.push(id);
      }

      // Generate images in background (non-blocking)
      (async () => {
        for (let i = 0; i < input.scenes.length; i++) {
          const scene = input.scenes[i];
          const kfId = keyframeIds[i];
          try {
            await updateSceneKeyframe(kfId, { status: "generating" });
            const { url } = await generateImage({
              prompt: `Cinematic keyframe for video scene: ${scene.prompt}. High quality, 16:9 aspect ratio, dramatic lighting, film-quality composition.`,
            });
            await updateSceneKeyframe(kfId, { status: "completed", imageUrl: url ?? null });
          } catch (error: any) {
            await updateSceneKeyframe(kfId, { status: "failed", errorMessage: error.message });
          }
        }
      })();

      return { keyframeIds, status: "generating" as const };
    }),

  getKeyframes: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await getVideoProject(input.projectId, ctx.user.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      return listSceneKeyframes(input.projectId);
    }),

  regenerateKeyframe: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      keyframeId: z.number(),
      prompt: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await getVideoProject(input.projectId, ctx.user.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      // Verify the keyframe belongs to this project
      const keyframes = await listSceneKeyframes(input.projectId);
      const keyframe = keyframes.find((kf) => kf.id === input.keyframeId);
      if (!keyframe) throw new TRPCError({ code: "NOT_FOUND", message: "Keyframe not found in this project" });

      await updateSceneKeyframe(input.keyframeId, { status: "generating", prompt: input.prompt });
      
      // Generate in background
      (async () => {
        try {
          const { url } = await generateImage({
            prompt: `Cinematic keyframe for video scene: ${input.prompt}. High quality, 16:9 aspect ratio, dramatic lighting, film-quality composition.`,
          });
          await updateSceneKeyframe(input.keyframeId, { status: "completed", imageUrl: url ?? null });
        } catch (error: any) {
          await updateSceneKeyframe(input.keyframeId, { status: "failed", errorMessage: error.message });
        }
      })();

      return { status: "generating" as const };
    }),
});

// ─── P3: Gallery Social Features ────────────────────────────────────────────

export const socialRouter = router({
  toggleLike: protectedProcedure
    .input(z.object({ galleryItemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return toggleLike(ctx.user.id, input.galleryItemId);
    }),

  getLikeStatus: protectedProcedure
    .input(z.object({ galleryItemId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getLikeStatus(ctx.user.id, input.galleryItemId);
    }),

  getLikeCounts: publicProcedure
    .input(z.object({ galleryItemIds: z.array(z.number()).min(1).max(100) }))
    .query(async ({ input }) => {
      return getLikeCounts(input.galleryItemIds);
    }),

  addComment: protectedProcedure
    .input(z.object({
      galleryItemId: z.number(),
      content: z.string().min(1).max(1000),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await addComment(ctx.user.id, input.galleryItemId, input.content);
      // Notify the gallery item owner about the comment
      try {
        const gen = await getGenerationById(input.galleryItemId);
        if (gen && gen.userId !== ctx.user.id) {
          await createNotification(
            gen.userId,
            "comment",
            "New Comment",
            `Someone commented on your creation: "${input.content.slice(0, 60)}..."`,
            { galleryItemId: input.galleryItemId }
          );
        }
      } catch {}
      return result;
    }),

  getComments: publicProcedure
    .input(z.object({ galleryItemId: z.number(), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ input }) => {
      return getComments(input.galleryItemId, input.limit);
    }),

  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteComment(input.commentId, ctx.user.id);
    }),

  toggleFollow: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
      const result = await toggleFollow(ctx.user.id, input.userId);
      // Notify user when someone follows them
      if (result.following) {
        try {
          await createNotification(
            input.userId,
            "system",
            "New Follower",
            `You have a new follower!`,
            { followerId: ctx.user.id }
          );
        } catch {}
      }
      return result;
    }),

  getFollowStatus: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getFollowStatus(ctx.user.id, input.userId);
    }),

  getFollowingFeed: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      return getFollowingFeed(ctx.user.id, input.limit);
    }),
});

// ─── P4: Character Consistency ──────────────────────────────────────────────

export const characterRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      description: z.string().max(2000).optional(),
      referenceImages: z.array(z.string()).max(5).optional(),
      styleNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createCharacter({
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
        referenceImages: input.referenceImages ?? [],
        styleNotes: input.styleNotes ?? null,
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return listCharacters(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const char = await getCharacter(input.id, ctx.user.id);
      if (!char) throw new TRPCError({ code: "NOT_FOUND" });
      return char;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      description: z.string().max(2000).optional(),
      referenceImages: z.array(z.string()).max(5).optional(),
      styleNotes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateCharacter(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteCharacter(input.id, ctx.user.id);
    }),

  generateWithCharacter: protectedProcedure
    .input(z.object({
      characterId: z.number(),
      prompt: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const char = await getCharacter(input.characterId, ctx.user.id);
      if (!char) throw new TRPCError({ code: "NOT_FOUND" });

      const characterPrompt = [
        `Character: ${char.name}`,
        char.description ? `Description: ${char.description}` : "",
        char.styleNotes ? `Style: ${char.styleNotes}` : "",
        `Scene: ${input.prompt}`,
        "Maintain character consistency with the described appearance.",
      ].filter(Boolean).join(". ");

      const { url } = await generateImage({
        prompt: characterPrompt,
        originalImages: (char.referenceImages as string[] || []).map((u: string) => ({ url: u, mimeType: "image/png" })),
      });

      return { url };
    }),
});

// ─── P5: Multi-Model Selection ──────────────────────────────────────────────

const MODEL_REGISTRY = [
  { id: "default", name: "DreamForge Standard", description: "Balanced quality and speed", capabilities: ["image", "edit"], speed: "fast", quality: "high" },
  { id: "hd", name: "DreamForge HD", description: "Maximum quality, slower generation", capabilities: ["image"], speed: "slow", quality: "ultra" },
  { id: "fast", name: "DreamForge Turbo", description: "Fastest generation, good quality", capabilities: ["image"], speed: "fastest", quality: "good" },
  { id: "artistic", name: "DreamForge Artistic", description: "Optimized for artistic and painterly styles", capabilities: ["image", "edit"], speed: "medium", quality: "high" },
  { id: "photo", name: "DreamForge Photorealistic", description: "Optimized for photorealistic output", capabilities: ["image"], speed: "medium", quality: "ultra" },
];

export const modelRouter = router({
  list: publicProcedure.query(() => MODEL_REGISTRY),

  compare: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1),
      modelIds: z.array(z.string()).min(2).max(4),
    }))
    .mutation(async ({ input }) => {
      const results: { modelId: string; url: string | undefined; error?: string }[] = [];
      for (const modelId of input.modelIds) {
        const model = MODEL_REGISTRY.find(m => m.id === modelId);
        if (!model) {
          results.push({ modelId, url: undefined, error: "Model not found" });
          continue;
        }
        try {
          const { url } = await generateImage({
            prompt: `[${model.name} style] ${input.prompt}`,
          });
          results.push({ modelId, url });
        } catch (error: any) {
          results.push({ modelId, url: undefined, error: error.message });
        }
      }
      return results;
    }),
});

// ─── P7: AI Prompt Assistant ────────────────────────────────────────────────

export const promptAssistRouter = router({
  improve: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1).max(2000),
      style: z.string().optional(),
      mood: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert AI image prompt engineer. Improve the user's prompt to produce better image generation results. Add specific details about composition, lighting, color palette, style, and technical quality. Return JSON: { "improved": "...", "suggestions": ["tip1", "tip2", "tip3"] }`,
          },
          {
            role: "user",
            content: `Improve this prompt${input.style ? ` in ${input.style} style` : ""}${input.mood ? ` with ${input.mood} mood` : ""}: "${input.prompt}"`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "prompt_improvement",
            strict: true,
            schema: {
              type: "object",
              properties: {
                improved: { type: "string", description: "The improved prompt" },
                suggestions: { type: "array", items: { type: "string" }, description: "Tips for better prompts" },
              },
              required: ["improved", "suggestions"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = result.choices[0]?.message?.content;
      return JSON.parse(typeof content === "string" ? content : "{}");
    }),

  suggest: protectedProcedure
    .input(z.object({
      context: z.string().optional(),
      category: z.enum(["style", "mood", "composition", "lighting", "color", "subject"]).optional(),
    }))
    .query(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a creative AI prompt assistant. Generate 6 creative prompt suggestions. Return JSON: { "suggestions": [{ "prompt": "...", "category": "...", "preview": "short description" }] }`,
          },
          {
            role: "user",
            content: `Suggest creative prompts${input.category ? ` focused on ${input.category}` : ""}${input.context ? ` related to: ${input.context}` : ""}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "prompt_suggestions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      prompt: { type: "string" },
                      category: { type: "string" },
                      preview: { type: "string" },
                    },
                    required: ["prompt", "category", "preview"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = result.choices[0]?.message?.content;
      return JSON.parse(typeof content === "string" ? content : '{"suggestions":[]}');
    }),
});

// ─── P8: Brand Kits ────────────────────────────────────────────────────────

export const brandKitRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      colorPalette: z.array(z.string()).max(10).optional(),
      stylePrompt: z.string().max(2000).optional(),
      typography: z.string().max(256).optional(),
      logoUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return createBrandKit({
        userId: ctx.user.id,
        name: input.name,
        colorPalette: input.colorPalette ?? [],
        stylePrompt: input.stylePrompt ?? null,
        typography: input.typography ?? null,
        logoUrl: input.logoUrl ?? null,
      });
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return listBrandKits(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const kit = await getBrandKit(input.id, ctx.user.id);
      if (!kit) throw new TRPCError({ code: "NOT_FOUND" });
      return kit;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(128).optional(),
      colorPalette: z.array(z.string()).max(10).optional(),
      stylePrompt: z.string().max(2000).optional(),
      typography: z.string().max(256).optional(),
      logoUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateBrandKit(id, ctx.user.id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteBrandKit(input.id, ctx.user.id);
    }),

  // Style presets (built-in)
  presets: publicProcedure.query(() => [
    { id: "cinematic", name: "Cinematic", prompt: "cinematic lighting, film grain, dramatic shadows, anamorphic lens flare, movie poster quality", colors: ["#1a1a2e", "#16213e", "#0f3460", "#e94560"] },
    { id: "anime", name: "Anime", prompt: "anime art style, cel shading, vibrant colors, detailed line art, studio ghibli inspired", colors: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3"] },
    { id: "watercolor", name: "Watercolor", prompt: "watercolor painting, soft edges, paint bleeding, textured paper, artistic brush strokes", colors: ["#a8d8ea", "#aa96da", "#fcbad3", "#ffffd2"] },
    { id: "cyberpunk", name: "Cyberpunk", prompt: "cyberpunk aesthetic, neon lights, rain-slicked streets, holographic displays, dark futuristic", colors: ["#0d0221", "#0a0a2a", "#ff00ff", "#00ffff"] },
    { id: "minimalist", name: "Minimalist", prompt: "minimalist design, clean lines, negative space, simple composition, modern aesthetic", colors: ["#ffffff", "#f5f5f5", "#333333", "#000000"] },
    { id: "vintage", name: "Vintage", prompt: "vintage photography, sepia tones, film grain, retro color grading, nostalgic atmosphere", colors: ["#d4a574", "#c4956a", "#8b6914", "#3d2b1f"] },
    { id: "fantasy", name: "Fantasy", prompt: "high fantasy art, magical atmosphere, ethereal lighting, detailed environment, epic scale", colors: ["#2d1b69", "#6c3483", "#f39c12", "#27ae60"] },
    { id: "noir", name: "Film Noir", prompt: "film noir style, high contrast black and white, dramatic shadows, venetian blinds lighting", colors: ["#000000", "#1a1a1a", "#808080", "#ffffff"] },
  ]),
});

// ─── P9: Smart Search ───────────────────────────────────────────────────────

export const searchRouter = router({
  generations: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      mediaType: z.enum(["image", "video"]).optional(),
      modelVersion: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return searchGenerations(ctx.user.id, input);
    }),
});

// ─── P11: API Key Management ────────────────────────────────────────────────

export const apiKeyRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(128),
      permissions: z.array(z.string()).optional(),
      rateLimit: z.number().min(10).max(10000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate a random API key
      const rawKey = `df_${randomBytes(32).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.substring(0, 11); // "df_" + 8 chars

      await createApiKey({
        userId: ctx.user.id,
        name: input.name,
        keyHash,
        keyPrefix,
        permissions: input.permissions ?? ["generate", "tools"],
        rateLimit: input.rateLimit ?? 100,
        active: true,
      });

      // Return the raw key only once — it won't be stored
      return { key: rawKey, prefix: keyPrefix };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return listApiKeys(ctx.user.id);
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return revokeApiKey(input.id, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteApiKey(input.id, ctx.user.id);
    }),
});
