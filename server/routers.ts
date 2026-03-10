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
  createVideoProject,
  updateVideoProject,
  getVideoProject,
  listVideoProjects,
  deleteVideoProject,
  createShareToken,
  getShareToken,
  incrementShareTokenUse,
  deactivateShareToken,
  listShareTokens,
  addCollaborator,
  listCollaborators,
  removeCollaborator,
  listSharedWithMe,
  getUserCollaboratorRole,
  createRevision,
  listRevisions,
  getRevision,
  getLatestRevisionVersion,
} from "./db";
import { storagePut } from "./storage";
import {
  videoGenRouter,
  socialRouter,
  characterRouter,
  modelRouter,
  promptAssistRouter,
  brandKitRouter,
  searchRouter,
  apiKeyRouter,
} from "./routersExtended";
import {
  creditsRouter,
  notificationsRouter,
  adminRouter,
  createNotification,
} from "./routersPhase15";
import {
  usageAnalyticsRouter,
  referralRouter,
  enhancedCreditsRouter,
} from "./routers/phase18";
import {
  autoReferralRouter,
  tieredReferralRouter,
  digestRouter,
} from "./routers/phase19";
import {
  leaderboardRouter,
  creditExpirationRouter,
  emailDigestRouter,
} from "./routers/phase20";
import {
  socialShareRouter,
  creditBudgetRouter,
  achievementRouter,
} from "./routers/phase21";
import {
  achievementShareRouter,
  budgetEmailRouter,
  autoAchievementRouter,
  autoCheckAchievements,
  checkAndSendBudgetAlerts,
} from "./routers/phase22";
import { deductCredits, CREDIT_COSTS } from "./stripe";

// ─── Credit Deduction Helper ────────────────────────────────────────────────
async function tryDeductCredits(userId: number, tool: string, description?: string) {
  const cost = CREDIT_COSTS[tool] || 1;
  if (cost === 0) return { success: true, balance: 0, needed: 0 };
  try {
    const result = await deductCredits(userId, cost, description || `Used ${tool}`);
    if (!result.success) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Insufficient credits. Need ${result.needed}, have ${result.balance}. Purchase more credits to continue.`,
      });
    }
    return result;
  } catch (e: any) {
    if (e instanceof TRPCError) throw e;
    // If credit system is unavailable, allow generation to proceed
    return { success: true, balance: 0, needed: 0 };
  }
}

// ─── Video Templates ─────────────────────────────────────────────────────────
interface VideoTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  toolType: "storyboard" | "script" | "scene-direction" | "soundtrack";
  icon: string;
  prefill: Record<string, unknown>;
}

const VIDEO_TEMPLATES: VideoTemplate[] = [
  // Product & Commercial
  {
    id: "product-launch",
    name: "Product Launch Video",
    category: "commercial",
    description: "A high-energy product reveal with dramatic lighting, close-up shots, and a compelling narrative arc from teaser to full reveal.",
    toolType: "storyboard",
    icon: "🚀",
    prefill: {
      concept: "A sleek new tech product emerges from darkness. Dramatic lighting reveals its design details one by one. Quick cuts showcase features while a confident voiceover builds excitement. Ends with the product floating in a clean white space with the brand logo.",
      sceneCount: 6,
      aspectRatio: "16:9",
      style: "commercial",
    },
  },
  {
    id: "brand-story",
    name: "Brand Story Documentary",
    category: "commercial",
    description: "An authentic brand origin story with interview-style segments, behind-the-scenes footage, and emotional storytelling.",
    toolType: "script",
    icon: "🎬",
    prefill: {
      concept: "Tell the founding story of a passionate artisan brand. Start with the founder in their workshop, intercut with old photos. Show the craft process in beautiful detail. Include customer testimonials. End with the team looking toward the future.",
      duration: 180,
      format: "documentary",
      tone: "inspirational",
    },
  },
  // Tutorial & Education
  {
    id: "tutorial-howto",
    name: "How-To Tutorial",
    category: "education",
    description: "A clear, step-by-step tutorial with screen recordings, annotations, and a friendly presenter guiding viewers through the process.",
    toolType: "script",
    icon: "📚",
    prefill: {
      concept: "A friendly instructor walks through a creative process step by step. Each step is clearly numbered with on-screen graphics. Close-up shots show hand movements and details. Quick recap at the end with all steps summarized.",
      duration: 300,
      format: "tutorial",
      tone: "friendly",
    },
  },
  {
    id: "explainer-animated",
    name: "Animated Explainer",
    category: "education",
    description: "A motion graphics explainer that breaks down complex concepts into simple, engaging visual metaphors with smooth transitions.",
    toolType: "storyboard",
    icon: "✨",
    prefill: {
      concept: "An animated explainer that uses colorful geometric shapes to represent abstract concepts. Smooth morphing transitions between ideas. Clean typography appears alongside visuals. A warm narrator voice guides the viewer through three key points.",
      sceneCount: 5,
      aspectRatio: "16:9",
      style: "abstract",
    },
  },
  // Music & Entertainment
  {
    id: "music-video-cinematic",
    name: "Cinematic Music Video",
    category: "entertainment",
    description: "A visually stunning music video with cinematic color grading, dramatic camera movements, and narrative storytelling synced to the beat.",
    toolType: "storyboard",
    icon: "🎵",
    prefill: {
      concept: "A cinematic music video following a lone figure through a neon-lit city at night. Slow-motion rain sequences, reflections in puddles, dramatic wide shots of empty streets. The mood shifts from melancholy to euphoric as the music builds. Ends with sunrise over the skyline.",
      sceneCount: 8,
      aspectRatio: "16:9",
      style: "cinematic",
    },
  },
  {
    id: "music-video-performance",
    name: "Performance Music Video",
    category: "entertainment",
    description: "A dynamic performance-focused video with creative stage lighting, multi-camera angles, and energetic editing synced to the rhythm.",
    toolType: "scene-direction",
    icon: "🎤",
    prefill: {
      narrative: "A band performs in a dramatic industrial warehouse. Multiple camera angles capture the energy — wide shots of the full band, close-ups on instruments, slow-motion crowd reactions. Lighting shifts with the music dynamics from moody blues to explosive reds.",
      keyframeCount: 6,
      mood: "energetic",
    },
  },
  // Social Media
  {
    id: "social-reel",
    name: "Social Media Reel",
    category: "social",
    description: "A fast-paced, attention-grabbing vertical video optimized for Instagram Reels and TikTok with trending transitions and hooks.",
    toolType: "storyboard",
    icon: "📱",
    prefill: {
      concept: "A punchy 30-second reel with a strong hook in the first 2 seconds. Quick cuts between lifestyle shots, product close-ups, and text overlays. Trending transition effects between scenes. Ends with a clear call-to-action and swipe-up prompt.",
      sceneCount: 6,
      aspectRatio: "9:16",
      style: "commercial",
    },
  },
  {
    id: "social-testimonial",
    name: "Customer Testimonial",
    category: "social",
    description: "An authentic customer story with talking-head interviews, B-roll of product usage, and emotional storytelling for social proof.",
    toolType: "script",
    icon: "💬",
    prefill: {
      concept: "A real customer shares their experience on camera. Intercut with B-roll of them using the product in their daily life. Include before/after moments. Subtle background music builds emotion. End with their genuine recommendation and a product shot.",
      duration: 60,
      format: "testimonial",
      tone: "authentic",
    },
  },
  // Narrative & Film
  {
    id: "short-film",
    name: "Short Film",
    category: "narrative",
    description: "A compelling short film with three-act structure, character development, and cinematic production values.",
    toolType: "script",
    icon: "🎞️",
    prefill: {
      concept: "A short film about a street musician who discovers a mysterious instrument that plays music from people's memories. Three acts: discovery, experimentation with strangers' memories, and the emotional climax when they play their own forgotten memory.",
      duration: 600,
      format: "narrative",
      tone: "dramatic",
    },
  },
  {
    id: "documentary-mini",
    name: "Mini Documentary",
    category: "narrative",
    description: "A concise documentary with interview segments, archival footage, and investigative narration that tells a compelling real-world story.",
    toolType: "script",
    icon: "🎥",
    prefill: {
      concept: "A mini-documentary exploring an underground art movement. Interviews with key artists in their studios, footage of their creative process, archival clips of early exhibitions. Narration connects the personal stories to a broader cultural shift.",
      duration: 480,
      format: "documentary",
      tone: "thoughtful",
    },
  },
  // Atmosphere & Mood
  {
    id: "ambient-mood",
    name: "Ambient Mood Piece",
    category: "atmosphere",
    description: "A meditative visual experience with slow camera movements, natural textures, and an immersive soundscape.",
    toolType: "soundtrack",
    icon: "🌊",
    prefill: {
      videoDescription: "A slow, meditative journey through natural landscapes. Macro shots of water droplets, time-lapse of clouds, gentle camera movements through misty forests. No dialogue — purely visual and auditory immersion. 4 minutes of calm.",
      mood: "calm",
      targetDuration: 240,
    },
  },
  {
    id: "trailer-teaser",
    name: "Cinematic Trailer",
    category: "atmosphere",
    description: "A high-impact trailer with dramatic pacing, powerful sound design, and carefully timed reveals that build anticipation.",
    toolType: "scene-direction",
    icon: "⚡",
    prefill: {
      narrative: "A cinematic trailer that opens with silence and a single striking image. Quick flashes of dramatic moments build in intensity. Bass drops punctuate key reveals. The pace accelerates until a final dramatic pause, then the title card appears with a thunderous sound.",
      keyframeCount: 8,
      mood: "intense",
    },
  },
];

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
        // Deduct credits
        const creditTool = input.mediaType === "video" ? "text-to-video" : "text-to-image";
        await tryDeductCredits(ctx.user.id, creditTool, `Generated ${input.mediaType}: ${input.prompt.slice(0, 50)}`);

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

          // Notify on completion
          try { await createNotification(ctx.user.id, "generation", "Generation Complete", `Your ${input.mediaType} "${input.prompt.slice(0, 40)}..." is ready!`); } catch {}

          // Auto-check achievements and budget alerts (fire-and-forget)
          const achievementPromise = autoCheckAchievements(ctx.user.id).catch(() => []);
          checkAndSendBudgetAlerts(ctx.user.id).catch(() => {});
          const newAchievements = await achievementPromise;

          return { id: genId, status: "completed", imageUrl: url, mediaType: input.mediaType, newAchievements };
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
        // Deduct credits for animation
        await tryDeductCredits(ctx.user.id, "animate", `Animated image #${input.sourceGenerationId}`);

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
        // Deduct credits for entire batch upfront
        const totalCost = input.prompts.reduce((sum, p) => {
          return sum + (CREDIT_COSTS[p.mediaType === "video" ? "text-to-video" : "text-to-image"] || 1);
        }, 0);
        await tryDeductCredits(ctx.user.id, "text-to-image", `Batch generation (${input.prompts.length} items)`);

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
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "super-resolution", "Image upscale");
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
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "style-transfer", `Style transfer: ${input.style}`);
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
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "background-edit", "Background edit");
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
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "background-edit", "Batch background process");
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
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "prompt-assist", "Build prompt");
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

    // Color Palette Extractor — LLM analyzes image and extracts/suggests color palettes
    extractPalette: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          paletteSize: z.number().min(3).max(10).default(6),
          includeComplementary: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "prompt-assist", "Extract palette");
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a color analysis expert. Analyze the provided image and extract the dominant color palette. Return a JSON object with this exact structure:\n{\n  "colors": [{"hex": "#RRGGBB", "name": "Color Name", "percentage": 25}],\n  "mood": "overall mood description",\n  "complementary": [{"hex": "#RRGGBB", "name": "Color Name"}],\n  "harmonies": {"analogous": ["#hex1","#hex2","#hex3"], "triadic": ["#hex1","#hex2","#hex3"], "splitComplementary": ["#hex1","#hex2","#hex3"]}\n}\nExtract exactly ${input.paletteSize} dominant colors. All hex codes must be valid 7-character format. Output ONLY valid JSON.`,
              },
              {
                role: "user",
                content: [
                  { type: "text" as const, text: `Extract the ${input.paletteSize} most dominant colors from this image${input.includeComplementary ? " and suggest complementary colors" : ""}.` },
                  { type: "image_url" as const, image_url: { url: input.imageUrl } },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "color_palette",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    colors: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          hex: { type: "string" },
                          name: { type: "string" },
                          percentage: { type: "number" },
                        },
                        required: ["hex", "name", "percentage"],
                        additionalProperties: false,
                      },
                    },
                    mood: { type: "string" },
                    complementary: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          hex: { type: "string" },
                          name: { type: "string" },
                        },
                        required: ["hex", "name"],
                        additionalProperties: false,
                      },
                    },
                    harmonies: {
                      type: "object",
                      properties: {
                        analogous: { type: "array", items: { type: "string" } },
                        triadic: { type: "array", items: { type: "string" } },
                        splitComplementary: { type: "array", items: { type: "string" } },
                      },
                      required: ["analogous", "triadic", "splitComplementary"],
                      additionalProperties: false,
                    },
                  },
                  required: ["colors", "mood", "complementary", "harmonies"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = result.choices[0]?.message?.content;
          const palette = typeof content === "string" ? JSON.parse(content) : null;
          if (!palette) throw new Error("Failed to parse palette");

          return { ...palette, status: "completed" as const };
        } catch (error: any) {
          // Fallback palette
          return {
            colors: [
              { hex: "#2D3436", name: "Dark Charcoal", percentage: 30 },
              { hex: "#636E72", name: "Storm Gray", percentage: 25 },
              { hex: "#B2BEC3", name: "Silver Sand", percentage: 20 },
              { hex: "#DFE6E9", name: "Light Gray", percentage: 15 },
              { hex: "#74B9FF", name: "Sky Blue", percentage: 10 },
            ],
            mood: "Unable to analyze — showing default palette",
            complementary: [{ hex: "#FF7675", name: "Coral" }, { hex: "#FDCB6E", name: "Golden" }],
            harmonies: { analogous: ["#74B9FF", "#A29BFE", "#81ECEC"], triadic: ["#74B9FF", "#FF7675", "#55EFC4"], splitComplementary: ["#74B9FF", "#E17055", "#FDCB6E"] },
            status: "fallback" as const,
          };
        }
      }),

    // Image Variations — generate multiple variations of an uploaded image
    generateVariations: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          count: z.number().min(2).max(6).default(4),
          variationType: z.enum([
            "subtle",
            "moderate",
            "dramatic",
            "style-mix",
          ]).default("moderate"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-image", "Generate variations");
        const variationDescriptions: Record<string, string[]> = {
          "subtle": [
            "slightly different color temperature, warmer tones",
            "subtle lighting shift, softer shadows",
            "minor composition adjustment, slightly different angle",
            "gentle color grading change, cooler palette",
            "small detail variations, enhanced textures",
            "slight atmospheric change, more depth",
          ],
          "moderate": [
            "different time of day lighting, golden hour",
            "alternative color scheme, complementary palette",
            "different artistic rendering, more painterly",
            "shifted perspective, wider angle view",
            "enhanced atmospheric effects, volumetric light",
            "different seasonal setting, autumn tones",
          ],
          "dramatic": [
            "completely different art style, oil painting",
            "inverted mood, dark and moody atmosphere",
            "surreal interpretation, dreamlike quality",
            "minimalist reimagining, simplified forms",
            "maximalist version, rich ornate details",
            "abstract reinterpretation, geometric forms",
          ],
          "style-mix": [
            "reimagined as Japanese ukiyo-e woodblock print",
            "reimagined as Art Deco poster illustration",
            "reimagined as watercolor sketch",
            "reimagined as neon cyberpunk scene",
            "reimagined as vintage photograph",
            "reimagined as stained glass artwork",
          ],
        };

        const descriptions = variationDescriptions[input.variationType];
        const results: Array<{ url: string | null; variation: string; status: string; error?: string }> = [];

        for (let i = 0; i < input.count; i++) {
          const desc = descriptions[i % descriptions.length];
          try {
            const { url } = await generateImage({
              prompt: `Create a variation of this image with ${desc}. Maintain the core subject and composition but apply the described changes. Professional quality output.`,
              originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
            });
            results.push({ url: url ?? null, variation: desc, status: "completed" });
          } catch (error: any) {
            results.push({ url: null, variation: desc, status: "failed", error: error.message });
          }
        }

        return { results, total: input.count, completed: results.filter(r => r.status === "completed").length };
      }),

    // Inpainting Editor — edit specific regions of an image via text prompt
    inpaint: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          editPrompt: z.string().min(1).max(500),
          regionDescription: z.string().max(200).optional(),
          preserveStyle: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-image", "Inpaint");
        try {
          const styleNote = input.preserveStyle ? " Maintain the exact same artistic style, lighting, and color palette as the original." : "";
          const regionNote = input.regionDescription ? ` Focus the edit on: ${input.regionDescription}.` : "";

          const { url } = await generateImage({
            prompt: `Edit this image: ${input.editPrompt}.${regionNote}${styleNote} Make the edit look natural and seamlessly integrated. Professional quality.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Face Enhancer — enhance/restore faces in images
    enhanceFace: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          enhancementLevel: z.enum(["light", "moderate", "heavy"]).default("moderate"),
          preserveIdentity: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "face-enhance", "Enhance face");
        const levelDescriptions: Record<string, string> = {
          "light": "subtle enhancement with minor sharpening, gentle skin smoothing, and slight detail improvement",
          "moderate": "balanced enhancement with clear sharpening, skin texture improvement, eye detail enhancement, and lighting correction",
          "heavy": "intensive restoration with maximum sharpening, artifact removal, skin retouching, eye and hair detail enhancement, and professional-grade lighting correction",
        };

        const levelDesc = levelDescriptions[input.enhancementLevel];
        const identityNote = input.preserveIdentity ? " Preserve the exact identity and likeness of the person — do not change facial features, only enhance quality." : "";

        try {
          const { url } = await generateImage({
            prompt: `Enhance and restore the face(s) in this portrait image with ${levelDesc}.${identityNote} Professional portrait retouching quality. All content is 100% fictional synthetic media.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const, enhancementLevel: input.enhancementLevel };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Outpainting / Image Expander — extend images beyond their borders
    outpaint: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          direction: z.enum(["up", "down", "left", "right", "all"]).default("all"),
          expansionAmount: z.enum(["small", "medium", "large"]).default("medium"),
          fillDescription: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-image", "Outpaint");
        const directionPrompts: Record<string, string> = {
          "up": "Extend the top of this image upward, seamlessly continuing the scene above",
          "down": "Extend the bottom of this image downward, seamlessly continuing the scene below",
          "left": "Extend the left side of this image, seamlessly continuing the scene to the left",
          "right": "Extend the right side of this image, seamlessly continuing the scene to the right",
          "all": "Extend this image outward in all directions, seamlessly expanding the entire scene",
        };
        const sizeDescriptions: Record<string, string> = {
          "small": "by about 25%",
          "medium": "by about 50%",
          "large": "by about 100%, doubling the canvas",
        };
        const fillNote = input.fillDescription ? ` Fill the new area with: ${input.fillDescription}.` : " Fill the new area with contextually appropriate content that matches the existing scene.";

        try {
          const { url } = await generateImage({
            prompt: `${directionPrompts[input.direction]} ${sizeDescriptions[input.expansionAmount]}.${fillNote} Maintain perfect style consistency, matching colors, lighting, perspective, and artistic style. The expansion should look completely natural and seamless. Professional quality.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, direction: input.direction };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Object Eraser — remove unwanted objects from images
    eraseObject: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          objectDescription: z.string().min(1).max(500),
          fillMethod: z.enum(["auto", "blur", "pattern"]).default("auto"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "object-remove", "Erase object");
        const fillMethods: Record<string, string> = {
          "auto": "Fill the removed area with contextually appropriate content that blends seamlessly with the surrounding scene",
          "blur": "Fill the removed area with a smooth blurred version of the surrounding colors",
          "pattern": "Fill the removed area by extending the surrounding patterns and textures",
        };
        try {
          const { url } = await generateImage({
            prompt: `Remove the following object from this image: ${input.objectDescription}. ${fillMethods[input.fillMethod]}. The result should look completely natural as if the object was never there. Maintain the exact same style, lighting, and quality of the original image. Professional quality output.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // AI Text Effects — generate stylized text/typography
    textEffects: protectedProcedure
      .input(
        z.object({
          text: z.string().min(1).max(100),
          effectStyle: z.enum(["fire", "water", "neon", "gold", "ice", "nature", "galaxy", "chrome", "graffiti", "crystal"]).default("neon"),
          backgroundColor: z.enum(["dark", "light", "transparent", "gradient"]).default("dark"),
          fontSize: z.enum(["small", "medium", "large", "extra-large"]).default("large"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-image", "Text effects");
        const effectDescriptions: Record<string, string> = {
          "fire": "blazing fire and flames, burning embers, orange and red glow, smoke wisps",
          "water": "flowing water and liquid, ocean waves, blue translucent, water droplets, reflections",
          "neon": "bright neon glow, electric tubes, cyberpunk style, vivid pink/blue/purple light, dark background with glow",
          "gold": "luxurious gold metallic, ornate embossing, shimmering golden light, premium elegant feel",
          "ice": "frozen ice crystals, frost, icicles, cold blue-white glow, winter frozen effect",
          "nature": "growing vines, leaves, flowers, moss, organic natural textures, green and earth tones",
          "galaxy": "cosmic nebula, stars, space dust, aurora colors, deep space purple and blue",
          "chrome": "polished chrome metal, mirror reflections, silver metallic sheen, futuristic",
          "graffiti": "street art spray paint, urban wall texture, bold colors, dripping paint, grunge",
          "crystal": "transparent crystal facets, rainbow light refractions, gemstone quality, prismatic",
        };
        const bgDescriptions: Record<string, string> = {
          "dark": "on a dark black background",
          "light": "on a clean white background",
          "transparent": "on a minimal background with subtle gradient",
          "gradient": "on a complementary gradient background",
        };
        const sizeDescriptions: Record<string, string> = {
          "small": "compact lettering",
          "medium": "medium-sized bold lettering",
          "large": "large prominent bold lettering",
          "extra-large": "massive dominating bold lettering filling the frame",
        };

        try {
          const { url } = await generateImage({
            prompt: `Create stunning AI-generated text art: the word "${input.text}" rendered with ${effectDescriptions[input.effectStyle]} effect. ${sizeDescriptions[input.fontSize]}, ${bgDescriptions[input.backgroundColor]}. The text should be clearly readable and the effect should be dramatic and visually impressive. Typography art, text effects, digital art, ultra high quality, 4K resolution.`,
          });
          return { url, status: "completed" as const, text: input.text, effect: input.effectStyle };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Image Blender / Mashup — blend two images into one creative output
    blendImages: protectedProcedure
      .input(
        z.object({
          imageUrl1: z.string().url(),
          imageUrl2: z.string().url(),
          blendMode: z.enum(["merge", "double-exposure", "collage", "morph", "dreamscape"]).default("merge"),
          blendStrength: z.number().min(0.1).max(1.0).default(0.5),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "image-merge", "Blend images");
        const blendDescriptions: Record<string, string> = {
          "merge": "Seamlessly merge these two images into a single cohesive composition, blending elements from both naturally",
          "double-exposure": "Create a cinematic double-exposure effect combining these two images, with one image overlaid transparently on the other like a film photography technique",
          "collage": "Create an artistic collage that combines elements from both images in a creative, visually striking arrangement",
          "morph": "Create a surreal morph between these two images, blending their subjects and environments into a dreamlike hybrid",
          "dreamscape": "Create a fantastical dreamscape that combines the essence of both images into an otherworldly scene",
        };

        try {
          const { url } = await generateImage({
            prompt: `${blendDescriptions[input.blendMode]}. Blend intensity: ${Math.round(input.blendStrength * 100)}%. Professional quality, visually stunning, artistic composition. High resolution output.`,
            originalImages: [
              { url: input.imageUrl1, mimeType: "image/png" },
              { url: input.imageUrl2, mimeType: "image/png" },
            ],
          });
          return { url, status: "completed" as const, blendMode: input.blendMode };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Sketch to Image — convert rough sketches to polished images
    sketchToImage: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          description: z.string().min(1).max(1000),
          outputStyle: z.enum(["realistic", "digital-art", "anime", "oil-painting", "watercolor", "3d-render"]).default("digital-art"),
          detailLevel: z.enum(["low", "medium", "high"]).default("medium"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "sketch-to-image", "Sketch to image");
        const styleDescriptions: Record<string, string> = {
          "realistic": "photorealistic rendering, lifelike details, natural lighting, high-resolution photography quality",
          "digital-art": "polished digital art, clean lines, vibrant colors, professional illustration quality",
          "anime": "anime/manga art style, cel-shaded, expressive, Japanese animation quality",
          "oil-painting": "classical oil painting style, visible brushstrokes, rich textures, fine art gallery quality",
          "watercolor": "delicate watercolor painting, soft washes, flowing colors, artistic paper texture",
          "3d-render": "3D rendered, volumetric lighting, subsurface scattering, Octane/Blender quality render",
        };
        const detailDescriptions: Record<string, string> = {
          "low": "simplified, clean, minimal detail",
          "medium": "balanced detail, clear definition",
          "high": "extremely detailed, intricate, maximum resolution",
        };

        try {
          const { url } = await generateImage({
            prompt: `Transform this rough sketch into a polished, finished artwork: ${input.description}. Style: ${styleDescriptions[input.outputStyle]}. Detail level: ${detailDescriptions[input.detailLevel]}. Use the sketch as a structural guide for composition and layout, but create a fully realized, professional-quality final image. The output should look like a finished piece, not a sketch.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, style: input.outputStyle };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // AI Color Grading — apply cinematic color grades to images
    colorGrade: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          grade: z.enum(["cinematic", "vintage", "moody", "bright", "noir", "sunset", "teal-orange", "pastel", "dramatic", "film-noir"]).default("cinematic"),
          intensity: z.number().min(0.1).max(1.0).default(0.7),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "color-grade", "Color grade");
        const gradeDescriptions: Record<string, string> = {
          "cinematic": "cinematic color grading with rich contrast, teal shadows and warm highlights, Hollywood blockbuster look",
          "vintage": "vintage film look with faded colors, warm amber tones, slight grain, 1970s photography feel",
          "moody": "dark moody atmosphere, desaturated with deep shadows, cool blue-green undertones, brooding feel",
          "bright": "bright and airy, lifted shadows, soft warm tones, clean and fresh feel, lifestyle photography",
          "noir": "film noir style, high contrast black and white with dramatic shadows and highlights",
          "sunset": "golden hour warmth, rich orange and pink tones, soft glowing light, romantic atmosphere",
          "teal-orange": "popular teal and orange color grade, complementary color split, modern cinema look",
          "pastel": "soft pastel color palette, muted tones, dreamy and ethereal, gentle light",
          "dramatic": "high drama, intense contrast, vivid saturated colors, bold and impactful",
          "film-noir": "classic black and white film noir, deep blacks, bright whites, dramatic side lighting, detective movie aesthetic",
        };

        try {
          const { url } = await generateImage({
            prompt: `Apply ${gradeDescriptions[input.grade]} color grading to this image at ${Math.round(input.intensity * 100)}% intensity. Maintain the original composition and subjects, only modify the color treatment and mood. Professional color grading quality, like a professional colorist's work.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, grade: input.grade };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Image-to-Prompt Analyzer — reverse-engineer a prompt from an image
    analyzeImage: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          detailLevel: z.enum(["brief", "standard", "detailed"]).default("standard"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "prompt-assist", "Analyze image");
        const detailInstructions: Record<string, string> = {
          "brief": "Write a concise 1-2 sentence prompt capturing the essential subject and style.",
          "standard": "Write a detailed prompt of 2-4 sentences covering subject, style, mood, lighting, composition, and key details.",
          "detailed": "Write a comprehensive prompt of 4-6 sentences covering every aspect: subject, style, mood, lighting, composition, color palette, textures, atmosphere, camera angle, and artistic techniques used.",
        };

        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert at analyzing images and reverse-engineering AI generation prompts. Given an image, describe it as a detailed prompt that could be used to recreate it with an AI image generator. ${detailInstructions[input.detailLevel]} Include artistic terminology and quality modifiers. Output a JSON object with: "prompt" (the generation prompt), "tags" (array of 3-8 descriptive tags), "style" (detected art style), "mood" (detected mood/atmosphere). All content is 100% fictional synthetic media.`,
              },
              {
                role: "user",
                content: [
                  { type: "text" as const, text: "Analyze this image and generate a prompt that could recreate it." },
                  { type: "image_url" as const, image_url: { url: input.imageUrl } },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "image_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    prompt: { type: "string", description: "The reverse-engineered generation prompt" },
                    tags: { type: "array", items: { type: "string" }, description: "Descriptive tags" },
                    style: { type: "string", description: "Detected art style" },
                    mood: { type: "string", description: "Detected mood/atmosphere" },
                  },
                  required: ["prompt", "tags", "style", "mood"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = result.choices[0]?.message?.content;
          const analysis = typeof content === "string" ? JSON.parse(content) : null;
          if (!analysis) throw new Error("Failed to parse analysis");

          return { ...analysis, status: "completed" as const, detailLevel: input.detailLevel };
        } catch (error: any) {
          return {
            prompt: "Unable to analyze image — please try again",
            tags: [],
            style: "unknown",
            mood: "unknown",
            status: "failed" as const,
            error: error.message,
          };
        }
      }),
  }),

  video: router({
    // Video Storyboard Generator — LLM creates multi-scene storyboard from a concept
    generateStoryboard: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(2000),
          sceneCount: z.number().min(2).max(8).default(4),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).default("16:9"),
          style: z.enum(["cinematic", "anime", "documentary", "music-video", "commercial", "abstract"]).default("cinematic"),
          generateImages: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "storyboard", "Generate storyboard");
        try {
          const storyboardResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a professional storyboard artist and video director. Given a video concept, create a detailed storyboard with ${input.sceneCount} scenes. Style: ${input.style}. Aspect ratio: ${input.aspectRatio}. For each scene provide: scene number, duration in seconds, camera angle/movement, visual description (detailed enough for AI image generation), dialogue/narration if any, mood/atmosphere, and transition to next scene. Output as JSON.`,
              },
              { role: "user", content: `Create a storyboard for: ${input.concept}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "storyboard",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Video title" },
                    synopsis: { type: "string", description: "Brief video synopsis" },
                    totalDuration: { type: "number", description: "Estimated total duration in seconds" },
                    scenes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sceneNumber: { type: "number" },
                          duration: { type: "number", description: "Duration in seconds" },
                          cameraAngle: { type: "string" },
                          cameraMovement: { type: "string" },
                          visualDescription: { type: "string" },
                          narration: { type: "string" },
                          mood: { type: "string" },
                          transition: { type: "string" },
                        },
                        required: ["sceneNumber", "duration", "cameraAngle", "cameraMovement", "visualDescription", "narration", "mood", "transition"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["title", "synopsis", "totalDuration", "scenes"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = storyboardResult.choices[0]?.message?.content;
          const storyboard = typeof content === "string" ? JSON.parse(content) : null;
          if (!storyboard) throw new Error("Failed to parse storyboard");

          // Optionally generate images for each scene
          if (input.generateImages) {
            const scenesWithImages = [];
            for (const scene of storyboard.scenes) {
              try {
                const { url } = await generateImage({
                  prompt: `${scene.visualDescription}. Camera: ${scene.cameraAngle}, ${scene.cameraMovement}. Mood: ${scene.mood}. Style: ${input.style} filmmaking, ${input.aspectRatio} aspect ratio. Professional cinematography, high production value.`,
                });
                scenesWithImages.push({ ...scene, imageUrl: url ?? null });
              } catch {
                scenesWithImages.push({ ...scene, imageUrl: null });
              }
            }
            storyboard.scenes = scenesWithImages;
          }

          return { ...storyboard, status: "completed" as const, style: input.style };
        } catch (error: any) {
          return { title: "", synopsis: "", totalDuration: 0, scenes: [], status: "failed" as const, error: error.message };
        }
      }),

    // Video Scene Director — generate keyframe sequence from narrative prompt
    directScene: protectedProcedure
      .input(
        z.object({
          narrative: z.string().min(1).max(2000),
          keyframeCount: z.number().min(2).max(6).default(4),
          cameraStyle: z.enum(["static", "tracking", "crane", "handheld", "drone", "steadicam"]).default("tracking"),
          mood: z.enum(["epic", "intimate", "tense", "dreamy", "energetic", "melancholic"]).default("epic"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "scene-director", "Direct scene");
        try {
          const directorResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a film director creating a keyframe sequence. Camera style: ${input.cameraStyle}. Mood: ${input.mood}. Create ${input.keyframeCount} keyframes that tell a visual story. For each keyframe: describe the exact visual composition, camera position, lighting, and how it transitions from the previous frame. Output as JSON.`,
              },
              { role: "user", content: `Direct this scene: ${input.narrative}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "scene_direction",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    sceneTitle: { type: "string" },
                    overallDirection: { type: "string" },
                    keyframes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          frameNumber: { type: "number" },
                          timestamp: { type: "string", description: "Timecode like 00:00" },
                          composition: { type: "string" },
                          cameraPosition: { type: "string" },
                          lighting: { type: "string" },
                          movement: { type: "string" },
                          notes: { type: "string" },
                        },
                        required: ["frameNumber", "timestamp", "composition", "cameraPosition", "lighting", "movement", "notes"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["sceneTitle", "overallDirection", "keyframes"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = directorResult.choices[0]?.message?.content;
          const direction = typeof content === "string" ? JSON.parse(content) : null;
          if (!direction) throw new Error("Failed to parse direction");

          // Generate keyframe images
          const keyframesWithImages = [];
          for (const kf of direction.keyframes) {
            try {
              const { url } = await generateImage({
                prompt: `${kf.composition}. Camera: ${kf.cameraPosition}. Lighting: ${kf.lighting}. ${kf.movement}. Cinematic ${input.mood} mood, ${input.cameraStyle} camera style. Professional cinematography, film still quality.`,
              });
              keyframesWithImages.push({ ...kf, imageUrl: url ?? null });
            } catch {
              keyframesWithImages.push({ ...kf, imageUrl: null });
            }
          }
          direction.keyframes = keyframesWithImages;

          return { ...direction, status: "completed" as const, cameraStyle: input.cameraStyle, mood: input.mood };
        } catch (error: any) {
          return { sceneTitle: "", overallDirection: "", keyframes: [], status: "failed" as const, error: error.message };
        }
      }),

    // Video Style Transfer — apply artistic style to video generation
    styleTransfer: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          videoStyle: z.enum(["anime", "noir", "watercolor", "oil-painting", "pixel-art", "comic-book", "claymation", "retro-vhs"]).default("anime"),
          preserveMotion: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "video-style-transfer", "Video style transfer");
        const styleDescriptions: Record<string, string> = {
          "anime": "Japanese anime style, cel-shaded, vibrant colors, clean lines, Studio Ghibli quality",
          "noir": "film noir style, high contrast black and white, dramatic shadows, 1940s detective film",
          "watercolor": "delicate watercolor painting, soft washes, flowing colors, artistic paper texture",
          "oil-painting": "classical oil painting, visible brushstrokes, rich textures, museum gallery quality",
          "pixel-art": "retro pixel art style, 16-bit aesthetic, clean pixel edges, nostalgic gaming look",
          "comic-book": "bold comic book style, thick outlines, halftone dots, speech bubble ready, pop art colors",
          "claymation": "claymation/stop-motion style, clay texture, rounded forms, Wallace & Gromit aesthetic",
          "retro-vhs": "retro VHS aesthetic, scan lines, color bleeding, tracking artifacts, 1980s home video",
        };
        const motionNote = input.preserveMotion ? " Preserve the original composition and subject positioning exactly." : "";

        try {
          const { url } = await generateImage({
            prompt: `Transform this image into ${styleDescriptions[input.videoStyle]} style.${motionNote} This is a keyframe for video production. Professional quality, consistent style application. Cinematic composition.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, style: input.videoStyle };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Video Upscaler — enhance video frame quality
    upscaleFrame: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          scaleFactor: z.enum(["2x", "4x"]).default("2x"),
          enhanceDetails: z.boolean().default(true),
          denoiseLevel: z.enum(["none", "light", "heavy"]).default("light"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "video-upscaler", "Video upscale");
        const denoiseDesc: Record<string, string> = {
          "none": "",
          "light": " Apply light denoising to clean up minor artifacts.",
          "heavy": " Apply heavy denoising to remove significant noise and compression artifacts.",
        };
        const detailNote = input.enhanceDetails ? " Enhance fine details, sharpen edges, and improve texture clarity." : "";

        try {
          const { url } = await generateImage({
            prompt: `Upscale and enhance this video frame to ${input.scaleFactor} resolution. Maintain perfect fidelity to the original content.${detailNote}${denoiseDesc[input.denoiseLevel]} Professional video post-production quality. Preserve colors, contrast, and artistic intent exactly. Ultra high resolution, crystal clear output.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, scaleFactor: input.scaleFactor };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Video Soundtrack Suggester — LLM suggests music for video concept
    suggestSoundtrack: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(2000),
          duration: z.number().min(5).max(300).default(30),
          mood: z.enum(["epic", "calm", "tense", "happy", "sad", "mysterious", "energetic", "romantic"]).default("epic"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "soundtrack-suggest", "Suggest soundtrack");
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a professional music supervisor for film and video. Given a video concept, suggest detailed soundtrack recommendations. Consider mood: ${input.mood}, duration: ${input.duration}s. Provide genre, tempo (BPM), key instruments, reference tracks, and a detailed description of the ideal soundtrack. Also suggest sound effects. Output as JSON.`,
              },
              { role: "user", content: `Suggest soundtrack for: ${input.concept}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "soundtrack_suggestion",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    primaryGenre: { type: "string" },
                    subGenres: { type: "array", items: { type: "string" } },
                    tempo: { type: "string", description: "BPM range" },
                    keyInstruments: { type: "array", items: { type: "string" } },
                    moodProgression: { type: "string" },
                    description: { type: "string" },
                    referenceTracks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          artist: { type: "string" },
                          reason: { type: "string" },
                        },
                        required: ["title", "artist", "reason"],
                        additionalProperties: false,
                      },
                    },
                    soundEffects: { type: "array", items: { type: "string" } },
                    licensingNotes: { type: "string" },
                  },
                  required: ["primaryGenre", "subGenres", "tempo", "keyInstruments", "moodProgression", "description", "referenceTracks", "soundEffects", "licensingNotes"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = result.choices[0]?.message?.content;
          const suggestion = typeof content === "string" ? JSON.parse(content) : null;
          if (!suggestion) throw new Error("Failed to parse suggestion");

          return { ...suggestion, status: "completed" as const, mood: input.mood, duration: input.duration };
        } catch (error: any) {
          return {
            primaryGenre: "", subGenres: [], tempo: "", keyInstruments: [], moodProgression: "",
            description: "Unable to generate suggestion", referenceTracks: [], soundEffects: [], licensingNotes: "",
            status: "failed" as const, error: error.message,
          };
        }
      }),

    // Text-to-Video Script — LLM writes detailed video script
    generateScript: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(2000),
          duration: z.number().min(10).max(300).default(60),
          format: z.enum(["narrative", "commercial", "tutorial", "music-video", "documentary", "social-media"]).default("narrative"),
          tone: z.enum(["professional", "casual", "dramatic", "humorous", "inspirational"]).default("professional"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-video-script", "Generate script");
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a professional video scriptwriter. Write a detailed video script for a ${input.duration}-second ${input.format} video. Tone: ${input.tone}. Include scene-by-scene breakdown with: visual descriptions, camera directions, narration/dialogue, timing, and production notes. Output as JSON.`,
              },
              { role: "user", content: `Write a video script for: ${input.concept}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "video_script",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    logline: { type: "string" },
                    targetDuration: { type: "number" },
                    format: { type: "string" },
                    scenes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sceneNumber: { type: "number" },
                          startTime: { type: "string" },
                          endTime: { type: "string" },
                          location: { type: "string" },
                          visualDescription: { type: "string" },
                          cameraDirection: { type: "string" },
                          narration: { type: "string" },
                          dialogue: { type: "string" },
                          soundDesign: { type: "string" },
                          productionNotes: { type: "string" },
                        },
                        required: ["sceneNumber", "startTime", "endTime", "location", "visualDescription", "cameraDirection", "narration", "dialogue", "soundDesign", "productionNotes"],
                        additionalProperties: false,
                      },
                    },
                    productionBudget: { type: "string" },
                    equipmentNeeded: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "logline", "targetDuration", "format", "scenes", "productionBudget", "equipmentNeeded"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = result.choices[0]?.message?.content;
          const script = typeof content === "string" ? JSON.parse(content) : null;
          if (!script) throw new Error("Failed to parse script");

          return { ...script, status: "completed" as const, tone: input.tone };
        } catch (error: any) {
          return {
            title: "", logline: "", targetDuration: 0, format: "", scenes: [],
            productionBudget: "", equipmentNeeded: [],
            status: "failed" as const, error: error.message,
          };
        }
      }),
  }),

  videoProject: router({
    // Save a video project
    save: protectedProcedure
      .input(
        z.object({
          id: z.number().optional(), // if provided, update existing
          type: z.enum(["storyboard", "script", "scene-direction", "soundtrack"]),
          title: z.string().min(1).max(256),
          description: z.string().max(1000).optional(),
          data: z.any(),
          thumbnailUrl: z.string().optional(),
          templateId: z.string().optional(),
          changeNote: z.string().max(500).optional(),
          source: z.enum(["manual", "ai-refinement", "revert", "template"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.id) {
          // Check if user is owner or editor collaborator
          const project = await getVideoProject(input.id, ctx.user.id);
          const collabRole = project ? null : await getUserCollaboratorRole(input.id, ctx.user.id);
          if (!project && collabRole !== "editor") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to edit this project" });
          }
          const ownerId = project ? ctx.user.id : (await getVideoProject(input.id, 0 as any))?.userId ?? ctx.user.id;
          // Auto-save revision before updating
          try {
            const latestVersion = await getLatestRevisionVersion(input.id);
            await createRevision({
              projectId: input.id,
              userId: ctx.user.id,
              version: latestVersion + 1,
              data: input.data,
              changeNote: input.changeNote ?? "Manual save",
              source: (input.source as any) ?? "manual",
            });
          } catch (_) { /* revision save is best-effort */ }
          if (project) {
            await updateVideoProject(input.id, ctx.user.id, {
              title: input.title,
              description: input.description ?? undefined,
              data: input.data,
              thumbnailUrl: input.thumbnailUrl ?? undefined,
            });
          }
          // Notify project owner if editor is a collaborator
          if (collabRole === "editor" && project === null) {
            try {
              const ownerProject = await getVideoProject(input.id, ownerId);
              if (ownerProject) {
                await createNotification(
                  ownerId,
                  "collaboration",
                  "Project Edited",
                  `A collaborator edited your project "${input.title}"`,
                  { projectId: input.id }
                );
              }
            } catch {}
          }
          return { id: input.id, action: "updated" as const };
        }
        const { id } = await createVideoProject({
          userId: ctx.user.id,
          type: input.type,
          title: input.title,
          description: input.description ?? undefined,
          data: input.data,
          thumbnailUrl: input.thumbnailUrl ?? undefined,
          templateId: input.templateId ?? undefined,
        });
        return { id, action: "created" as const };
      }),

    // List user's video projects
    list: protectedProcedure
      .input(
        z.object({
          type: z.enum(["storyboard", "script", "scene-direction", "soundtrack"]).optional(),
          limit: z.number().min(1).max(50).optional(),
          offset: z.number().min(0).optional(),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        return listVideoProjects(ctx.user.id, input);
      }),

    // Get a single video project
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getVideoProject(input.id, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        return project;
      }),

    // Delete a video project
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteVideoProject(input.id, ctx.user.id);
        return { success: true };
      }),

    // Export project as structured data for PDF generation (client-side)
    exportData: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getVideoProject(input.id, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        return {
          id: project.id,
          type: project.type,
          title: project.title,
          description: project.description,
          data: project.data,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        };
      }),

    // List available templates
    templates: publicProcedure
      .input(
        z.object({
          category: z.string().optional(),
        }).default({})
      )
      .query(({ input }) => {
        const templates = VIDEO_TEMPLATES;
        if (input.category) {
          return templates.filter((t) => t.category === input.category);
        }
        return templates;
      }),

    // Get a single template by ID
    getTemplate: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        const template = VIDEO_TEMPLATES.find((t) => t.id === input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return template;
      }),

    // ─── Collaboration ────────────────────────────────────────────
    createShareLink: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          permission: z.enum(["viewer", "editor"]).default("viewer"),
          expiresInHours: z.number().min(1).max(720).optional(),
          maxUses: z.number().min(1).max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Verify ownership
        const project = await getVideoProject(input.projectId, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const expiresAt = input.expiresInHours
          ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
          : undefined;
        const { id } = await createShareToken({
          projectId: input.projectId,
          token,
          permission: input.permission,
          createdBy: ctx.user.id,
          expiresAt,
          maxUses: input.maxUses,
        });
        return { id, token, permission: input.permission, expiresAt };
      }),

    acceptShareLink: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const shareToken = await getShareToken(input.token);
        if (!shareToken || !shareToken.active) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired share link" });
        }
        if (shareToken.expiresAt && new Date(shareToken.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Share link has expired" });
        }
        if (shareToken.maxUses && shareToken.useCount >= shareToken.maxUses) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Share link has reached maximum uses" });
        }
        // Don't add owner as collaborator
        const project = await getVideoProject(shareToken.projectId, ctx.user.id);
        if (project) {
          return { projectId: shareToken.projectId, role: "owner" as const, alreadyOwner: true };
        }
        const { action } = await addCollaborator({
          projectId: shareToken.projectId,
          userId: ctx.user.id,
          role: shareToken.permission,
          invitedBy: shareToken.createdBy,
        });
        await incrementShareTokenUse(shareToken.id);
        // Notify project owner that someone joined
        try {
          await createNotification(
            shareToken.createdBy,
            "collaboration",
            "New Collaborator",
            `Someone joined your project via share link as ${shareToken.permission}`,
            { projectId: shareToken.projectId }
          );
        } catch {}
        return { projectId: shareToken.projectId, role: shareToken.permission, action };
      }),

    listCollaborators: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getVideoProject(input.projectId, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or not authorized" });
        return listCollaborators(input.projectId);
      }),

    removeCollaborator: protectedProcedure
      .input(z.object({ collaboratorId: z.number(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await removeCollaborator(input.collaboratorId, ctx.user.id, input.projectId);
        return { success: true };
      }),

    listShareTokens: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getVideoProject(input.projectId, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        return listShareTokens(input.projectId);
      }),

    deactivateShareToken: protectedProcedure
      .input(z.object({ tokenId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deactivateShareToken(input.tokenId, ctx.user.id);
        return { success: true };
      }),

    sharedWithMe: protectedProcedure.query(async ({ ctx }) => {
      return listSharedWithMe(ctx.user.id);
    }),

    // Get a shared project (for collaborators)
    getShared: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        // Check if owner
        const ownProject = await getVideoProject(input.id, ctx.user.id);
        if (ownProject) return { ...ownProject, accessRole: "owner" as const };
        // Check if collaborator
        const role = await getUserCollaboratorRole(input.id, ctx.user.id);
        if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or not authorized" });
        // Fetch project without owner check (use a raw query approach)
        const db = (await import("./db")).getDb;
        const dbInst = await db();
        if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { videoProjects: vp } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const rows = await dbInst.select().from(vp).where(eq(vp.id, input.id)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
        return { ...rows[0], accessRole: role };
      }),

    // ─── Version History ──────────────────────────────────────────
    listRevisions: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify access (owner or collaborator)
        const project = await getVideoProject(input.projectId, ctx.user.id);
        const collabRole = project ? null : await getUserCollaboratorRole(input.projectId, ctx.user.id);
        if (!project && !collabRole) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or not authorized" });
        }
        return listRevisions(input.projectId);
      }),

    getRevision: protectedProcedure
      .input(z.object({ revisionId: z.number(), projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getVideoProject(input.projectId, ctx.user.id);
        const collabRole = project ? null : await getUserCollaboratorRole(input.projectId, ctx.user.id);
        if (!project && !collabRole) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Not authorized" });
        }
        const revision = await getRevision(input.revisionId, input.projectId);
        if (!revision) throw new TRPCError({ code: "NOT_FOUND", message: "Revision not found" });
        return revision;
      }),

    revertToRevision: protectedProcedure
      .input(z.object({ revisionId: z.number(), projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getVideoProject(input.projectId, ctx.user.id);
        if (!project) throw new TRPCError({ code: "FORBIDDEN", message: "Only the project owner can revert" });
        const revision = await getRevision(input.revisionId, input.projectId);
        if (!revision) throw new TRPCError({ code: "NOT_FOUND", message: "Revision not found" });
        // Save current state as a revision first
        const latestVersion = await getLatestRevisionVersion(input.projectId);
        await createRevision({
          projectId: input.projectId,
          userId: ctx.user.id,
          version: latestVersion + 1,
          data: project.data,
          changeNote: `Reverted to version ${revision.version}`,
          source: "revert",
        });
        // Apply the old revision data
        await updateVideoProject(input.projectId, ctx.user.id, {
          data: revision.data,
        });
        return { success: true, revertedToVersion: revision.version };
      }),

    // ─── AI Refinement ───────────────────────────────────────────
    refineProject: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          feedback: z.string().min(5).max(2000),
          focusAreas: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getVideoProject(input.projectId, ctx.user.id);
        const collabRole = project ? null : await getUserCollaboratorRole(input.projectId, ctx.user.id);
        if (!project && collabRole !== "editor") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to refine this project" });
        }
        // Get the actual project data
        let projectData = project;
        if (!projectData) {
          const { videoProjects: vp } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = (await import("./db")).getDb;
          const dbInst = await db();
          if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
          const rows = await dbInst.select().from(vp).where(eq(vp.id, input.projectId)).limit(1);
          projectData = rows[0] ?? null;
        }
        if (!projectData) throw new TRPCError({ code: "NOT_FOUND" });

        const focusAreasStr = input.focusAreas?.length
          ? `Focus areas: ${input.focusAreas.join(", ")}`
          : "";

        const systemPrompt = projectData.type === "script"
          ? `You are a professional video script consultant. You will receive a video script as JSON and user feedback. Return an IMPROVED version of the script as JSON with the same structure. Improve the script based on the feedback while maintaining the overall concept. ${focusAreasStr}`
          : projectData.type === "storyboard"
          ? `You are a professional storyboard consultant. You will receive a storyboard as JSON and user feedback. Return an IMPROVED version of the storyboard as JSON with the same structure. Improve the storyboard based on the feedback while maintaining the overall concept. ${focusAreasStr}`
          : `You are a professional video production consultant. You will receive project data as JSON and user feedback. Return an IMPROVED version as JSON with the same structure. ${focusAreasStr}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Current project data:\n${JSON.stringify(projectData.data, null, 2)}\n\nUser feedback: ${input.feedback}`,
              },
            ],
            response_format: { type: "json_object" },
          });

          const content = response.choices[0].message.content;
          const refined = JSON.parse(typeof content === "string" ? content : "{}");

          return {
            status: "completed" as const,
            originalData: projectData.data,
            refinedData: refined,
            projectId: input.projectId,
            projectType: projectData.type,
          };
        } catch (err) {
          return {
            status: "failed" as const,
            originalData: projectData.data,
            refinedData: null,
            projectId: input.projectId,
            projectType: projectData.type,
          };
        }
      }),

    // Apply refined data to project
    applyRefinement: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          refinedData: z.any(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getVideoProject(input.projectId, ctx.user.id);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        // Save revision
        const latestVersion = await getLatestRevisionVersion(input.projectId);
        await createRevision({
          projectId: input.projectId,
          userId: ctx.user.id,
          version: latestVersion + 1,
          data: input.refinedData,
          changeNote: "AI refinement applied",
          source: "ai-refinement",
        });
        // Update project
        await updateVideoProject(input.projectId, ctx.user.id, {
          data: input.refinedData,
        });
        return { success: true, version: latestVersion + 1 };
      }),
  }),

  // ─── Extended Feature Routers ──────────────────────────────────────────
  videoGen: videoGenRouter,
  social: socialRouter,
  character: characterRouter,
  models: modelRouter,
  promptAssist: promptAssistRouter,
  brandKit: brandKitRouter,
  search: searchRouter,
  apiKey: apiKeyRouter,

  // ─── Phase 15 Routers ─────────────────────────────────────────────────
  credits: creditsRouter,
  notifications: notificationsRouter,
  admin: adminRouter,

  // ─── Phase 18 Routers ─────────────────────────────────────────────────
  usageAnalytics: usageAnalyticsRouter,
  referral: referralRouter,
  enhancedCredits: enhancedCreditsRouter,

  // ─── Phase 19 Routers ─────────────────────────────────────────────────
  autoReferral: autoReferralRouter,
  tieredReferral: tieredReferralRouter,
  digest: digestRouter,

  // ─── Phase 20 Routers ─────────────────────────────────────────────────
  leaderboard: leaderboardRouter,
  creditExpiration: creditExpirationRouter,
  emailDigest: emailDigestRouter,

  // Phase 21
  socialShare: socialShareRouter,
  creditBudget: creditBudgetRouter,
  achievement: achievementRouter,

  // Phase 22
  achievementShare: achievementShareRouter,
  budgetEmail: budgetEmailRouter,
  autoAchievement: autoAchievementRouter,

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
