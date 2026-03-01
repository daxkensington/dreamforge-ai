import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createGeneration,
  createModerationItem,
  createTag,
  getAllTags,
  getGalleryItemById,
  getGalleryItems,
  getGalleryStats,
  getGenerationById,
  getGenerationsForExport,
  getGenerationWithTags,
  getModerationQueue,
  getModerationStats,
  getUserGenerations,
  reviewModerationItem,
  seedDefaultTags,
  setGenerationTags,
  updateGeneration,
  updateUserProfile,
} from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  user: router({
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100).optional(),
          bio: z.string().max(500).optional(),
          institution: z.string().max(256).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  tags: router({
    list: publicProcedure.query(async () => {
      await seedDefaultTags();
      return getAllTags();
    }),
    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(128),
          slug: z.string().min(1).max(128),
          category: z.enum(["genre", "theme", "style", "subject", "technique"]),
          description: z.string().optional(),
          color: z.string().max(7).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createTag(input);
        return { success: true };
      }),
  }),

  generation: router({
    create: protectedProcedure
      .input(
        z.object({
          prompt: z.string().min(1).max(2000),
          negativePrompt: z.string().max(1000).optional(),
          mediaType: z.enum(["image", "video"]).default("image"),
          width: z.number().min(256).max(1536).default(512),
          height: z.number().min(256).max(1536).default(768),
          duration: z.number().min(2).max(8).default(4),
          modelVersion: z.string().max(128).default("built-in-v1"),
          tagIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Create generation record
        const genId = await createGeneration({
          userId: ctx.user.id,
          prompt: input.prompt,
          negativePrompt: input.negativePrompt ?? null,
          mediaType: input.mediaType,
          width: input.width,
          height: input.height,
          duration: input.mediaType === "video" ? input.duration : null,
          status: "generating",
          modelVersion: input.modelVersion,
        });

        if (input.tagIds && input.tagIds.length > 0) {
          await setGenerationTags(genId, input.tagIds);
        }

        // Generate media
        try {
          let enhancedPrompt: string;
          if (input.mediaType === "video") {
            enhancedPrompt = `${input.prompt}. Style: cinematic motion, fluid animation, high quality digital art, ${input.width}x${input.height} resolution, ${input.duration}-second sequence, detailed, professional. 100% fictional synthetic content, no real people.`;
          } else {
            enhancedPrompt = `${input.prompt}. Style: high quality digital art, ${input.width}x${input.height} resolution, detailed, professional illustration. 100% fictional synthetic content, no real people.`;
          }

          const { url } = await generateImage({ prompt: enhancedPrompt });

          await updateGeneration(genId, {
            status: "completed",
            imageUrl: url ?? null,
            thumbnailUrl: url ?? null,
          });

          return { id: genId, status: "completed", imageUrl: url, mediaType: input.mediaType };
        } catch (error: any) {
          await updateGeneration(genId, {
            status: "failed",
            errorMessage: error.message || "Generation failed",
          });
          return { id: genId, status: "failed", error: error.message };
        }
      }),

    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        const { limit = 50, offset = 0 } = input ?? {};
        return getUserGenerations(ctx.user.id, limit, offset);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const gen = await getGenerationWithTags(input.id);
        if (!gen) throw new TRPCError({ code: "NOT_FOUND" });
        if (gen.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return gen;
      }),

    updateTags: protectedProcedure
      .input(
        z.object({
          generationId: z.number(),
          tagIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const gen = await getGenerationById(input.generationId);
        if (!gen) throw new TRPCError({ code: "NOT_FOUND" });
        if (gen.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        await setGenerationTags(input.generationId, input.tagIds);
        return { success: true };
      }),

    submitToGallery: protectedProcedure
      .input(
        z.object({
          generationId: z.number(),
          title: z.string().min(1).max(256),
          description: z.string().max(2000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const gen = await getGenerationById(input.generationId);
        if (!gen) throw new TRPCError({ code: "NOT_FOUND" });
        if (gen.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (gen.status !== "completed") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only completed generations can be submitted",
          });
        }

        const modId = await createModerationItem({
          generationId: input.generationId,
          userId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
        });

        return { moderationId: modId };
      }),

    enhancePrompt: protectedProcedure
      .input(z.object({ prompt: z.string().min(1).max(2000) }))
      .mutation(async ({ input }) => {
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content:
                  "You are an expert prompt engineer for AI image generation. Enhance the given prompt to produce higher quality, more detailed fictional synthetic artwork. Keep the core concept but add artistic details, lighting, composition, and style suggestions. Output ONLY the enhanced prompt, nothing else. All content must be 100% fictional with no real people.",
              },
              { role: "user", content: input.prompt },
            ],
          });
          const enhanced =
            typeof result.choices[0]?.message?.content === "string"
              ? result.choices[0].message.content
              : input.prompt;
          return { enhanced };
        } catch {
          return { enhanced: input.prompt };
        }
      }),
  }),

  gallery: router({
    list: publicProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(24),
          offset: z.number().min(0).default(0),
          tagSlugs: z.array(z.string()).optional(),
          search: z.string().optional(),
          modelVersion: z.string().optional(),
          featured: z.boolean().optional(),
          sort: z.enum(["newest", "oldest", "most_viewed"]).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        const opts = input ?? {};
        return getGalleryItems(opts);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const item = await getGalleryItemById(input.id);
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });
        return item;
      }),

    stats: publicProcedure.query(async () => {
      return getGalleryStats();
    }),
  }),

  moderation: router({
    queue: adminProcedure
      .input(
        z.object({
          status: z.enum(["pending", "approved", "rejected"]).default("pending"),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        }).optional()
      )
      .query(async ({ input }) => {
        const { status = "pending", limit = 50, offset = 0 } = input ?? {};
        return getModerationQueue(status, limit, offset);
      }),

    review: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["approved", "rejected"]),
          note: z.string().max(1000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await reviewModerationItem(
          input.id,
          ctx.user.id,
          input.status,
          input.note
        );
        return { success: true };
      }),

    stats: adminProcedure.query(async () => {
      return getModerationStats();
    }),
  }),

  export: router({
    metadata: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(50) }))
      .query(async ({ input }) => {
        const gens = await getGenerationsForExport(input.ids);
        return gens.map((g) => ({
          id: g.id,
          prompt: g.prompt,
          negativePrompt: g.negativePrompt,
          modelVersion: g.modelVersion,
          mediaType: g.mediaType,
          width: g.width,
          height: g.height,
          imageUrl: g.imageUrl,
          tags: g.tags.map((t) => ({ name: t.name, slug: t.slug, category: t.category })),
          createdAt: g.createdAt,
          disclaimer:
            "100% synthetic media — all content mathematically generated, no real individuals depicted or harmed.",
        }));
      }),
  }),
});

export type AppRouter = typeof appRouter;
