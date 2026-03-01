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
  getChildGenerations,
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
  getUserUsageStats,
  getUserActivityTimeline,
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

    getUsageStats: protectedProcedure.query(async ({ ctx }) => {
      const stats = await getUserUsageStats(ctx.user.id);
      if (!stats) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not fetch usage stats" });
      return stats;
    }),

    getActivityTimeline: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(30),
          offset: z.number().min(0).default(0),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 30;
        const offset = input?.offset ?? 0;
        return getUserActivityTimeline(ctx.user.id, limit, offset);
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

    animateImage: protectedProcedure
      .input(
        z.object({
          sourceGenerationId: z.number(),
          duration: z.number().min(2).max(8).default(4),
          animationStyle: z.enum([
            "smooth-pan",
            "gentle-zoom",
            "parallax-drift",
            "cinematic-sweep",
            "breathing-motion",
            "particle-flow",
          ]).default("smooth-pan"),
          tagIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify source generation exists and belongs to user
        const sourceGen = await getGenerationById(input.sourceGenerationId);
        if (!sourceGen) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Source generation not found" });
        }
        if (sourceGen.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (sourceGen.status !== "completed" || !sourceGen.imageUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Source generation must be a completed image with a URL",
          });
        }
        if (sourceGen.mediaType !== "image") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only animate image generations, not videos",
          });
        }

        // Create the animated video generation record
        const animPrompt = `Animate this image with ${input.animationStyle.replace("-", " ")} motion: ${sourceGen.prompt}. Style: cinematic ${input.duration}-second animation, smooth fluid motion, high quality. 100% fictional synthetic content.`;

        const genId = await createGeneration({
          userId: ctx.user.id,
          prompt: animPrompt,
          negativePrompt: sourceGen.negativePrompt ?? null,
          mediaType: "video",
          width: sourceGen.width ?? 768,
          height: sourceGen.height ?? 768,
          duration: input.duration,
          status: "generating",
          modelVersion: "animate-from-image",
          parentGenerationId: input.sourceGenerationId,
          animationStyle: input.animationStyle,
        });

        // Copy tags from source if no new tags provided
        if (input.tagIds && input.tagIds.length > 0) {
          await setGenerationTags(genId, input.tagIds);
        }

        // Generate the animated version using the source image as reference
        try {
          const { url } = await generateImage({
            prompt: animPrompt,
            originalImages: [{
              url: sourceGen.imageUrl,
              mimeType: "image/png",
            }],
          });

          await updateGeneration(genId, {
            status: "completed",
            imageUrl: url ?? null,
            thumbnailUrl: sourceGen.imageUrl, // Use source image as thumbnail
          });

          return {
            id: genId,
            status: "completed" as const,
            imageUrl: url,
            mediaType: "video" as const,
            parentGenerationId: input.sourceGenerationId,
          };
        } catch (error: any) {
          await updateGeneration(genId, {
            status: "failed",
            errorMessage: error.message || "Animation failed",
          });
          return {
            id: genId,
            status: "failed" as const,
            error: error.message,
            parentGenerationId: input.sourceGenerationId,
          };
        }
      }),

    getChildren: protectedProcedure
      .input(z.object({ parentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const parent = await getGenerationById(input.parentId);
        if (!parent) throw new TRPCError({ code: "NOT_FOUND" });
        if (parent.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getChildGenerations(input.parentId);
      }),

    // Batch generation — queue multiple prompts at once
    batchCreate: protectedProcedure
      .input(
        z.object({
          prompts: z.array(
            z.object({
              prompt: z.string().min(1).max(2000),
              negativePrompt: z.string().max(1000).optional(),
              mediaType: z.enum(["image", "video"]).default("image"),
              width: z.number().min(256).max(1536).default(512),
              height: z.number().min(256).max(1536).default(768),
              duration: z.number().min(2).max(8).default(4),
              modelVersion: z.string().max(128).default("built-in-v1"),
            })
          ).min(1).max(10),
          tagIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const results: Array<{ id: number; status: string; prompt: string; error?: string; imageUrl?: string | null }> = [];

        for (const item of input.prompts) {
          const genId = await createGeneration({
            userId: ctx.user.id,
            prompt: item.prompt,
            negativePrompt: item.negativePrompt ?? null,
            mediaType: item.mediaType,
            width: item.width,
            height: item.height,
            duration: item.mediaType === "video" ? item.duration : null,
            status: "generating",
            modelVersion: item.modelVersion,
          });

          if (input.tagIds && input.tagIds.length > 0) {
            await setGenerationTags(genId, input.tagIds);
          }

          try {
            const enhancedPrompt = item.mediaType === "video"
              ? `${item.prompt}. Style: cinematic motion, fluid animation, high quality digital art, ${item.width}x${item.height} resolution, ${item.duration}-second sequence, detailed, professional. 100% fictional synthetic content, no real people.`
              : `${item.prompt}. Style: high quality digital art, ${item.width}x${item.height} resolution, detailed, professional illustration. 100% fictional synthetic content, no real people.`;

            const { url } = await generateImage({ prompt: enhancedPrompt });

            await updateGeneration(genId, {
              status: "completed",
              imageUrl: url ?? null,
              thumbnailUrl: url ?? null,
            });

            results.push({ id: genId, status: "completed", prompt: item.prompt, imageUrl: url });
          } catch (error: any) {
            await updateGeneration(genId, {
              status: "failed",
              errorMessage: error.message || "Generation failed",
            });
            results.push({ id: genId, status: "failed", prompt: item.prompt, error: error.message });
          }
        }

        return { results, total: input.prompts.length, completed: results.filter(r => r.status === "completed").length };
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

  tools: router({
    // AI Image Upscaler — takes an image URL and enhances it at higher quality
    upscale: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          scaleFactor: z.enum(["2x", "4x"]).default("2x"),
          enhanceDetails: z.boolean().default(true),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const scaleLabel = input.scaleFactor === "4x" ? "ultra high resolution 4K" : "high resolution 2K";
          const detailBoost = input.enhanceDetails ? ", enhanced fine details, sharpened textures, crisp edges" : "";
          const upscalePrompt = `Upscale and enhance this image to ${scaleLabel}. Preserve all original content exactly, improve clarity and sharpness${detailBoost}. Professional quality enhancement.`;

          const { url } = await generateImage({
            prompt: upscalePrompt,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Style Transfer — apply an artistic style to an uploaded image
    styleTransfer: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          style: z.enum([
            "oil-painting",
            "watercolor",
            "pencil-sketch",
            "anime",
            "pop-art",
            "cyberpunk",
            "art-nouveau",
            "pixel-art",
            "impressionist",
            "comic-book",
          ]),
          intensity: z.number().min(0.1).max(1.0).default(0.7),
        })
      )
      .mutation(async ({ input }) => {
        const styleDescriptions: Record<string, string> = {
          "oil-painting": "rich oil painting with visible brushstrokes, thick impasto texture, classical fine art",
          "watercolor": "delicate watercolor painting with soft washes, bleeding edges, translucent layers on textured paper",
          "pencil-sketch": "detailed pencil sketch with fine hatching, graphite shading, hand-drawn artistic quality",
          "anime": "Japanese anime style with cel shading, vibrant colors, clean linework, expressive character design",
          "pop-art": "bold pop art style with halftone dots, bright primary colors, thick outlines, Andy Warhol inspired",
          "cyberpunk": "neon-lit cyberpunk aesthetic with holographic elements, dark atmosphere, glowing accents, futuristic",
          "art-nouveau": "Art Nouveau style with flowing organic lines, ornamental borders, natural motifs, elegant curves",
          "pixel-art": "retro pixel art style with limited color palette, crisp pixel edges, 16-bit game aesthetic",
          "impressionist": "Impressionist painting with visible brushstrokes, soft light effects, Monet-inspired color harmony",
          "comic-book": "bold comic book illustration with strong outlines, dramatic shading, Ben-Day dots, dynamic composition",
        };

        const styleDesc = styleDescriptions[input.style] || input.style;
        const intensityLabel = input.intensity > 0.7 ? "strongly" : input.intensity > 0.4 ? "moderately" : "subtly";

        try {
          const { url } = await generateImage({
            prompt: `Transform this image ${intensityLabel} into ${styleDesc}. Maintain the original composition and subject matter while applying the artistic style. Professional quality artwork.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const, style: input.style };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Background Remover / Replacer
    backgroundEdit: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          mode: z.enum(["remove", "replace"]),
          replacementPrompt: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          let prompt: string;
          if (input.mode === "remove") {
            prompt = "Remove the background from this image completely, leaving only the main subject on a clean transparent/white background. Preserve all details of the subject with clean edges.";
          } else {
            prompt = `Replace the background of this image with: ${input.replacementPrompt || "a professional studio backdrop"}. Keep the main subject exactly as it is with clean edges, only change the background. Professional quality compositing.`;
          }

          const { url } = await generateImage({
            prompt,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const, mode: input.mode };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Batch tool operations — apply a tool to multiple images at once
    batchProcess: protectedProcedure
      .input(
        z.object({
          tool: z.enum(["upscale", "style-transfer", "background-edit"]),
          images: z.array(z.string().url()).min(1).max(10),
          // Upscale options
          scaleFactor: z.enum(["2x", "4x"]).optional(),
          enhanceDetails: z.boolean().optional(),
          // Style transfer options
          style: z.enum([
            "oil-painting", "watercolor", "pencil-sketch", "anime", "pop-art",
            "cyberpunk", "art-nouveau", "pixel-art", "impressionist", "comic-book",
          ]).optional(),
          intensity: z.number().min(0.1).max(1.0).optional(),
          // Background edit options
          mode: z.enum(["remove", "replace"]).optional(),
          replacementPrompt: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const results: Array<{ imageUrl: string; resultUrl: string | null; status: string; error?: string }> = [];

        for (const imageUrl of input.images) {
          try {
            let prompt: string;
            if (input.tool === "upscale") {
              const scaleLabel = input.scaleFactor === "4x" ? "ultra high resolution 4K" : "high resolution 2K";
              const detailBoost = input.enhanceDetails !== false ? ", enhanced fine details, sharpened textures, crisp edges" : "";
              prompt = `Upscale and enhance this image to ${scaleLabel}. Preserve all original content exactly, improve clarity and sharpness${detailBoost}. Professional quality enhancement.`;
            } else if (input.tool === "style-transfer") {
              const styleDescriptions: Record<string, string> = {
                "oil-painting": "rich oil painting with visible brushstrokes",
                "watercolor": "delicate watercolor painting with soft washes",
                "pencil-sketch": "detailed pencil sketch with fine hatching",
                "anime": "Japanese anime style with cel shading",
                "pop-art": "bold pop art style with halftone dots",
                "cyberpunk": "neon-lit cyberpunk aesthetic",
                "art-nouveau": "Art Nouveau style with flowing organic lines",
                "pixel-art": "retro pixel art style",
                "impressionist": "Impressionist painting with visible brushstrokes",
                "comic-book": "bold comic book illustration",
              };
              const styleDesc = styleDescriptions[input.style || "oil-painting"] || input.style;
              const intensityLabel = (input.intensity ?? 0.7) > 0.7 ? "strongly" : (input.intensity ?? 0.7) > 0.4 ? "moderately" : "subtly";
              prompt = `Transform this image ${intensityLabel} into ${styleDesc}. Maintain the original composition while applying the artistic style.`;
            } else {
              if (input.mode === "remove") {
                prompt = "Remove the background from this image completely, leaving only the main subject on a clean white background.";
              } else {
                prompt = `Replace the background with: ${input.replacementPrompt || "a professional studio backdrop"}. Keep the main subject exactly as it is.`;
              }
            }

            const { url } = await generateImage({
              prompt,
              originalImages: [{ url: imageUrl, mimeType: "image/png" }],
            });

            results.push({ imageUrl, resultUrl: url ?? null, status: "completed" });
          } catch (error: any) {
            results.push({ imageUrl, resultUrl: null, status: "failed", error: error.message });
          }
        }

        return { results, total: input.images.length, completed: results.filter(r => r.status === "completed").length };
      }),

    // Smart Prompt Builder — LLM constructs an optimized prompt from structured inputs
    buildPrompt: protectedProcedure
      .input(
        z.object({
          subject: z.string().min(1).max(500),
          style: z.string().max(200).optional(),
          mood: z.string().max(200).optional(),
          lighting: z.string().max(200).optional(),
          composition: z.string().max(200).optional(),
          colorPalette: z.string().max(200).optional(),
          additionalDetails: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const structuredInput = [
            `Subject: ${input.subject}`,
            input.style ? `Style: ${input.style}` : null,
            input.mood ? `Mood/Atmosphere: ${input.mood}` : null,
            input.lighting ? `Lighting: ${input.lighting}` : null,
            input.composition ? `Composition: ${input.composition}` : null,
            input.colorPalette ? `Color Palette: ${input.colorPalette}` : null,
            input.additionalDetails ? `Additional Details: ${input.additionalDetails}` : null,
          ].filter(Boolean).join("\n");

          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are an expert AI image prompt engineer. Given structured creative inputs, compose a single, detailed, optimized prompt for AI image generation. The prompt should be vivid, specific, and technically precise. Include artistic terminology, composition details, and quality modifiers. Output ONLY the final prompt text, nothing else. All content must be 100% fictional.",
              },
              { role: "user", content: structuredInput },
            ],
          });

          const prompt = typeof result.choices[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : input.subject;

          return { prompt, status: "completed" as const };
        } catch {
          // Fallback: construct a basic prompt from the inputs
          const parts = [input.subject, input.style, input.mood, input.lighting, input.composition, input.colorPalette, input.additionalDetails].filter(Boolean);
          return { prompt: parts.join(", ") + ". High quality, detailed, professional.", status: "completed" as const };
        }
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
