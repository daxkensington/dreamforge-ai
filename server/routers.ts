// @ts-nocheck — Express type augmentations don't resolve in Vercel's serverless compiler
import { randomBytes } from "crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateImage } from "./_core/imageGeneration";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  clearToolStatus,
  getAllToolStatus,
  getFailureStats,
  logToolFailure,
  requireToolActive,
  setToolStatus,
} from "./_core/toolStatus";
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
import { pricingRouter } from "./routers/pricing";
import { marketplaceRouter } from "./routers/marketplace";
import { audioRouter } from "./routers/audio";
import { collaborationRouter } from "./routers/collaboration";
import { supportChatRouter } from "./routers/supportChat";
import { deductCredits, refundCredits, CREDIT_COSTS } from "./stripe";
import { getDb } from "./db";
import { userSubscriptions, subscriptionPlans } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { enforceRateLimit } from "./rate-limit";
import { getTierConfig, resolveTierName } from "@shared/tiers";
import { LEGACY_CREDIT_COSTS, TOOL_CREDIT_COSTS } from "@shared/creditCosts";
import { getModelById, canAccessModel } from "./_core/modelRegistry";

// ─── Model Tier Gating ────────────────────────────────────────────────────
// Models are now gated by subscription tier via canAccessModel().
// Legacy PREMIUM_MODEL_IDS kept as a quick-check fallback.
const PREMIUM_MODEL_IDS = new Set([
  // Ultra tier (Studio+)
  "ultra", "fal-flux-pro-ultra", "runway-gen4.5", "runway-gen4-turbo",
  // Premium tier (Pro+)
  "dall-e-3", "dall-e-3-hd", "flux-pro", "fal-flux-kontext", "kling-2.0",
  // Quality tier (Pro+)
  "flux-schnell", "fal-flux-dev", "fal-seedream", "sd3", "kling-1.6", "fal-kling-video",
  // Standard tier (Creator+)
  "grok-image", "fal-flux-schnell", "runpod-flux-dev", "runpod-flux-schnell",
  "fal-wan-video", "minimax-video", "stable-video",
]);

// ─── User Tier Helper ──────────────────────────────────────────────────────
async function getUserTier(userId: number): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "free";
    const rows = await db
      .select({ planName: subscriptionPlans.name })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);
    const rawTier = rows[0]?.planName ?? "free";
    // Resolve legacy tier names (e.g. "enterprise" -> "business")
    return resolveTierName(rawTier);
  } catch {
    return "free";
  }
}

// ─── Credit Deduction Helper ────────────────────────────────────────────────
/**
 * Deduct credits for a tool operation.
 * For model-based generations, pass the modelId to use model-tier-aware pricing.
 * For non-model tools, falls back to TOOL_CREDIT_COSTS or LEGACY_CREDIT_COSTS.
 */
async function tryDeductCredits(userId: number, tool: string, description?: string, modelId?: string) {
  // Kill-switch — block offline tools before we touch the wallet. Throws
  // TRPCError if the tool is in "offline" state; degraded passes through.
  try {
    await requireToolActive(tool);
  } catch (e: any) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: e.message });
  }

  let cost: number;

  if (modelId) {
    // Model-aware pricing: use the model's creditCost.base
    const model = getModelById(modelId);
    cost = model?.creditCost.base ?? (LEGACY_CREDIT_COSTS[tool] || 1);
  } else {
    // Tool-based pricing
    cost = TOOL_CREDIT_COSTS[tool] ?? LEGACY_CREDIT_COSTS[tool] ?? CREDIT_COSTS[tool] ?? 1;
  }

  if (cost === 0) return { success: true, balance: 0, needed: 0 };
  try {
    const result = await deductCredits(userId, cost, description || `Used ${tool}${modelId ? ` (${modelId})` : ""}`);
    if (!result.success) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Insufficient credits. Need ${result.needed}, have ${result.balance}. Purchase more credits to continue.`,
      });
    }
    return result;
  } catch (e: any) {
    if (e instanceof TRPCError) throw e;
    console.error("[tryDeductCredits] Credit deduction failed for user", userId, "tool", tool, ":", e);
    throw e;
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

  toolStatus: router({
    // Public: UI uses this to show degraded/offline banners before submit
    listPublic: publicProcedure.query(async () => {
      const rows = await getAllToolStatus();
      return rows.filter((r) => r.status !== "active");
    }),
    // Admin: full table for the kill-switch UI
    listAdmin: adminProcedure.query(async () => {
      return getAllToolStatus();
    }),
    // Admin: recent failure counts per tool (last 15m/1h/24h)
    failureStats: adminProcedure.query(async () => {
      return getFailureStats();
    }),
    set: adminProcedure
      .input(
        z.object({
          toolId: z.string().min(1).max(100),
          status: z.enum(["active", "degraded", "offline"]),
          message: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await setToolStatus(
          input.toolId,
          input.status,
          input.message ?? null,
          ctx.user.id,
        );
        return { success: true };
      }),
    clear: adminProcedure
      .input(z.object({ toolId: z.string().min(1).max(100) }))
      .mutation(async ({ input }) => {
        await clearToolStatus(input.toolId);
        return { success: true };
      }),
  }),

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(() => {
      // In Next.js, logout is handled client-side via NextAuth's signOut().
      // This endpoint remains for backward compatibility but is a no-op.
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
        // Rate limit: 20 requests per minute per user
        enforceRateLimit(`generation.create:${ctx.user.id}`, 20, 60_000, "Generation rate limit exceeded — max 20 per minute.");

        // Get user tier for watermark decision + enforcement
        const userTier = await getUserTier(ctx.user.id);
        const tierConfig = getTierConfig(userTier);

        // Block models the user's tier can't access
        const requestedModel = getModelById(input.modelVersion);
        if (requestedModel && !canAccessModel(userTier, requestedModel.tier)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Model "${input.modelVersion}" requires a ${requestedModel.tier} or higher subscription.`,
          });
        }

        // Cap resolution for the user's tier
        if (input.width > tierConfig.maxImageResolution || input.height > tierConfig.maxImageResolution) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Max resolution for your plan is ${tierConfig.maxImageResolution}x${tierConfig.maxImageResolution}. Upgrade to increase.`,
          });
        }

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

          // Map DreamForge exclusive styles to RunPod Flux + LoRA
          const DF_LORA_MAP: Record<string, string> = {
            "df-cinematic": "daxkensington/dreamforge-cinematic",
            "df-anime": "daxkensington/dreamforge-anime",
            "df-fantasy": "daxkensington/dreamforge-fantasy",
            "df-product": "daxkensington/dreamforge-product",
            "df-abstract": "daxkensington/dreamforge-abstract",
          };

          let url: string | undefined;
          const loraId = DF_LORA_MAP[input.modelVersion];
          if (loraId) {
            // DreamForge exclusive style — use RunPod Flux Dev with LoRA
            const { isRunPodAvailable, runpodFluxDev } = await import("./_core/runpod");
            if (isRunPodAvailable()) {
              const styleHint = input.modelVersion.replace("df-", "dreamforge ");
              const styledPrompt = `${styleHint} style. ${enhancedPrompt}`;
              const buffer = await runpodFluxDev(styledPrompt, input.width, input.height);
              const { storagePut: sp, generateStorageKey: gk } = await import("./storage");
              const key = gk("generations", "png");
              ({ url } = await sp(key, buffer, "image/png"));
            }
          }

          if (!url) {
            // Standard model — map UI model names to generateImage model param
            const modelMap: Record<string, string> = {
              "built-in-v1": "auto", "grok": "grok", "flux-pro": "flux-pro",
              "flux-schnell": "flux-schnell", "dall-e-3": "dall-e-3", "sd3": "sd3",
              "gemini": "gemini", "ultra": "ultra",
            };
            const model = modelMap[input.modelVersion] || "auto";
            ({ url } = await generateImage({ prompt: enhancedPrompt, model: model as any, userTier }));
          }

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
          // Telemetry — drives auto-degrade + admin failure dashboard
          logToolFailure({
            toolId: creditTool,
            errorMessage: error?.message ?? "Generation failed",
            userId: ctx.user.id,
          }).catch(() => {});
          // Refund credits on generation failure
          const refundCost = CREDIT_COSTS[creditTool] || 1;
          try {
            await refundCredits(ctx.user.id, refundCost, `Refund: ${input.mediaType} generation failed — ${(error.message || "unknown error").slice(0, 100)}`);
          } catch (refundErr) {
            console.error("[generation.create] Credit refund failed:", refundErr);
          }
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
        // Rate limit: 5 batch requests per minute per user
        enforceRateLimit(`generation.batchCreate:${ctx.user.id}`, 5, 60_000, "Batch generation rate limit exceeded — max 5 per minute.");

        // Tier enforcement for batch
        const userTier = await getUserTier(ctx.user.id);
        const tierConfig = getTierConfig(userTier);

        for (const item of input.prompts) {
          const batchModel = getModelById(item.modelVersion);
          if (batchModel && !canAccessModel(userTier, batchModel.tier)) {
            throw new TRPCError({ code: "FORBIDDEN", message: `Model "${item.modelVersion}" requires a ${batchModel.tier} or higher subscription.` });
          }
          if (item.width > tierConfig.maxImageResolution || item.height > tierConfig.maxImageResolution) {
            throw new TRPCError({ code: "FORBIDDEN", message: `Max resolution for your plan is ${tierConfig.maxImageResolution}x${tierConfig.maxImageResolution}.` });
          }
        }

        // Kill-switch — block offline tools before batch charge
        try {
          await requireToolActive("batch");
        } catch (e: any) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: e.message });
        }

        // Deduct credits for entire batch upfront using actual total cost
        const totalCost = input.prompts.reduce((sum, p) => {
          return sum + (CREDIT_COSTS[p.mediaType === "video" ? "text-to-video" : "text-to-image"] || 1);
        }, 0);
        const batchResult = await deductCredits(ctx.user.id, totalCost, `Batch generation (${input.prompts.length} items)`);
        if (!batchResult.success) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Insufficient credits. Need ${batchResult.needed}, have ${batchResult.balance}. Purchase more credits to continue.`,
          });
        }

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

            const { url } = await generateImage({ prompt: enhancedPrompt, userTier });

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
            logToolFailure({
              toolId: item.mediaType === "video" ? "text-to-video" : "text-to-image",
              errorMessage: error?.message ?? "Batch item failed",
              userId: ctx.user.id,
            }).catch(() => {});
            // Refund credits for this failed batch item
            const itemCost = CREDIT_COSTS[item.mediaType === "video" ? "text-to-video" : "text-to-image"] || 1;
            try {
              await refundCredits(ctx.user.id, itemCost, `Refund: batch item failed — ${(error.message || "unknown error").slice(0, 100)}`);
            } catch (refundErr) {
              console.error("[generation.batchCreate] Credit refund failed:", refundErr);
            }
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
          // Try RunPod Real-ESRGAN first (true pixel-level upscaling, 90% cheaper)
          const { isRunPodAvailable, runpodUpscale } = await import("./_core/runpod");
          if (isRunPodAvailable()) {
            try {
              const imgResp = await fetch(input.imageUrl);
              if (imgResp.ok) {
                const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
                const imageB64 = imgBuffer.toString("base64");
                const scale = input.scaleFactor === "4x" ? 4 : 2;
                const resultBuffer = await runpodUpscale(imageB64, scale);
                const { storagePut, generateStorageKey } = await import("./storage");
                const key = generateStorageKey("upscaled", "png");
                const { url } = await storagePut(key, resultBuffer, "image/png");
                return { url, status: "completed" as const };
              }
            } catch (err: any) {
              console.warn("[Upscale] RunPod ESRGAN failed, falling back to LLM:", err.message);
            }
          }

          // Fallback: LLM-based upscale via generateImage
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
          // For "remove" mode, try RunPod RMBG-2.0 first (true segmentation, 95% cheaper)
          if (input.mode === "remove") {
            const { isRunPodAvailable, runpodRemoveBackground } = await import("./_core/runpod");
            if (isRunPodAvailable()) {
              try {
                const imgResp = await fetch(input.imageUrl);
                if (imgResp.ok) {
                  const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
                  const imageB64 = imgBuffer.toString("base64");
                  const resultBuffer = await runpodRemoveBackground(imageB64);
                  const { storagePut, generateStorageKey } = await import("./storage");
                  const key = generateStorageKey("bg-removed", "png");
                  const { url } = await storagePut(key, resultBuffer, "image/png");
                  return { url, status: "completed" as const, mode: input.mode };
                }
              } catch (err: any) {
                console.warn("[BgRemove] RunPod RMBG failed, falling back to LLM:", err.message);
              }
            }
          }

          // Fallback: LLM-based bg edit via generateImage (also handles "replace" mode)
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

    // AI Photo Restorer — restore old, damaged, or faded photos
    photoRestore: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          restoreType: z.enum(["old-photo", "damaged", "faded", "colorize", "full"]).default("full"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "photo-restore", "Photo restoration");
        try {
          const restoreDescriptions: Record<string, string> = {
            "old-photo": "Restore this old photograph to modern quality. Fix yellowing, grain, scratches, and aging artifacts while preserving the original composition and subjects. Make it look like it was taken with a modern camera.",
            "damaged": "Repair this damaged photograph. Fix tears, scratches, water damage, creases, and missing sections. Reconstruct damaged areas naturally. Professional photo restoration quality.",
            "faded": "Restore the vibrancy and contrast of this faded photograph. Bring back rich colors, deep blacks, and bright highlights while maintaining natural appearance.",
            "colorize": "Colorize this black and white photograph with historically accurate, natural-looking colors. Use realistic skin tones, clothing colors appropriate to the era, and natural environment colors. Professional colorization quality.",
            "full": "Perform a complete professional restoration of this photograph. Fix any damage, scratches, fading, yellowing, grain, or aging artifacts. Enhance clarity, restore colors, and bring it to modern photo quality while preserving the original subjects and composition.",
          };

          const { url } = await generateImage({
            prompt: restoreDescriptions[input.restoreType],
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const, restoreType: input.restoreType };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // AI Headshot Generator — create professional headshots from any photo
    headshot: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          style: z.enum(["corporate", "creative", "casual", "linkedin", "editorial", "studio"]).default("corporate"),
          background: z.enum(["neutral-gray", "white", "dark", "office-blur", "gradient", "outdoor-blur"]).default("neutral-gray"),
          lighting: z.enum(["studio", "natural", "dramatic", "rembrandt", "soft"]).default("studio"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "headshot", "AI headshot");
        try {
          const styleDescriptions: Record<string, string> = {
            "corporate": "professional corporate headshot, business attire, confident expression, executive portrait",
            "creative": "creative professional headshot, artistic lighting, unique angle, personality-forward",
            "casual": "approachable casual headshot, relaxed smile, warm tones, friendly professional",
            "linkedin": "LinkedIn profile headshot, professional but approachable, clean and polished, trust-building",
            "editorial": "editorial magazine-style portrait, fashion lighting, dynamic pose, high-end retouching",
            "studio": "classic studio portrait, perfect lighting, timeless quality, premium finish",
          };
          const bgDescriptions: Record<string, string> = {
            "neutral-gray": "solid neutral gray studio backdrop",
            "white": "clean white background",
            "dark": "dark moody background",
            "office-blur": "softly blurred modern office environment",
            "gradient": "smooth professional gradient background",
            "outdoor-blur": "softly blurred natural outdoor setting",
          };
          const lightDescriptions: Record<string, string> = {
            "studio": "professional three-point studio lighting",
            "natural": "soft natural window light",
            "dramatic": "dramatic side lighting with deep shadows",
            "rembrandt": "classic Rembrandt lighting with triangle shadow",
            "soft": "diffused soft box lighting, minimal shadows",
          };

          const { url } = await generateImage({
            prompt: `Transform this photo into a ${styleDescriptions[input.style]}. Background: ${bgDescriptions[input.background]}. Lighting: ${lightDescriptions[input.lighting]}. Maintain the person's exact likeness, features, and identity. Professional retouching — smooth skin, remove blemishes, enhance eyes, perfect exposure. 8K quality headshot.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // AI Logo Maker — generate logos with text
    logoMaker: protectedProcedure
      .input(
        z.object({
          brandName: z.string().min(1).max(100),
          tagline: z.string().max(200).optional(),
          style: z.enum(["minimal", "modern", "vintage", "luxury", "playful", "tech", "organic", "geometric", "hand-drawn", "3d"]).default("modern"),
          colorScheme: z.string().max(200).optional(),
          industry: z.string().max(200).optional(),
          iconDescription: z.string().max(300).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "logo-maker", "Logo generation");
        try {
          const styleDescriptions: Record<string, string> = {
            "minimal": "minimalist, clean lines, simple shapes, lots of whitespace, modern sans-serif",
            "modern": "contemporary, sleek, professional, balanced proportions, refined typography",
            "vintage": "retro, classic, badge-style, ornate details, serif typography, heritage feel",
            "luxury": "elegant, premium, gold accents, sophisticated, high-end fashion brand feel",
            "playful": "fun, colorful, rounded shapes, friendly, approachable, energetic",
            "tech": "futuristic, digital, circuit-inspired, sharp edges, neon or gradient accents",
            "organic": "natural, flowing, leaf/nature motifs, earthy, sustainable feel",
            "geometric": "abstract geometric shapes, mathematical precision, bold patterns",
            "hand-drawn": "hand-lettered, artisanal, sketch-style, authentic, craft feel",
            "3d": "three-dimensional, glossy, depth, shadows, photorealistic emblem",
          };

          const colorNote = input.colorScheme ? ` Color scheme: ${input.colorScheme}.` : "";
          const industryNote = input.industry ? ` Industry: ${input.industry}.` : "";
          const iconNote = input.iconDescription ? ` Icon/symbol: ${input.iconDescription}.` : "";
          const taglineNote = input.tagline ? ` Include tagline: "${input.tagline}".` : "";

          const { url } = await generateImage({
            prompt: `Professional logo design for "${input.brandName}". Style: ${styleDescriptions[input.style]}.${taglineNote}${colorNote}${industryNote}${iconNote} The text "${input.brandName}" must be clearly legible and perfectly rendered. Clean vector-style output on a white or transparent background. Professional brand identity design, suitable for business cards and websites.`,
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Wallpaper Generator — create custom wallpapers for any device
    wallpaper: protectedProcedure
      .input(
        z.object({
          prompt: z.string().min(1).max(1000),
          resolution: z.enum(["phone", "tablet", "desktop", "ultrawide", "4k"]).default("desktop"),
          style: z.enum(["photorealistic", "abstract", "minimal", "nature", "space", "cyberpunk", "anime", "watercolor", "geometric", "dark"]).default("photorealistic"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "wallpaper", "Wallpaper generation");
        try {
          const resolutionSizes: Record<string, string> = {
            "phone": "vertical portrait 9:16 mobile wallpaper",
            "tablet": "tablet aspect ratio 4:3 wallpaper",
            "desktop": "widescreen 16:9 desktop wallpaper",
            "ultrawide": "ultra-widescreen 21:9 panoramic wallpaper",
            "4k": "4K ultra HD 16:9 desktop wallpaper",
          };

          const { url } = await generateImage({
            prompt: `${input.prompt}. ${resolutionSizes[input.resolution]}. Style: ${input.style}. Stunning, high-resolution wallpaper quality with rich detail, perfect for a ${input.resolution} display. No text, no watermarks, no UI elements — pure visual art.`,
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // QR Code Art — generate artistic QR codes
    qrArt: protectedProcedure
      .input(
        z.object({
          url: z.string().min(1).max(500),
          style: z.enum(["cyberpunk", "nature", "galaxy", "steampunk", "watercolor", "pixel-art", "neon", "vintage", "minimal", "abstract"]).default("cyberpunk"),
          prompt: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "qr-art", "QR code art");
        try {
          const styleDescriptions: Record<string, string> = {
            "cyberpunk": "neon cyberpunk cityscape, glowing circuits, holographic elements",
            "nature": "beautiful natural landscape, flowers, trees, organic flowing forms",
            "galaxy": "deep space nebula, stars, cosmic swirls, galactic colors",
            "steampunk": "Victorian steampunk machinery, gears, copper pipes, brass fittings",
            "watercolor": "soft watercolor painting, blending colors, artistic splashes",
            "pixel-art": "retro 8-bit pixel art, game-inspired, colorful blocks",
            "neon": "glowing neon signs, dark background, vibrant electric colors",
            "vintage": "aged paper, classic typography, sepia tones, antique style",
            "minimal": "clean minimalist design, simple shapes, monochrome palette",
            "abstract": "abstract expressionist art, bold colors, dynamic shapes",
          };

          const customPrompt = input.prompt ? ` Additional details: ${input.prompt}.` : "";

          const { url: resultUrl } = await generateImage({
            prompt: `A beautiful artistic QR code design integrated with ${styleDescriptions[input.style]}. The QR code pattern is seamlessly woven into the artwork while remaining scannable. The design elements flow around and through the QR code data modules.${customPrompt} High quality digital art, stunning visual design.`,
          });

          return { url: resultUrl, status: "completed" as const, qrData: input.url };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Image Vectorizer — convert raster images to SVG-style output
    vectorize: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          style: z.enum(["flat", "line-art", "geometric", "minimal", "detailed", "logo"]).default("flat"),
          colorCount: z.number().min(2).max(32).default(8),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "vectorize", "Image vectorization");
        try {
          const styleDescriptions: Record<string, string> = {
            "flat": "flat vector illustration with solid color fills, clean edges, no gradients",
            "line-art": "clean line art vector drawing with uniform stroke weight, minimal fills",
            "geometric": "geometric vector shapes, low-poly style, angular facets",
            "minimal": "ultra-minimalist vector with the fewest possible shapes and colors",
            "detailed": "detailed vector illustration preserving fine details, smooth curves",
            "logo": "logo-ready vector design, bold shapes, perfect symmetry, brand-ready",
          };

          const { url } = await generateImage({
            prompt: `Convert this image into a ${styleDescriptions[input.style]}. Use approximately ${input.colorCount} colors. Clean vector-style output with crisp edges, no raster artifacts. Suitable for SVG conversion. Professional graphic design quality.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Natural Language Editor — edit images by describing what to change
    nlEdit: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          instruction: z.string().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "nl-edit", "Natural language edit");
        try {
          const { url } = await generateImage({
            prompt: `Edit this image following these instructions exactly: ${input.instruction}. Make the edit look completely natural and seamless. Preserve everything else in the image unchanged. Professional quality result.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // AI Avatar Generator — create custom avatars in various styles
    avatar: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url().optional(),
          description: z.string().max(500).optional(),
          style: z.enum(["3d-render", "anime", "pixel-art", "cartoon", "realistic", "comic", "chibi", "cyberpunk", "fantasy", "watercolor"]).default("3d-render"),
          shape: z.enum(["circle", "square", "rounded"]).default("circle"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "avatar", "Avatar generation");
        try {
          const styleDescriptions: Record<string, string> = {
            "3d-render": "high-quality 3D rendered avatar, Pixar-style, smooth shading, professional lighting",
            "anime": "anime-style avatar, large expressive eyes, clean linework, vibrant colors, Japanese animation",
            "pixel-art": "retro pixel art avatar, 32x32 style upscaled, crisp pixels, limited palette, game character",
            "cartoon": "bold cartoon avatar, exaggerated features, bright colors, thick outlines, fun personality",
            "realistic": "photorealistic digital portrait avatar, detailed skin texture, studio lighting, professional headshot",
            "comic": "comic book style avatar, dynamic shading, halftone dots, bold lines, superhero aesthetic",
            "chibi": "cute chibi avatar, oversized head, small body, adorable expression, kawaii style",
            "cyberpunk": "cyberpunk avatar, neon accents, cybernetic implants, holographic elements, futuristic",
            "fantasy": "fantasy character avatar, ethereal glow, magical elements, RPG character portrait",
            "watercolor": "watercolor portrait avatar, soft washes, artistic splashes, painterly quality",
          };

          const basePrompt = input.description
            ? `Create an avatar of: ${input.description}. Style: ${styleDescriptions[input.style]}.`
            : `Transform this photo into an avatar. Style: ${styleDescriptions[input.style]}.`;

          const generateOptions: any = {
            prompt: `${basePrompt} Centered composition, ${input.shape} crop-friendly framing. Professional avatar suitable for social media profiles. High quality, detailed, vibrant.`,
          };

          if (input.imageUrl) {
            generateOptions.originalImages = [{ url: input.imageUrl, mimeType: "image/png" }];
          }

          const { url } = await generateImage(generateOptions);

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // AI Product Photos — create professional e-commerce product shots
    productPhoto: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          scene: z.enum(["studio-white", "lifestyle", "flat-lay", "outdoor", "luxury", "minimal", "holiday", "tech", "food", "fashion"]).default("studio-white"),
          lighting: z.enum(["studio", "natural", "dramatic", "soft", "backlit"]).default("studio"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "product-photo", "Product photo");
        try {
          const sceneDescriptions: Record<string, string> = {
            "studio-white": "clean white studio background, professional product photography, soft shadows",
            "lifestyle": "natural lifestyle setting, product in-use context, warm inviting atmosphere",
            "flat-lay": "top-down flat lay composition with complementary props and accessories",
            "outdoor": "outdoor natural setting, beautiful scenery, product integrated into environment",
            "luxury": "premium luxury setting, marble/velvet surfaces, gold accents, high-end presentation",
            "minimal": "ultra-minimal setting, single surface, negative space, editorial aesthetic",
            "holiday": "festive holiday setting, seasonal decorations, warm cozy atmosphere",
            "tech": "modern tech environment, clean desk setup, sleek surfaces, blue-tinted lighting",
            "food": "appetizing food photography setting, rustic table, garnishes, steam/freshness",
            "fashion": "fashion editorial setting, fabric drapes, mannequin or model context",
          };
          const lightDescriptions: Record<string, string> = {
            "studio": "professional three-point studio lighting, crisp highlights, controlled shadows",
            "natural": "soft natural window light, warm tones, organic shadows",
            "dramatic": "dramatic accent lighting, deep shadows, spotlight effect",
            "soft": "diffused soft lighting, minimal shadows, even illumination",
            "backlit": "beautiful backlit glow, rim lighting, ethereal atmosphere",
          };

          const { url } = await generateImage({
            prompt: `Professional e-commerce product photography. Scene: ${sceneDescriptions[input.scene]}. Lighting: ${lightDescriptions[input.lighting]}. Keep the product exactly as-is, enhance the setting and presentation. Commercial quality, suitable for online store listings. Sharp focus on product, beautiful composition.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Image Caption Generator — generate descriptions, alt text, and social captions
    imageCaption: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          type: z.enum(["alt-text", "social-caption", "description", "seo", "creative"]).default("description"),
          platform: z.enum(["instagram", "twitter", "linkedin", "facebook", "tiktok", "general"]).default("general"),
          tone: z.enum(["professional", "casual", "funny", "poetic", "informative"]).default("professional"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "image-caption", "Image caption");
        try {
          const typeInstructions: Record<string, string> = {
            "alt-text": "Write concise, descriptive alt text for accessibility. Be specific about what's in the image. 1-2 sentences max.",
            "social-caption": `Write an engaging social media caption for ${input.platform}. Include relevant hashtags. Tone: ${input.tone}. Make it shareable and engaging.`,
            "description": "Write a detailed description of this image covering subjects, setting, colors, mood, and composition. 2-3 sentences.",
            "seo": "Write SEO-optimized image description with relevant keywords. Include what, where, and context. Suitable for image sitemap or structured data.",
            "creative": `Write a creative, ${input.tone} caption or story inspired by this image. Be imaginative and evocative. Include hashtags if for social media.`,
          };

          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert at writing image captions and descriptions. ${typeInstructions[input.type]} Output ONLY the caption/description text, nothing else.`,
              },
              {
                role: "user",
                content: [
                  { type: "text" as const, text: `Generate a ${input.type} for this image.` },
                  { type: "image_url" as const, image_url: { url: input.imageUrl } },
                ],
              },
            ],
          });

          const caption = typeof result.choices[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : "Unable to generate caption";

          return { caption, status: "completed" as const, type: input.type };
        } catch (error: any) {
          return { caption: null, status: "failed" as const, error: error.message };
        }
      }),

    // Text-to-Speech — generate voiceovers from text
    textToSpeech: protectedProcedure
      .input(
        z.object({
          text: z.string().min(1).max(5000),
          voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("alloy"),
          speed: z.number().min(0.25).max(4.0).default(1.0),
          model: z.enum(["tts-1", "tts-1-hd", "edge-tts"]).default("edge-tts"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-speech", "Text-to-speech");
        try {
          let audioBuffer: Buffer;

          // Try Edge TTS first (free, unlimited)
          if (input.model === "edge-tts" || !process.env.OPENAI_API_KEY) {
            const edgeVoiceMap: Record<string, string> = {
              alloy: "en-US-AriaNeural",
              echo: "en-US-GuyNeural",
              fable: "en-GB-SoniaNeural",
              onyx: "en-US-ChristopherNeural",
              nova: "en-US-JennyNeural",
              shimmer: "en-AU-NatashaNeural",
            };
            const { EdgeTTS } = await import("edge-tts-universal");
            const tts = new EdgeTTS();
            await tts.synthesize(input.text, edgeVoiceMap[input.voice] || "en-US-AriaNeural", { rate: `${Math.round((input.speed - 1) * 100)}%` });
            audioBuffer = Buffer.from(await tts.toBuffer());
          } else {
            // Fallback to OpenAI TTS (paid)
            const response = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: input.model,
                input: input.text,
                voice: input.voice,
                speed: input.speed,
                response_format: "mp3",
              }),
            });
            if (!response.ok) throw new Error(`OpenAI TTS failed: ${await response.text()}`);
            audioBuffer = Buffer.from(await response.arrayBuffer());
          }

          const base64Audio = audioBuffer.toString("base64");
          const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

          return { audioUrl, status: "completed" as const, voice: input.voice, duration: Math.ceil(input.text.length / 15) };
        } catch (error: any) {
          return { audioUrl: null, status: "failed" as const, error: error.message };
        }
      }),

    // Audio Enhancer — clean up and enhance audio
    audioEnhance: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1).max(1000),
          enhancement: z.enum(["noise-removal", "clarity", "volume-normalize", "bass-boost", "vocal-isolate", "full"]).default("full"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "audio-enhance", "Audio enhancement");
        try {
          const enhanceDescriptions: Record<string, string> = {
            "noise-removal": "Remove background noise while preserving voice clarity",
            "clarity": "Enhance vocal clarity and intelligibility",
            "volume-normalize": "Normalize audio levels for consistent volume",
            "bass-boost": "Enhance bass frequencies for richer sound",
            "vocal-isolate": "Isolate vocals from background music/noise",
            "full": "Full audio enhancement: noise removal, clarity boost, volume normalization",
          };

          // LLM provides enhancement recommendations since we can't directly process audio yet
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are a professional audio engineer. Given a description of audio content and the desired enhancement, provide detailed technical recommendations including specific settings, tools, and steps. Format as a structured guide.",
              },
              {
                role: "user",
                content: `Audio description: ${input.description}\nDesired enhancement: ${enhanceDescriptions[input.enhancement]}\n\nProvide specific technical recommendations for this audio enhancement.`,
              },
            ],
          });

          const recommendations = typeof result.choices[0]?.message?.content === "string"
            ? result.choices[0].message.content
            : "Unable to generate recommendations";

          return { recommendations, status: "completed" as const, enhancement: input.enhancement };
        } catch (error: any) {
          return { recommendations: null, status: "failed" as const, error: error.message };
        }
      }),

    // Sound Effects Generator — create custom sound effects using AI
    soundEffects: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1).max(1000),
          duration: z.enum(["short", "medium", "long"]).default("medium"),
          category: z.enum(["nature", "sci-fi", "horror", "comedy", "action", "ambient", "ui", "musical", "foley", "custom"]).default("custom"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "sound-effects", "Sound effect generation");
        try {
          const durationSeconds = { short: 2, medium: 5, long: 10 };
          const openaiKey = process.env.OPENAI_API_KEY;
          if (!openaiKey) throw new Error("OpenAI API key not configured");

          // Use OpenAI's audio generation if available, otherwise generate a descriptive guide
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a professional sound designer and Foley artist. Given a sound effect description, provide: 1) A detailed technical specification of the sound, 2) Suggested layers and frequencies, 3) How to recreate it digitally, 4) Similar reference sounds. Format as structured JSON with fields: name, technicalSpec, layers (array of {sound, frequency, volume}), recreationSteps (array of strings), references (array of strings).`,
              },
              {
                role: "user",
                content: `Create a ${input.category} sound effect: ${input.description}. Duration: ~${durationSeconds[input.duration]} seconds.`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "sound_effect",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    technicalSpec: { type: "string" },
                    layers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          sound: { type: "string" },
                          frequency: { type: "string" },
                          volume: { type: "string" },
                        },
                        required: ["sound", "frequency", "volume"],
                        additionalProperties: false,
                      },
                    },
                    recreationSteps: { type: "array", items: { type: "string" } },
                    references: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "technicalSpec", "layers", "recreationSteps", "references"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = result.choices[0]?.message?.content;
          const sfx = typeof content === "string" ? JSON.parse(content) : null;
          if (!sfx) throw new Error("Failed to generate sound effect spec");

          return { ...sfx, status: "completed" as const, category: input.category, duration: input.duration };
        } catch (error: any) {
          return { name: null, status: "failed" as const, error: error.message };
        }
      }),

    // Texture/Pattern Generator — create seamless tileable textures
    textureGen: protectedProcedure
      .input(
        z.object({
          prompt: z.string().min(1).max(1000),
          category: z.enum(["wood", "stone", "metal", "fabric", "organic", "sci-fi", "abstract", "brick", "concrete", "water", "custom"]).default("custom"),
          style: z.enum(["photorealistic", "stylized", "hand-painted", "pixel-art", "pbr"]).default("photorealistic"),
          tiling: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "texture-gen", "Texture generation");
        try {
          const tilingNote = input.tiling ? "Seamless tileable pattern that repeats perfectly in all directions with no visible seams." : "";
          const categoryNote = input.category !== "custom" ? `${input.category} material texture.` : "";

          const { url } = await generateImage({
            prompt: `${input.prompt}. ${categoryNote} ${tilingNote} Style: ${input.style}. High resolution texture map suitable for 3D rendering and game development. Square format, consistent lighting, no objects or scenes — pure surface texture.`,
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Panorama Generator — extend images to panoramic views
    panorama: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          direction: z.enum(["horizontal", "vertical", "360"]).default("horizontal"),
          expansionFactor: z.enum(["2x", "3x", "4x"]).default("3x"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "panorama", "Panorama generation");
        try {
          const directionDescriptions: Record<string, string> = {
            "horizontal": `Extend this image horizontally to create a wide panoramic view (${input.expansionFactor} wider). Seamlessly continue the scene, landscape, and atmosphere in both directions. Maintain consistent lighting, perspective, and style.`,
            "vertical": `Extend this image vertically (${input.expansionFactor} taller). Continue the scene upward showing more sky/ceiling and downward showing more ground/floor. Seamless extension.`,
            "360": "Extend this image into a full 360-degree panoramic view. Create a seamless wrap-around environment that could be used as a VR/360 panorama. Consistent lighting and perspective throughout.",
          };

          const { url } = await generateImage({
            prompt: directionDescriptions[input.direction] + " Professional panoramic photography quality.",
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // HDR/Lighting Enhancer — enhance lighting, contrast, and dynamic range
    hdrEnhance: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          effect: z.enum(["hdr", "golden-hour", "blue-hour", "dramatic", "soft-light", "backlit", "neon-night", "foggy", "harsh-sun", "studio"]).default("hdr"),
          intensity: z.number().min(0.1).max(1.0).default(0.7),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "color-grade", "HDR enhancement");
        try {
          const effectDescriptions: Record<string, string> = {
            "hdr": "Apply HDR (High Dynamic Range) enhancement — boost shadow details, highlight details, vivid colors, expanded tonal range, professional HDR photography",
            "golden-hour": "Transform the lighting to warm golden hour — rich warm tones, long shadows, beautiful sun glow, magic hour photography",
            "blue-hour": "Apply cool blue hour lighting — twilight atmosphere, deep blues, city lights beginning to glow, serene mood",
            "dramatic": "Dramatic lighting enhancement — deep shadows, bright highlights, strong contrast, moody atmosphere, cinematic",
            "soft-light": "Soft diffused lighting — gentle shadows, dreamy glow, even illumination, flattering portrait light",
            "backlit": "Apply backlighting effect — rim light, silhouette edges, sun flare, ethereal glow behind subjects",
            "neon-night": "Neon night scene lighting — vibrant neon reflections, wet streets, cyberpunk atmosphere, colorful night",
            "foggy": "Add atmospheric fog/haze — diffused light, mysterious mood, depth layers, soft ethereal",
            "harsh-sun": "Bright midday sun — strong shadows, vivid saturation, crisp highlights, summer feel",
            "studio": "Professional studio lighting — controlled three-point lighting, clean shadows, commercial quality",
          };

          const intensityLabel = input.intensity > 0.7 ? "strongly" : input.intensity > 0.4 ? "moderately" : "subtly";

          const { url } = await generateImage({
            prompt: `${intensityLabel} ${effectDescriptions[input.effect]}. Preserve the original subject and composition while transforming the lighting. Professional quality.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Transparent PNG Maker — create transparent background images
    transparentPng: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          mode: z.enum(["remove-bg", "extract-subject", "product-cutout"]).default("remove-bg"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "background-edit", "Transparent PNG");
        try {
          const modeDescriptions: Record<string, string> = {
            "remove-bg": "Remove the background completely, leaving only the main subject on a pure transparent/white background. Perfectly clean edges, no artifacts.",
            "extract-subject": "Extract the primary subject from this image with pixel-perfect edges. Clean cutout suitable for compositing. Transparent background.",
            "product-cutout": "Create a clean product cutout with perfect edges, removing all background. Professional e-commerce quality, suitable for any background placement.",
          };

          const { url } = await generateImage({
            prompt: modeDescriptions[input.mode] + " Professional quality cutout.",
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Icon Generator — create icons and favicons
    iconGen: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1).max(500),
          style: z.enum(["flat", "3d", "outline", "filled", "glassmorphism", "gradient", "pixel", "hand-drawn", "ios", "material"]).default("flat"),
          size: z.enum(["16", "32", "64", "128", "256", "512"]).default("512"),
          colorScheme: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "text-to-image", "Icon generation");
        try {
          const styleDescriptions: Record<string, string> = {
            "flat": "flat design icon, solid colors, no shadows, clean minimal shapes",
            "3d": "3D rendered icon, glossy, subtle shadows and reflections, depth",
            "outline": "thin outline icon, single stroke weight, minimal, clean lines",
            "filled": "solid filled icon, bold shapes, high contrast, clear silhouette",
            "glassmorphism": "glassmorphism icon, frosted glass effect, semi-transparent, blur backdrop",
            "gradient": "gradient icon, smooth color transitions, vibrant, modern",
            "pixel": "pixel art icon, retro 16-bit style, limited palette, crisp pixels",
            "hand-drawn": "hand-drawn icon, sketch style, artisanal, slight imperfections",
            "ios": "iOS-style app icon, rounded square, glossy, Apple design language",
            "material": "Material Design icon, Google style, geometric, consistent proportions",
          };

          const colorNote = input.colorScheme ? ` Color scheme: ${input.colorScheme}.` : "";

          const { url } = await generateImage({
            prompt: `Icon design: ${input.description}. Style: ${styleDescriptions[input.style]}.${colorNote} Single centered icon on a clean background, ${input.size}x${input.size} pixel perfect. Suitable for app icon, favicon, or UI element. Professional graphic design.`,
          });

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Batch Prompt Generator — generate multiple images from a list of prompts
    batchPrompts: protectedProcedure
      .input(
        z.object({
          prompts: z.array(z.string().min(1).max(1000)).min(1).max(20),
          style: z.string().max(200).optional(),
          quality: z.enum(["standard", "hd"]).default("standard"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Kill-switch — block offline tools before batch charge
        try {
          await requireToolActive("batch-prompts");
        } catch (e: any) {
          throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: e.message });
        }

        // Charge for all images upfront using actual total cost
        const perImageCost = CREDIT_COSTS["text-to-image"] || 1;
        const totalCost = perImageCost * input.prompts.length;
        const batchResult = await deductCredits(ctx.user.id, totalCost, `Batch prompts (${input.prompts.length} images)`);
        if (!batchResult.success) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Insufficient credits. Need ${batchResult.needed}, have ${batchResult.balance}. Purchase more credits to continue.`,
          });
        }
        const results: Array<{ prompt: string; url: string | null; status: string; error?: string }> = [];

        for (const prompt of input.prompts) {
          try {
            const enhancedPrompt = input.style ? `${prompt}. Style: ${input.style}. Professional quality.` : `${prompt}. Professional quality.`;
            const { url } = await generateImage({ prompt: enhancedPrompt, quality: input.quality });
            results.push({ prompt, url: url ?? null, status: "completed" });
          } catch (error: any) {
            results.push({ prompt, url: null, status: "failed", error: error.message });
          }
        }

        return { results, total: input.prompts.length, completed: results.filter((r) => r.status === "completed").length };
      }),

    // AI Music Generator — create music descriptions and compositions
    musicGen: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1).max(1000),
          genre: z.enum(["ambient", "electronic", "cinematic", "lo-fi", "jazz", "classical", "rock", "hip-hop", "pop", "world", "custom"]).default("custom"),
          mood: z.enum(["happy", "sad", "epic", "relaxed", "tense", "mysterious", "romantic", "energetic", "dark", "hopeful"]).default("relaxed"),
          duration: z.enum(["15", "30", "60", "120"]).default("30"),
          instruments: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "music-gen", "Music generation");
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert music composer and producer. Given a description, genre, mood, and duration, create a detailed music composition specification. Output JSON with: title, bpm, key, timeSignature, sections (array of {name, bars, description, instruments, dynamics}), mixNotes, referenceTrack, moodProgression.`,
              },
              {
                role: "user",
                content: `Create a ${input.duration}-second ${input.genre} track. Mood: ${input.mood}. Description: ${input.description}.${input.instruments ? ` Instruments: ${input.instruments}.` : ""}`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "music_composition",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    bpm: { type: "number" },
                    key: { type: "string" },
                    timeSignature: { type: "string" },
                    sections: { type: "array", items: { type: "object", properties: { name: { type: "string" }, bars: { type: "number" }, description: { type: "string" }, instruments: { type: "string" }, dynamics: { type: "string" } }, required: ["name", "bars", "description", "instruments", "dynamics"], additionalProperties: false } },
                    mixNotes: { type: "string" },
                    referenceTrack: { type: "string" },
                    moodProgression: { type: "string" },
                  },
                  required: ["title", "bpm", "key", "timeSignature", "sections", "mixNotes", "referenceTrack", "moodProgression"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = result.choices[0]?.message?.content;
          const composition = typeof content === "string" ? JSON.parse(content) : null;
          if (!composition) throw new Error("Failed to generate composition");
          return { ...composition, status: "completed" as const, genre: input.genre, mood: input.mood };
        } catch (error: any) {
          return { title: null, status: "failed" as const, error: error.message };
        }
      }),

    // Mockup Generator — place designs on product mockups
    mockup: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          mockupType: z.enum(["tshirt", "phone-case", "laptop", "mug", "poster", "book-cover", "business-card", "billboard", "hoodie", "tote-bag"]).default("tshirt"),
          color: z.string().max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "mockup", "Mockup generation");
        try {
          const mockupDescriptions: Record<string, string> = {
            "tshirt": "a premium quality t-shirt being worn by a model, professional product photography, lifestyle setting",
            "phone-case": "a modern smartphone case displayed at an angle, showing the design clearly, clean studio backdrop",
            "laptop": "a laptop screen displaying the design, modern workspace setting, professional photography",
            "mug": "a ceramic coffee mug on a cozy table, steam rising, warm lighting, lifestyle photography",
            "poster": "a framed poster on a stylish wall, modern interior, gallery-quality presentation",
            "book-cover": "a hardcover book with the design as the cover, displayed on a wooden table, professional photography",
            "business-card": "a stack of premium business cards with the design, elegant arrangement, macro photography",
            "billboard": "a large billboard on a city street displaying the design, urban photography, dramatic perspective",
            "hoodie": "a premium hoodie being worn casually, street photography style, lifestyle product shot",
            "tote-bag": "a canvas tote bag with the design, carried by someone in a trendy setting, lifestyle photography",
          };
          const colorNote = input.color ? ` Product color: ${input.color}.` : "";
          const { url } = await generateImage({
            prompt: `Professional product mockup: ${mockupDescriptions[input.mockupType]}. The uploaded design/image is clearly visible on the product.${colorNote} Commercial quality product photography, realistic lighting and shadows.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, mockupType: input.mockupType };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Social Media Resizer — resize/adapt images for different platforms
    socialResize: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          platform: z.enum(["instagram-post", "instagram-story", "facebook-cover", "twitter-header", "youtube-thumbnail", "linkedin-banner", "pinterest-pin", "tiktok"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "social-resize", "Social media resize");
        try {
          const platformSpecs: Record<string, { ratio: string; desc: string }> = {
            "instagram-post": { ratio: "1:1", desc: "square Instagram post, 1080x1080" },
            "instagram-story": { ratio: "9:16", desc: "vertical Instagram story, 1080x1920" },
            "facebook-cover": { ratio: "2.7:1", desc: "wide Facebook cover photo, 820x312" },
            "twitter-header": { ratio: "3:1", desc: "wide Twitter/X header, 1500x500" },
            "youtube-thumbnail": { ratio: "16:9", desc: "YouTube thumbnail, 1280x720, eye-catching" },
            "linkedin-banner": { ratio: "4:1", desc: "wide LinkedIn banner, 1584x396" },
            "pinterest-pin": { ratio: "2:3", desc: "tall Pinterest pin, 1000x1500" },
            "tiktok": { ratio: "9:16", desc: "vertical TikTok cover, 1080x1920" },
          };
          const spec = platformSpecs[input.platform];
          const { url } = await generateImage({
            prompt: `Adapt and resize this image for ${spec.desc} format. Maintain the key visual elements and composition, intelligently extending or cropping as needed for the ${spec.ratio} aspect ratio. The result should look professionally designed for ${input.platform}. Clean, polished output.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, platform: input.platform };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Depth Map Generator — extract 3D depth from 2D images
    depthMap: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          style: z.enum(["grayscale", "colored", "normal-map"]).default("grayscale"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "depth-map", "Depth map generation");
        try {
          const styleDescriptions: Record<string, string> = {
            "grayscale": "Convert this image into a precise depth map. White represents closest objects, black represents the farthest. Smooth gradients for depth transitions. Accurate depth estimation for all objects in the scene. Professional 3D-ready depth map, grayscale only.",
            "colored": "Convert this image into a color-coded depth map. Use a rainbow/viridis color palette where warm colors (red/yellow) represent near objects and cool colors (blue/purple) represent far objects. Clear depth separation, professional visualization.",
            "normal-map": "Convert this image into a normal map for 3D rendering. RGB channels representing surface normals — X=Red, Y=Green, Z=Blue. The characteristic purple-blue appearance of a standard normal map. Suitable for 3D game assets and PBR workflows.",
          };
          const { url } = await generateImage({
            prompt: styleDescriptions[input.style],
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, style: input.style };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Character Sheet Generator — consistent character from multiple angles
    characterSheet: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1).max(1000),
          style: z.enum(["anime", "realistic", "cartoon", "comic", "pixel-art", "3d-render", "fantasy", "sci-fi"]).default("anime"),
          views: z.enum(["turnaround", "expressions", "poses", "full-sheet"]).default("turnaround"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "character-sheet", "Character sheet");
        try {
          const viewDescriptions: Record<string, string> = {
            "turnaround": "character turnaround sheet showing front view, 3/4 view, side view, and back view, all consistent design, white background, reference sheet layout",
            "expressions": "character expression sheet showing 6-8 different facial expressions (happy, sad, angry, surprised, neutral, thinking, laughing, determined), consistent character design, white background",
            "poses": "character pose sheet showing 4-6 different action poses and stances, consistent character design, dynamic movement, white background",
            "full-sheet": "comprehensive character reference sheet with front and back views, facial expressions, key poses, clothing details, color palette swatches, and design notes, professional character design document",
          };
          const { url } = await generateImage({
            prompt: `Professional character design ${viewDescriptions[input.views]}. Character: ${input.description}. Art style: ${input.style}. Clean lines, consistent proportions across all views, suitable for animation or game production. High quality character design reference.`,
          });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Meme Generator — create memes with AI
    meme: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(500),
          style: z.enum(["classic", "modern", "surreal", "wholesome", "dark-humor", "reaction", "drake", "expanding-brain", "custom"]).default("modern"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "meme", "Meme generation");
        try {
          // First generate the meme text via LLM
          const textResult = await invokeLLM({
            messages: [
              { role: "system", content: "You are a viral meme creator. Given a concept and style, generate meme text (top text and bottom text) that's genuinely funny. Keep it short, punchy, and shareable. Output JSON with: topText, bottomText, imageDescription (describe the ideal meme image)." },
              { role: "user", content: `Create a ${input.style} meme about: ${input.concept}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "meme",
                strict: true,
                schema: { type: "object", properties: { topText: { type: "string" }, bottomText: { type: "string" }, imageDescription: { type: "string" } }, required: ["topText", "bottomText", "imageDescription"], additionalProperties: false },
              },
            },
          });
          const memeContent = typeof textResult.choices[0]?.message?.content === "string" ? JSON.parse(textResult.choices[0].message.content) : null;
          if (!memeContent) throw new Error("Failed to generate meme text");

          const { url } = await generateImage({
            prompt: `Meme image: ${memeContent.imageDescription}. Bold white text with black outline at the top reading "${memeContent.topText}" and at the bottom reading "${memeContent.bottomText}". Classic meme format, Impact font style, funny and shareable.`,
          });

          return { url, ...memeContent, status: "completed" as const };
        } catch (error: any) {
          return { url: null, topText: null, bottomText: null, status: "failed" as const, error: error.message };
        }
      }),

    // Interior Design — redesign rooms with AI
    interiorDesign: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          style: z.enum(["modern", "minimalist", "scandinavian", "industrial", "bohemian", "mid-century", "japanese", "art-deco", "farmhouse", "luxury"]).default("modern"),
          room: z.enum(["living-room", "bedroom", "kitchen", "bathroom", "office", "dining", "outdoor", "custom"]).default("living-room"),
          keepLayout: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "interior-design", "Interior redesign");
        try {
          const styleDescriptions: Record<string, string> = {
            "modern": "modern contemporary interior, clean lines, neutral palette, statement lighting, open feel",
            "minimalist": "minimalist interior, extremely clean, few carefully chosen pieces, lots of white space, zen-like calm",
            "scandinavian": "Scandinavian interior, light wood, white walls, cozy textiles, hygge atmosphere, functional beauty",
            "industrial": "industrial loft interior, exposed brick, metal accents, raw materials, Edison bulbs, urban character",
            "bohemian": "bohemian interior, rich textures, layered rugs, plants, eclectic art, warm earthy tones, collected feel",
            "mid-century": "mid-century modern interior, iconic furniture pieces, organic shapes, teak wood, retro-modern fusion",
            "japanese": "Japanese interior, tatami elements, shoji screens, natural wood, minimalist zen, wabi-sabi aesthetic",
            "art-deco": "Art Deco interior, geometric patterns, gold accents, velvet, glamorous, 1920s elegance",
            "farmhouse": "modern farmhouse interior, shiplap, rustic wood, neutral palette, cozy comfort, practical charm",
            "luxury": "luxury interior, premium materials, marble, silk, designer furniture, five-star hotel quality",
          };
          const layoutNote = input.keepLayout ? "Maintain the exact room layout, dimensions, and window/door positions. Only change the furniture, decor, colors, and styling." : "Reimagine the entire space with new layout and design.";
          const { url } = await generateImage({
            prompt: `Redesign this ${input.room} in ${styleDescriptions[input.style]} style. ${layoutNote} Professional interior design rendering, photorealistic quality, magazine-worthy result. Beautiful staging, perfect lighting.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Thumbnail Maker — create eye-catching thumbnails
    thumbnail: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          platform: z.enum(["youtube", "twitch", "podcast", "blog", "course", "social"]).default("youtube"),
          style: z.enum(["bold", "minimal", "cinematic", "neon", "gradient", "collage"]).default("bold"),
          imageUrl: z.string().url().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "thumbnail", "Thumbnail generation");
        try {
          const platformSpecs: Record<string, string> = {
            "youtube": "YouTube thumbnail, 16:9, extremely eye-catching, high contrast, clickable",
            "twitch": "Twitch stream thumbnail, gaming aesthetic, vibrant, exciting",
            "podcast": "podcast cover art, professional, clean, legible at small sizes",
            "blog": "blog post header image, editorial quality, engaging",
            "course": "online course thumbnail, professional, trustworthy, educational",
            "social": "social media post thumbnail, shareable, scroll-stopping",
          };
          const styleDescriptions: Record<string, string> = {
            "bold": "bold large text, dramatic expressions, bright colors, high energy",
            "minimal": "clean minimalist design, elegant typography, lots of whitespace",
            "cinematic": "cinematic quality, film-like lighting, dramatic atmosphere",
            "neon": "neon glow effects, dark background, electric colors, futuristic",
            "gradient": "beautiful gradient backgrounds, modern typography, smooth colors",
            "collage": "dynamic collage of elements, layered composition, visual storytelling",
          };

          const generateOptions: any = {
            prompt: `Professional ${platformSpecs[input.platform]}. Style: ${styleDescriptions[input.style]}. Title text: "${input.title}" — the text must be large, legible, and attention-grabbing. High quality graphic design, 10x click-through rate improvement.`,
          };
          if (input.imageUrl) {
            generateOptions.originalImages = [{ url: input.imageUrl, mimeType: "image/png" }];
          }

          const { url } = await generateImage(generateOptions);
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Collage Maker — create AI-arranged photo collages
    collage: protectedProcedure
      .input(
        z.object({
          imageUrls: z.array(z.string().url()).min(2).max(9),
          layout: z.enum(["grid", "mosaic", "polaroid", "magazine", "scrapbook", "filmstrip"]).default("grid"),
          theme: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "collage", "Collage creation");
        try {
          const layoutDescriptions: Record<string, string> = {
            "grid": "clean grid collage layout with equal-sized cells, thin white borders between images",
            "mosaic": "artistic mosaic layout with varied image sizes, dynamic asymmetric arrangement",
            "polaroid": "scattered Polaroid photo style, each image in a white Polaroid frame, casual arrangement on a surface",
            "magazine": "editorial magazine layout, sophisticated typography, professional graphic design feel",
            "scrapbook": "creative scrapbook style with tape, stickers, decorative elements, fun and personal",
            "filmstrip": "cinematic filmstrip layout, images arranged in a horizontal film strip with perforations",
          };
          const themeNote = input.theme ? ` Theme/title: ${input.theme}.` : "";

          // Analyze the images with LLM, then create a collage prompt
          const { url } = await generateImage({
            prompt: `Create a beautiful ${layoutDescriptions[input.layout]} combining ${input.imageUrls.length} photos into one cohesive artwork.${themeNote} Professional quality, balanced composition, visually harmonious. The collage should tell a visual story.`,
            originalImages: input.imageUrls.slice(0, 3).map(u => ({ url: u, mimeType: "image/png" })),
          });

          return { url, status: "completed" as const, layout: input.layout };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Film Grain & Effects — add cinematic effects
    filmGrain: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          effect: z.enum(["35mm-grain", "vintage-kodak", "polaroid", "vhs", "infrared", "cross-process", "bleach-bypass", "lomo", "daguerreotype", "cyanotype"]).default("35mm-grain"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "film-grain", "Film effect");
        try {
          const effectDescriptions: Record<string, string> = {
            "35mm-grain": "authentic 35mm film grain, natural film texture, slightly warm tones, classic analog photography feel",
            "vintage-kodak": "Kodak Portra 400 film stock look, soft warm colors, creamy skin tones, slight halation, nostalgic 1990s feel",
            "polaroid": "instant Polaroid photo effect, slightly faded, warm cast, characteristic white border, vintage instant camera aesthetic",
            "vhs": "VHS tape effect, scan lines, tracking artifacts, color bleeding, chromatic aberration, retro 1980s video look",
            "infrared": "infrared photography effect, false colors, bright white foliage, dark sky, dreamlike surreal atmosphere",
            "cross-process": "cross-processed film effect, unexpected color shifts, high contrast, vivid greens and magentas, experimental",
            "bleach-bypass": "bleach bypass film effect, desaturated, high contrast, silvery metallic look, gritty cinematic feel",
            "lomo": "Lomography effect, heavy vignette, saturated colors, light leaks, soft focus at edges, lo-fi charming",
            "daguerreotype": "daguerreotype antique photograph effect, silvery metallic surface, extreme vintage, 1840s photography aesthetic",
            "cyanotype": "cyanotype print effect, prussian blue monochrome, botanical print aesthetic, alternative photographic process look",
          };
          const { url } = await generateImage({
            prompt: `Apply ${effectDescriptions[input.effect]} to this image. Maintain the original subject and composition while transforming it with the photographic effect. Professional quality.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const, effect: input.effect };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Virtual Try-On — overlay a garment onto a person via self-hosted CatVTON on RunPod
    virtualTryOn: protectedProcedure
      .input(
        z.object({
          personImageUrl: z.string().url(),
          garmentImageUrl: z.string().url(),
          clothType: z.enum(["upper", "lower", "overall"]).default("upper"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "virtual-tryon", "Virtual try-on");
        try {
          const { isRunPodAvailable, runpodTryOn } = await import("./_core/runpod");
          if (!isRunPodAvailable()) throw new Error("RunPod not configured");

          const resultBuffer = await runpodTryOn(
            input.personImageUrl,
            input.garmentImageUrl,
            input.clothType,
          );
          const { storagePut, generateStorageKey } = await import("./storage");
          const key = generateStorageKey("tryon", "png");
          const { url } = await storagePut(key, resultBuffer, "image/png");

          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Relight — change lighting of an image via fal.ai IC-Light v2
    relight: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          prompt: z.string().max(500),
          strength: z.number().min(0.1).max(1.0).default(0.7),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "relight", "AI relighting");
        try {
          const { ENV } = await import("./_core/env");
          const FAL_QUEUE_BASE = "https://queue.fal.run";
          const slug = "fal-ai/iclight-v2";
          const headers = { Authorization: `Key ${ENV.falApiKey}`, "Content-Type": "application/json" };

          const submitRes = await fetch(`${FAL_QUEUE_BASE}/${slug}`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              image_url: input.imageUrl,
              prompt: input.prompt,
              guidance_scale: 5,
              num_inference_steps: 28,
            }),
          });
          const { request_id } = await submitRes.json();

          let result: any;
          for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const statusRes = await fetch(`${FAL_QUEUE_BASE}/${slug}/requests/${request_id}/status`, {
              headers: { Authorization: `Key ${ENV.falApiKey}` },
            });
            const statusData = await statusRes.json();
            if (statusData.status === "COMPLETED") {
              const resultRes = await fetch(`${FAL_QUEUE_BASE}/${slug}/requests/${request_id}`, {
                headers: { Authorization: `Key ${ENV.falApiKey}` },
              });
              result = await resultRes.json();
              break;
            }
            if (statusData.status === "FAILED") throw new Error(statusData.error || "fal.ai relighting failed");
          }
          if (!result) throw new Error("fal.ai relighting timed out");

          // Download and store the first result image
          const imageUrl = result.images?.[0]?.url;
          if (!imageUrl) throw new Error("No image returned from fal.ai");
          const imgResp = await fetch(imageUrl);
          const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
          const { storagePut, generateStorageKey } = await import("./storage");
          const key = generateStorageKey("relight", "png");
          const { url } = await storagePut(key, imgBuffer, "image/png");

          return { url, status: "completed" as const };
        } catch (error: any) {
          // Fallback: Flux img2img with lighting-augmented prompt. Preserves
          // most of the composition; won't be as physically accurate as
          // IC-Light v2 but keeps the tool working when fal.ai is down.
          try {
            const lightingPrompt = `Same composition and subject, relit with: ${input.prompt}. Preserve all other details — subject, pose, framing, colors where not affected by lighting. Professional relighting, photorealistic.`;
            const { url } = await generateImage({
              prompt: lightingPrompt,
              originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
            });
            console.warn("[Relight] fal.ai failed, served via Flux img2img fallback:", error.message);
            return { url, status: "completed" as const, fallback: "flux-img2img" as const };
          } catch (fallbackErr: any) {
            logToolFailure({
              toolId: "relight",
              errorMessage: `fal.ai: ${error.message}; flux-fallback: ${fallbackErr.message}`,
              provider: "fal+flux",
              userId: ctx.user.id,
            });
            return { url: null, status: "failed" as const, error: `Relighting failed: ${error.message}` };
          }
        }
      }),

    // Generate 3D — convert an image to a 3D GLB model via fal.ai Trellis
    generate3D: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "3d-generate", "3D model generation");
        try {
          const { ENV } = await import("./_core/env");
          const FAL_QUEUE_BASE = "https://queue.fal.run";
          const slug = "fal-ai/trellis";
          const headers = { Authorization: `Key ${ENV.falApiKey}`, "Content-Type": "application/json" };

          const submitRes = await fetch(`${FAL_QUEUE_BASE}/${slug}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ image_url: input.imageUrl }),
          });
          const { request_id } = await submitRes.json();

          let result: any;
          for (let i = 0; i < 40; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const statusRes = await fetch(`${FAL_QUEUE_BASE}/${slug}/requests/${request_id}/status`, {
              headers: { Authorization: `Key ${ENV.falApiKey}` },
            });
            const statusData = await statusRes.json();
            if (statusData.status === "COMPLETED") {
              const resultRes = await fetch(`${FAL_QUEUE_BASE}/${slug}/requests/${request_id}`, {
                headers: { Authorization: `Key ${ENV.falApiKey}` },
              });
              result = await resultRes.json();
              break;
            }
            if (statusData.status === "FAILED") throw new Error(statusData.error || "fal.ai 3D generation failed");
          }
          if (!result) throw new Error("fal.ai 3D generation timed out");

          const { storagePut, generateStorageKey } = await import("./storage");

          // Download and store the GLB model
          const glbUrl = result.glb_file?.url || result.model_mesh?.url;
          if (!glbUrl) throw new Error("No GLB model returned from fal.ai");
          const glbResp = await fetch(glbUrl);
          const glbBuffer = Buffer.from(await glbResp.arrayBuffer());
          const glbKey = generateStorageKey("3d-model", "glb");
          const { url: modelUrl } = await storagePut(glbKey, glbBuffer, "model/gltf-binary");

          // Try to extract and store a preview image if available
          let previewUrl: string | undefined;
          const previewSrc = result.preview?.url || result.rendered_image?.url;
          if (previewSrc) {
            try {
              const prevResp = await fetch(previewSrc);
              const prevBuffer = Buffer.from(await prevResp.arrayBuffer());
              const prevKey = generateStorageKey("3d-preview", "png");
              const stored = await storagePut(prevKey, prevBuffer, "image/png");
              previewUrl = stored.url;
            } catch {
              // Preview is optional, continue without it
            }
          }

          return { modelUrl, previewUrl, status: "completed" as const };
        } catch (error: any) {
          // Fallback: Replicate firtoz/trellis. Same underlying model,
          // different host. Only attempted if REPLICATE_API_TOKEN is set.
          if (process.env.REPLICATE_API_TOKEN) {
            try {
              const createRes = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
                  "Content-Type": "application/json",
                  Prefer: "wait",
                },
                body: JSON.stringify({
                  model: "firtoz/trellis",
                  input: { images: [input.imageUrl], generate_model: true },
                }),
              });
              if (!createRes.ok) throw new Error(`Replicate HTTP ${createRes.status}`);
              let prediction: any = await createRes.json();

              // Poll if not completed in the initial wait
              for (let i = 0; i < 60 && prediction.status !== "succeeded" && prediction.status !== "failed"; i++) {
                await new Promise(r => setTimeout(r, 3000));
                const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
                  headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
                });
                prediction = await pollRes.json();
              }
              if (prediction.status !== "succeeded") throw new Error(`Replicate Trellis ${prediction.status}: ${prediction.error || "unknown"}`);

              const output = prediction.output || {};
              const glbUrlFromRep = output.model_file || output.glb || (Array.isArray(output) ? output[0] : null);
              if (!glbUrlFromRep) throw new Error("No GLB in Replicate Trellis output");

              const { storagePut, generateStorageKey } = await import("./storage");
              const glbResp = await fetch(glbUrlFromRep);
              const glbBuffer = Buffer.from(await glbResp.arrayBuffer());
              const glbKey = generateStorageKey("3d-model", "glb");
              const { url: modelUrl } = await storagePut(glbKey, glbBuffer, "model/gltf-binary");

              console.warn("[3D] fal.ai failed, served via Replicate firtoz/trellis:", error.message);
              return { modelUrl, previewUrl: undefined, status: "completed" as const, fallback: "replicate-trellis" as const };
            } catch (fallbackErr: any) {
              logToolFailure({
                toolId: "3d-generate",
                errorMessage: `fal.ai: ${error.message}; replicate-fallback: ${fallbackErr.message}`,
                provider: "fal+replicate",
                userId: ctx.user.id,
              });
              return { modelUrl: null, previewUrl: null, status: "failed" as const, error: `3D generation failed: ${error.message}` };
            }
          }

          logToolFailure({
            toolId: "3d-generate",
            errorMessage: error.message,
            provider: "fal-ai/trellis",
            userId: ctx.user.id,
          });
          return { modelUrl: null, previewUrl: null, status: "failed" as const, error: error.message };
        }
      }),

    // Comic Strip — generate a multi-panel comic strip via LLM + image generation
    comicStrip: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(1000),
          panels: z.number().min(2).max(6).default(4),
          style: z.enum(["manga", "western", "cartoon", "noir"]).default("western"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "comic-strip", "Comic strip generation");
        try {
          // Step 1: Generate panel descriptions via LLM
          const llmResponse = await invokeLLM({
            systemPrompt: `You are a comic strip writer. Given a concept, create ${input.panels} panel descriptions for a comic strip. Return ONLY a JSON array of strings, each describing one panel scene in detail for image generation. Keep characters consistent. All content must be 100% fictional.`,
            userPrompt: input.concept,
          });

          let panelDescriptions: string[];
          try {
            // Extract JSON array from the response (handle markdown code blocks)
            const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error("No JSON array found");
            panelDescriptions = JSON.parse(jsonMatch[0]);
          } catch {
            throw new Error("Failed to parse panel descriptions from LLM response");
          }

          if (!Array.isArray(panelDescriptions) || panelDescriptions.length === 0) {
            throw new Error("LLM returned invalid panel descriptions");
          }

          // Step 2: Generate an image for each panel
          const panels: { description: string; imageUrl: string }[] = [];
          for (const description of panelDescriptions) {
            const prompt = `Comic strip panel, ${input.style} style, ${description}. Consistent art style, bold outlines, speech-bubble-ready composition, high quality.`;
            const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
            panels.push({ description, imageUrl: url });
          }

          return { panels, status: "completed" as const };
        } catch (error: any) {
          return { panels: [], status: "failed" as const, error: error.message };
        }
      }),

    // T-Shirt Design — generate a print-ready t-shirt design
    tshirtDesign: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(500),
          style: z.enum(["minimalist", "vintage", "graffiti", "illustrative", "typography", "abstract"]).default("illustrative"),
          colorScheme: z.enum(["full-color", "monochrome", "limited-palette"]).default("full-color"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "tshirt-design", "T-shirt design");
        try {
          const prompt = `T-shirt print design, ${input.style} style, ${input.concept}. ${input.colorScheme} palette. Centered composition on transparent/white background, print-ready, high contrast, no background scene, isolated design suitable for DTG printing. Professional merchandise artwork.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
          return { url, status: "completed" as const, style: input.style };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Pixel Art Generator — 8/16-bit retro game art
    pixelArt: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(500),
          bitStyle: z.enum(["8-bit", "16-bit", "32-bit"]).default("16-bit"),
          subject: z.enum(["character", "item", "environment", "tileset", "sprite-sheet"]).default("character"),
          palette: z.enum(["gameboy", "nes", "snes", "pico-8", "c64", "full-color"]).default("full-color"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "pixel-art", "Pixel art generation");
        try {
          const prompt = `${input.bitStyle} pixel art ${input.subject}: ${input.concept}. ${input.palette} palette, crisp pixel edges, no anti-aliasing, game-ready sprite style, transparent background, centered composition, high contrast, retro video game aesthetic.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Coloring Book Page — clean line art from a concept
    coloringBook: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(500),
          difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
          theme: z.enum(["animals", "mandala", "fantasy", "nature", "vehicles", "characters", "seasonal", "custom"]).default("custom"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "coloring-book", "Coloring book page");
        try {
          const detailMap: Record<string, string> = {
            easy: "thick bold outlines, simple shapes, large open areas, minimal detail, suitable for children 4-8",
            medium: "medium-weight outlines, moderate detail, balanced complexity, suitable for older kids and casual adults",
            hard: "fine line work, intricate patterns, dense detail, suitable for adult coloring enthusiasts",
          };
          const prompt = `Black and white coloring book page, ${input.theme} theme: ${input.concept}. ${detailMap[input.difficulty]}. Pure black outlines on pure white background, NO shading, NO gray tones, NO color, NO fill — only clean line art. Printable 8.5x11 portrait orientation, crisp vector-like lines.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1280 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Tattoo Designer — stencil + full color variants
    tattooDesign: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(500),
          style: z.enum(["traditional", "neo-traditional", "blackwork", "fineline", "realism", "watercolor", "tribal", "japanese", "geometric", "minimalist"]).default("traditional"),
          placement: z.enum(["arm", "forearm", "back", "chest", "leg", "wrist", "neck", "ribcage", "any"]).default("any"),
          variant: z.enum(["stencil", "color", "both"]).default("both"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "tattoo-design", "Tattoo design");
        try {
          const baseDesc = `${input.style} tattoo design: ${input.concept}. Sized for ${input.placement} placement, clean composition on white background, professional tattoo flash artwork.`;
          const results: { type: string; url: string }[] = [];
          if (input.variant === "stencil" || input.variant === "both") {
            const { url: stencilUrl } = await generateImage({ prompt: `${baseDesc} Pure black ink stencil only, bold outlines, no color, no shading, stencil-ready for tattoo transfer.`, width: 1024, height: 1024 });
            results.push({ type: "stencil", url: stencilUrl });
          }
          if (input.variant === "color" || input.variant === "both") {
            const { url: colorUrl } = await generateImage({ prompt: `${baseDesc} Full color rendering showing finished tattoo result, rich saturated inks, realistic shading.`, width: 1024, height: 1024 });
            results.push({ type: "color", url: colorUrl });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Book / Album Cover Maker
    coverMaker: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(150),
          subtitle: z.string().max(200).optional(),
          author: z.string().max(100).optional(),
          genre: z.string().min(1).max(100),
          coverType: z.enum(["book", "album", "ebook", "audiobook", "magazine"]).default("book"),
          mood: z.enum(["mysterious", "romantic", "dark", "uplifting", "minimalist", "dramatic", "whimsical", "futuristic"]).default("dramatic"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "cover-maker", "Cover art");
        try {
          const dims = input.coverType === "album" ? { w: 1024, h: 1024 } : { w: 1024, h: 1536 };
          const typographyNote = input.coverType === "album"
            ? `"${input.title}"${input.author ? ` by ${input.author}` : ""}`
            : `"${input.title}"${input.subtitle ? ` (subtitle: ${input.subtitle})` : ""}${input.author ? ` by ${input.author}` : ""}`;
          const prompt = `Professional ${input.coverType} cover design, ${input.genre} genre, ${input.mood} mood. Title typography reads ${typographyNote}. Eye-catching focal image, genre-appropriate visual language, bestseller-quality commercial artwork, clean readable typography hierarchy, print-ready composition.`;
          const { url } = await generateImage({ prompt, width: dims.w, height: dims.h });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Pose / Character Turnaround — front / side / back reference sheet
    poseTurnaround: protectedProcedure
      .input(
        z.object({
          description: z.string().min(1).max(800),
          style: z.enum(["anime", "realistic", "comic", "3d-render", "sketch", "painterly"]).default("realistic"),
          views: z.number().min(2).max(4).default(3),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "pose-turnaround", "Character turnaround");
        try {
          const viewLabels = ["front view", "3/4 side view", "side profile view", "back view"].slice(0, input.views);
          const results: { view: string; url: string }[] = [];
          for (const view of viewLabels) {
            const prompt = `Character turnaround reference sheet, ${view}: ${input.description}. ${input.style} style, clean neutral background, standing T-pose or A-pose, full-body visible, consistent lighting and proportions, artist reference quality, matching design across all views.`;
            const { url } = await generateImage({ prompt, width: 768, height: 1280 });
            results.push({ view, url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Old Photo Colorizer — B&W → color (era-aware)
    photoColorize: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          era: z.enum(["victorian", "1920s", "1940s", "1960s", "1980s", "modern", "auto"]).default("auto"),
          intensity: z.enum(["subtle", "natural", "vivid"]).default("natural"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "photo-colorize", "Photo colorization");
        try {
          const eraNote = input.era === "auto" ? "Infer the era from visual cues and use historically accurate colors for the period." : `Era: ${input.era}. Use historically accurate clothing, skin tone, and environment colors appropriate to the ${input.era} period.`;
          const intensityNote: Record<string, string> = {
            subtle: "Gentle desaturated colors, film-like restraint, authentic period feel.",
            natural: "Balanced realistic colors, natural skin tones, accurate lighting.",
            vivid: "Rich saturated colors, vibrant but believable, modern color depth.",
          };
          const { url } = await generateImage({
            prompt: `Colorize this black and white photograph. ${eraNote} ${intensityNote[input.intensity]} Preserve original composition, grain, and subjects exactly — only add color. Professional colorization.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Podcast Cover Art — 3000x3000 square, genre/mood presets
    podcastCover: protectedProcedure
      .input(
        z.object({
          podcastName: z.string().min(1).max(100),
          tagline: z.string().max(150).optional(),
          hostName: z.string().max(100).optional(),
          genre: z.enum(["true-crime", "comedy", "business", "tech", "self-help", "news", "interview", "education", "health", "spirituality", "sports", "music", "other"]).default("other"),
          vibe: z.enum(["bold", "minimalist", "vintage", "dark", "playful", "professional", "artistic"]).default("bold"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "podcast-cover", "Podcast cover art");
        try {
          const title = `"${input.podcastName}"${input.tagline ? ` (tagline: ${input.tagline})` : ""}${input.hostName ? ` hosted by ${input.hostName}` : ""}`;
          const prompt = `Podcast cover art, square 1:1 composition, ${input.vibe} ${input.genre} aesthetic. Large readable title typography: ${title}. Eye-catching icon or illustration element, genre-appropriate color palette, legible when displayed small in Spotify/Apple Podcasts grid, commercial-quality design, no microphone clichés unless requested.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Etsy Listing Photo Pack — single product → 5 variants
    listingPhotos: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          productName: z.string().min(1).max(150),
          style: z.enum(["lifestyle", "studio", "flatlay", "outdoor", "home-decor"]).default("lifestyle"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "listing-photos", "Etsy listing photo pack");
        try {
          const angles = [
            `Hero shot: ${input.productName} centered, ${input.style} context, perfect studio lighting, primary listing photo.`,
            `Close-up detail shot: ${input.productName} showing texture and craftsmanship, shallow depth of field, macro quality.`,
            `In-use scene: ${input.productName} being used or worn in a natural ${input.style} setting, authentic moment.`,
            `Scale reference: ${input.productName} next to common objects showing size, informational composition.`,
            `Flatlay composition: ${input.productName} arranged with complementary props from above, Pinterest-worthy layout.`,
          ];
          const results: { angle: string; url: string }[] = [];
          for (const angle of angles) {
            const { url } = await generateImage({
              prompt: `${angle} Preserve the product exactly as shown in the reference image, only change background, angle, and context. E-commerce quality photography.`,
              originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
            });
            results.push({ angle: angle.split(":")[0], url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Real Estate Twilight — daytime exterior → golden hour / twilight
    realEstateTwilight: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          mode: z.enum(["golden-hour", "twilight", "blue-hour", "dusk"]).default("twilight"),
          addLights: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "real-estate-twilight", "Real estate twilight");
        try {
          const modeNote: Record<string, string> = {
            "golden-hour": "Warm golden hour lighting, sun low on the horizon, long soft shadows, honey-toned light on the facade.",
            "twilight": "Twilight sky with deep blue-purple gradient, balanced exterior/interior light, magic-hour real estate look.",
            "blue-hour": "Blue hour after sunset, deep cobalt sky, cool tones, professional architectural photography.",
            "dusk": "Dusk sky with soft pink and orange clouds, ambient warmth, inviting evening atmosphere.",
          };
          const windowsNote = input.addLights
            ? "Turn on all interior lights so windows glow warm yellow from inside, add exterior landscape and path lighting, create welcoming illuminated curb appeal."
            : "Keep lighting natural, no added artificial lights.";
          const { url } = await generateImage({
            prompt: `Convert this daytime real estate exterior to ${modeNote[input.mode]} ${windowsNote} Preserve the house architecture, landscaping, and composition exactly. MLS-quality real estate photography, twilight marketing shot.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Fashion Lookbook — garment concept → N lookbook scenes
    fashionLookbook: protectedProcedure
      .input(
        z.object({
          garmentDescription: z.string().min(1).max(500),
          season: z.enum(["spring", "summer", "fall", "winter", "resort", "any"]).default("any"),
          sceneCount: z.number().min(2).max(6).default(4),
          vibe: z.enum(["editorial", "streetwear", "luxury", "minimalist", "vintage", "athleisure", "bohemian"]).default("editorial"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "fashion-lookbook", "Fashion lookbook");
        try {
          const sceneTemplates = [
            "urban street scene, natural candid pose, mid-day light",
            "studio portrait on seamless neutral backdrop, soft strobe lighting",
            "outdoor natural setting, golden hour lighting, relaxed body language",
            "architectural minimalist interior, editorial pose, dramatic shadow play",
            "rooftop or terrace scene, cinematic wide shot, lifestyle atmosphere",
            "nightlife or indoor venue, moody ambient lighting, fashion-forward pose",
          ].slice(0, input.sceneCount);
          const results: { scene: string; url: string }[] = [];
          for (const scene of sceneTemplates) {
            const prompt = `${input.vibe} fashion lookbook photograph, ${input.season} season, model wearing: ${input.garmentDescription}. Scene: ${scene}. High-end fashion photography, consistent garment across all scenes, magazine-quality composition, shallow depth of field, authentic styling.`;
            const { url } = await generateImage({ prompt, width: 896, height: 1280 });
            results.push({ scene, url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Meme Template Filler — classic templates with user captions
    memeTemplate: protectedProcedure
      .input(
        z.object({
          template: z.enum(["drake", "distracted-boyfriend", "two-buttons", "expanding-brain", "change-my-mind", "is-this-a-pigeon", "woman-yelling-at-cat", "doge", "this-is-fine", "galaxy-brain"]),
          captions: z.array(z.string().max(200)).min(1).max(6),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "meme-template", "Meme template fill");
        try {
          const templateDesc: Record<string, string> = {
            "drake": `Classic Drake meme format, two stacked panels: top panel shows Drake rejecting with hand up (reject/disapproval pose) with caption "${input.captions[0] ?? ""}", bottom panel shows Drake approving with pointing gesture with caption "${input.captions[1] ?? ""}". Impact font, white text on colored panel backgrounds.`,
            "distracted-boyfriend": `Distracted boyfriend stock photo meme: boyfriend looking back at woman labeled "${input.captions[0] ?? ""}", girlfriend looking shocked labeled "${input.captions[1] ?? ""}", other woman labeled "${input.captions[2] ?? ""}". Stock photo aesthetic with white label text.`,
            "two-buttons": `Two buttons meme: sweating man in red shirt deciding between two red buttons — left button says "${input.captions[0] ?? ""}", right button says "${input.captions[1] ?? ""}". Comic panel style.`,
            "expanding-brain": `Expanding brain meme, ${input.captions.length} vertical panels each with a progressively more glowing brain next to escalating captions: ${input.captions.map((c, i) => `panel ${i + 1}: "${c}"`).join("; ")}. White panel backgrounds with black text, brain glows from dim to galactic.`,
            "change-my-mind": `Change my mind meme: man at table outdoors on campus with sign reading "${input.captions[0] ?? ""}". Photo-realistic meme aesthetic.`,
            "is-this-a-pigeon": `Is this a pigeon meme, anime man pointing at butterfly — man labeled "${input.captions[0] ?? ""}", butterfly labeled "${input.captions[1] ?? ""}", caption at bottom reads "Is this ${input.captions[2] ?? "a meme"}?". Classic anime screenshot meme.`,
            "woman-yelling-at-cat": `Woman yelling at confused white cat at dinner table meme, left panel woman caption "${input.captions[0] ?? ""}", right panel cat caption "${input.captions[1] ?? ""}". Two-panel format.`,
            "doge": `Classic doge meme, Shiba Inu with scattered Comic Sans captions: ${input.captions.map((c) => `"${c}"`).join(", ")}. Multicolor text, rainbow doge energy.`,
            "this-is-fine": `This is fine dog in burning room meme, dog holding coffee, caption "${input.captions[0] ?? ""}". Webcomic art style.`,
            "galaxy-brain": `Galaxy brain meme with ${input.captions.length} panels of progressively more cosmic brains, captions escalating: ${input.captions.map((c, i) => `level ${i + 1}: "${c}"`).join("; ")}.`,
          };
          const { url } = await generateImage({ prompt: templateDesc[input.template] + " Classic internet meme composition, shareable, square format.", width: 1024, height: 1024 });
          return { url, template: input.template, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // YouTube Chapter Thumbnails — batch generate per chapter
    ytChapterThumbnails: protectedProcedure
      .input(
        z.object({
          videoTitle: z.string().min(1).max(200),
          chapters: z.array(z.string().min(1).max(200)).min(2).max(10),
          style: z.enum(["bold-face", "tutorial", "vlog", "gaming", "educational", "reaction", "minimalist"]).default("bold-face"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "yt-thumbnails", "YouTube chapter thumbnails");
        try {
          const styleNote: Record<string, string> = {
            "bold-face": "bold shocked facial expression, massive contrast, saturated colors, MrBeast-style thumbnail",
            "tutorial": "clear labeled elements, arrows pointing at key item, screenshot-overlay style, educational clarity",
            "vlog": "authentic lifestyle moment, soft natural lighting, candid feel, subtle text overlay",
            "gaming": "dramatic in-game action, glowing effects, gamer-aesthetic title treatment, epic composition",
            "educational": "clean infographic feel, diagrammatic elements, professional edu-channel look",
            "reaction": "split-screen reaction, expressive face on one side, subject on other side, red circle highlight",
            "minimalist": "clean single focal element, tons of negative space, elegant typography, underrated-channel vibe",
          };
          const results: { chapter: string; url: string }[] = [];
          for (const chapter of input.chapters) {
            const prompt = `YouTube thumbnail, 16:9 format, for video "${input.videoTitle}", specifically for chapter: "${chapter}". ${styleNote[input.style]}. Large readable 3-4 word overlay text summarizing this chapter, eye-catching composition optimized for 8%+ CTR, YouTube algorithm friendly.`;
            const { url } = await generateImage({ prompt, width: 1280, height: 720 });
            results.push({ chapter, url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Instagram Carousel Designer — multi-slide branded carousel
    igCarousel: protectedProcedure
      .input(
        z.object({
          topic: z.string().min(1).max(500),
          slideCount: z.number().min(3).max(10).default(7),
          brandColor: z.string().max(20).optional(),
          style: z.enum(["educational", "listicle", "storytelling", "quote-pack", "before-after", "tips", "minimalist-editorial"]).default("educational"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "ig-carousel", "Instagram carousel");
        try {
          const outline = await invokeLLM({
            messages: [
              { role: "system", content: `You are an Instagram content strategist. Given a topic, output a ${input.slideCount}-slide carousel outline in JSON. Slide 1 must be the hook/cover, slide ${input.slideCount} must be the CTA. Middle slides deliver value.` },
              { role: "user", content: `Topic: ${input.topic}. Style: ${input.style}.` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "carousel",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    slides: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          headline: { type: "string" },
                          body: { type: "string" },
                          role: { type: "string", description: "hook | content | cta" },
                        },
                        required: ["headline", "body", "role"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["slides"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = outline.choices[0]?.message?.content;
          const parsed = typeof content === "string" ? JSON.parse(content) : null;
          if (!parsed?.slides?.length) throw new Error("Failed to generate carousel outline");

          const colorNote = input.brandColor ? `Brand accent color: ${input.brandColor}.` : "Neutral professional palette.";
          const slides: { headline: string; body: string; role: string; url: string }[] = [];
          for (const slide of parsed.slides as Array<{ headline: string; body: string; role: string }>) {
            const prompt = `Instagram carousel slide, 1:1 square format, ${input.style} style. ${colorNote} Headline: "${slide.headline}". Supporting copy: "${slide.body}". Role: ${slide.role}. Clean readable typography hierarchy, Instagram-native design, shareable and swipe-worthy, consistent visual system across deck.`;
            const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
            slides.push({ ...slide, url });
          }
          return { slides, status: "completed" as const };
        } catch (error: any) {
          return { slides: [], status: "failed" as const, error: error.message };
        }
      }),

    // Sticker Pack Designer — 6 stickers on transparent background
    stickerPack: protectedProcedure
      .input(
        z.object({
          theme: z.string().min(1).max(300),
          count: z.number().min(3).max(8).default(6),
          style: z.enum(["kawaii", "cartoon", "chibi", "minimal", "retro", "handdrawn", "3d"]).default("cartoon"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "sticker-pack", "Sticker pack");
        try {
          const outline = await invokeLLM({
            messages: [
              { role: "system", content: `You design sticker packs. Given a theme, output ${input.count} distinct sticker subjects in JSON. Each should be a single noun/expression that fits the theme and works as a die-cut sticker.` },
              { role: "user", content: `Theme: ${input.theme}. Style: ${input.style}.` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "stickers",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    stickers: { type: "array", items: { type: "object", properties: { subject: { type: "string" }, caption: { type: "string" } }, required: ["subject", "caption"], additionalProperties: false } },
                  },
                  required: ["stickers"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = outline.choices[0]?.message?.content;
          const parsed = typeof content === "string" ? JSON.parse(content) : null;
          if (!parsed?.stickers?.length) throw new Error("Failed to outline sticker pack");
          const results: { subject: string; caption: string; url: string }[] = [];
          for (const s of parsed.stickers as Array<{ subject: string; caption: string }>) {
            const prompt = `Die-cut sticker art, ${input.style} style: ${s.subject}${s.caption ? ` with caption "${s.caption}"` : ""}. Thick white border around the shape, fully isolated on pure white background (for easy transparent cutout), centered composition, Telegram/iMessage sticker aesthetic, bold and cheerful.`;
            const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
            results.push({ subject: s.subject, caption: s.caption, url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Recipe Card — Pinterest-ready recipe card
    recipeCard: protectedProcedure
      .input(
        z.object({
          dishName: z.string().min(1).max(150),
          ingredients: z.string().min(1).max(1000),
          steps: z.string().min(1).max(2000),
          cuisine: z.string().max(100).optional(),
          style: z.enum(["rustic", "modern", "magazine", "handwritten", "minimalist", "vintage"]).default("rustic"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "recipe-card", "Recipe card");
        try {
          const cuisineNote = input.cuisine ? `${input.cuisine} cuisine, ` : "";
          const prompt = `Pinterest-ready recipe card, 2:3 portrait format, ${input.style} design. Dish: "${input.dishName}". ${cuisineNote}Include a hero food photograph at top (styled shot of the finished dish), title typography "${input.dishName}" in ${input.style} font, ingredients list section with these items: ${input.ingredients.slice(0, 300)}, step-by-step instructions section summarizing: ${input.steps.slice(0, 400)}. Food blog aesthetic, print-ready, shareable. Clear readable hierarchy.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1536 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Invitation Designer — weddings, birthdays, events
    invitation: protectedProcedure
      .input(
        z.object({
          eventType: z.enum(["wedding", "birthday", "babyshower", "graduation", "anniversary", "corporate", "party", "other"]).default("birthday"),
          headline: z.string().min(1).max(200),
          details: z.string().min(1).max(500),
          style: z.enum(["elegant", "playful", "modern", "vintage", "floral", "minimalist", "rustic", "watercolor"]).default("elegant"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "invitation", "Event invitation");
        try {
          const prompt = `${input.eventType} invitation card, 5x7 portrait print-ready format, ${input.style} design. Headline typography: "${input.headline}". Supporting details section reads: "${input.details.slice(0, 300)}". Beautiful typography hierarchy, appropriate decorative motifs for ${input.eventType}, refined paper stock feel, professional stationery design, print-safe bleed composition.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1536 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Business Card — front and back
    businessCard: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          title: z.string().min(1).max(100),
          company: z.string().max(100).optional(),
          contact: z.string().min(1).max(300),
          style: z.enum(["modern", "minimalist", "bold", "elegant", "creative", "tech", "luxury"]).default("modern"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "business-card", "Business card");
        try {
          const companyLine = input.company ? `Company: "${input.company}". ` : "";
          const frontPrompt = `Business card front, 3.5x2 inch landscape print-ready, ${input.style} design. ${companyLine}Large readable name: "${input.name}". Title below: "${input.title}". Contact block: "${input.contact}". Clean typography hierarchy, logo/mark space, premium cardstock feel, professional brand aesthetic, high-end stationery.`;
          const backPrompt = `Business card back, 3.5x2 inch landscape, matching ${input.style} design system of the front. Minimal back treatment — brand color block, subtle mark or pattern, optional tagline space, designer cardstock feel.`;
          const [{ url: frontUrl }, { url: backUrl }] = await Promise.all([
            generateImage({ prompt: frontPrompt, width: 1344, height: 768 }),
            generateImage({ prompt: backPrompt, width: 1344, height: 768 }),
          ]);
          return { frontUrl, backUrl, status: "completed" as const };
        } catch (error: any) {
          return { frontUrl: null, backUrl: null, status: "failed" as const, error: error.message };
        }
      }),

    // Pet Portrait — royal/renaissance/fantasy pet portraits
    petPortrait: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          species: z.enum(["dog", "cat", "bird", "rabbit", "horse", "reptile", "other"]).default("dog"),
          style: z.enum(["royal-renaissance", "fantasy-knight", "space-captain", "victorian", "steampunk", "oil-painting", "watercolor", "pop-art"]).default("royal-renaissance"),
          petName: z.string().max(60).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "pet-portrait", "Pet portrait");
        try {
          const styleDesc: Record<string, string> = {
            "royal-renaissance": "Regal Renaissance oil painting, ermine robes, ornate throne, dramatic chiaroscuro lighting, museum-quality brushwork",
            "fantasy-knight": "Fantasy knight in shining armor, sword and shield, medieval banner backdrop, epic heroic portrait",
            "space-captain": "Sci-fi starship captain uniform, spacecraft bridge background, cinematic futuristic lighting",
            "victorian": "Victorian era formal portrait, high collar, sepia tones, ornate wallpaper background, antique photography",
            "steampunk": "Steampunk aviator with brass goggles, Victorian-industrial clothing, gears and brass, mechanical aesthetic",
            "oil-painting": "Classical oil painting portrait, master painter style, rich textures, museum gallery aesthetic",
            "watercolor": "Soft watercolor painting, loose brushwork, pastel palette, artistic portrait",
            "pop-art": "Bold pop art portrait, Andy Warhol style, saturated colors, graphic design aesthetic",
          };
          const nameNote = input.petName ? `Pet name: "${input.petName}", shown on a brass nameplate at the bottom. ` : "";
          const { url } = await generateImage({
            prompt: `Transform this ${input.species} photo into a portrait: ${styleDesc[input.style]}. ${nameNote}Preserve the pet's distinctive features, breed characteristics, and coloring exactly — only change the clothing, setting, and artistic treatment. Keep the pet's face recognizable.`,
            originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
          });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Tarot Card Designer — major arcana style
    tarotCard: protectedProcedure
      .input(
        z.object({
          cardName: z.string().min(1).max(100),
          symbolism: z.string().min(1).max(500),
          style: z.enum(["rider-waite", "mystical-modern", "art-nouveau", "celestial", "dark-fantasy", "watercolor-bohemian", "minimalist-geometric"]).default("rider-waite"),
          romanNumeral: z.string().max(10).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "tarot-card", "Tarot card design");
        try {
          const numeralNote = input.romanNumeral ? `Roman numeral "${input.romanNumeral}" at the top. ` : "";
          const prompt = `Tarot card design, 2.75x4.75 inch portrait format with decorative border, ${input.style} style. Card title: "${input.cardName}" in ornate serif at bottom. ${numeralNote}Central illustration depicting: ${input.symbolism}. Rich symbolic imagery, intricate decorative frame, arcane mystical atmosphere, deck-ready composition, high-contrast readability, spiritual/divinatory aesthetic.`;
          const { url } = await generateImage({ prompt, width: 768, height: 1344 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Movie Poster
    moviePoster: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(150),
          tagline: z.string().max(200).optional(),
          genre: z.enum(["action", "horror", "scifi", "drama", "comedy", "thriller", "romance", "fantasy", "documentary", "animation", "noir", "indie"]).default("scifi"),
          synopsis: z.string().min(1).max(500),
          credits: z.string().max(300).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "movie-poster", "Movie poster");
        try {
          const taglineNote = input.tagline ? `Tagline above title: "${input.tagline}". ` : "";
          const creditsNote = input.credits ? `Billing block at the bottom: "${input.credits}". ` : "Small cast/crew billing block at the bottom.";
          const prompt = `Theatrical movie poster, 24x36 inch portrait format, ${input.genre} genre. Massive title typography: "${input.title}". ${taglineNote}${creditsNote} Hero visual inspired by: ${input.synopsis}. Cinematic composition, commercial theatrical design, genre-appropriate color grading and lighting, bold poster typography hierarchy, one-sheet quality.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1536 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Trading Card Designer — TCG-style
    tradingCard: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          artDescription: z.string().min(1).max(500),
          stats: z.string().min(1).max(300),
          cardType: z.enum(["creature", "spell", "artifact", "character", "vehicle", "item"]).default("creature"),
          rarity: z.enum(["common", "uncommon", "rare", "mythic", "legendary"]).default("rare"),
          theme: z.enum(["fantasy", "scifi", "cyberpunk", "steampunk", "mythic", "horror", "cute"]).default("fantasy"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "trading-card", "Trading card");
        try {
          const prompt = `Trading card game (TCG) card, 2.5x3.5 inch portrait format, ${input.theme} theme, ${input.rarity} rarity. Card name at top: "${input.name}". ${input.cardType} type indicator. Central hero art depicting: ${input.artDescription}. Stats/abilities block at the bottom reads: "${input.stats}". Ornate frame appropriate to rarity (${input.rarity === "legendary" || input.rarity === "mythic" ? "foil-effect premium border with gemstone accents" : "clean printed border"}), Magic/Pokemon/Hearthstone-level production quality, collectible game aesthetic, readable typography hierarchy.`;
          const { url } = await generateImage({ prompt, width: 768, height: 1080 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Menu Designer — restaurant menu
    menuDesign: protectedProcedure
      .input(
        z.object({
          restaurantName: z.string().min(1).max(150),
          cuisine: z.string().min(1).max(100),
          sections: z.string().min(1).max(2000),
          style: z.enum(["elegant-fine-dining", "casual-bistro", "rustic-farmhouse", "modern-minimalist", "vintage-diner", "asian-contemporary", "brewpub", "coffeeshop"]).default("casual-bistro"),
          format: z.enum(["single-page", "bi-fold", "tri-fold"]).default("single-page"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "menu-design", "Menu design");
        try {
          const dims = input.format === "tri-fold" ? { w: 1536, h: 1024 } : { w: 1024, h: 1536 };
          const prompt = `Restaurant menu, ${input.format} print layout, ${input.style} design aesthetic. Restaurant name masthead: "${input.restaurantName}", ${input.cuisine} cuisine subtitle. Menu sections with pricing, laid out as: ${input.sections.slice(0, 1500)}. Elegant typography hierarchy, appropriate spacing and dividers, print-ready composition, professional restaurant stationery quality.`;
          const { url } = await generateImage({ prompt, width: dims.w, height: dims.h });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Greeting Card — front + inside
    greetingCard: protectedProcedure
      .input(
        z.object({
          occasion: z.enum(["birthday", "thank-you", "congratulations", "sympathy", "get-well", "holiday", "anniversary", "new-baby", "wedding", "generic"]).default("birthday"),
          recipient: z.string().max(100).optional(),
          tone: z.enum(["heartfelt", "funny", "formal", "punny", "minimalist", "whimsical"]).default("heartfelt"),
          customMessage: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "greeting-card", "Greeting card");
        try {
          const recipientNote = input.recipient ? `for "${input.recipient}"` : "";
          const frontPrompt = `${input.occasion} greeting card FRONT, 5x7 portrait print-ready, ${input.tone} tone. Cover visual appropriate to ${input.occasion} ${recipientNote}, minimal headline text. Professional stationery design, premium card quality, inviting composition.`;
          const msg = input.customMessage || `A thoughtful ${input.tone} ${input.occasion} message`;
          const insidePrompt = `${input.occasion} greeting card INSIDE, 5x7 portrait, matching design system of the front. Hand-lettered style message area with: "${msg}". Signature space below. Clean readable interior layout, subtle decorative accents, print-ready.`;
          const [{ url: frontUrl }, { url: insideUrl }] = await Promise.all([
            generateImage({ prompt: frontPrompt, width: 1024, height: 1536 }),
            generateImage({ prompt: insidePrompt, width: 1024, height: 1536 }),
          ]);
          return { frontUrl, insideUrl, status: "completed" as const };
        } catch (error: any) {
          return { frontUrl: null, insideUrl: null, status: "failed" as const, error: error.message };
        }
      }),

    // Emoji Creator — single custom emoji/emote
    emojiCreator: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(200),
          style: z.enum(["apple", "google", "twitter", "pixel", "hand-drawn", "3d", "meme", "retro"]).default("apple"),
          variant: z.enum(["discord", "slack", "twitch", "generic"]).default("generic"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "emoji-creator", "Emoji creation");
        try {
          const styleDesc: Record<string, string> = {
            apple: "Apple emoji style, glossy 3D look, rich gradients, rounded forms",
            google: "Google Noto emoji style, clean flat design, consistent color palette",
            twitter: "Twemoji style, simplified flat design, bold cheerful colors",
            pixel: "8-bit pixel emoji, crisp edges, 32x32 retro game style",
            "hand-drawn": "Doodle hand-drawn emoji, playful line work, casual charm",
            "3d": "Polished 3D rendered emoji, soft lighting, premium finish",
            meme: "Meme-inspired reaction emoji, exaggerated expression, viral-worthy",
            retro: "Retro 80s/90s emoji style, bold colors, vintage aesthetic",
          };
          const prompt = `Single custom emoji: ${input.concept}. ${styleDesc[input.style]}. Perfect square composition, centered on transparent/white background, highly readable at small sizes (16x16, 32x32), cheerful and expressive, ${input.variant} chat platform aesthetic.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1024 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Brand Style Guide — logo + palette + typography reference
    brandStyleGuide: protectedProcedure
      .input(
        z.object({
          brandName: z.string().min(1).max(100),
          industry: z.string().min(1).max(100),
          vibe: z.enum(["modern-minimalist", "luxury", "playful", "bold-industrial", "organic-natural", "tech-startup", "heritage-vintage", "edgy-punk"]).default("modern-minimalist"),
          tagline: z.string().max(150).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "brand-style-guide", "Brand style guide");
        try {
          const taglineNote = input.tagline ? `Tagline: "${input.tagline}". ` : "";
          const prompt = `Brand style guide reference sheet for "${input.brandName}" (${input.industry}), ${input.vibe} aesthetic. ${taglineNote}One-page layout showing: primary logo mark (centered top, prominent), color palette swatches with hex codes (5-6 colors), typography pairings (headline + body font samples), logo variations (horizontal, stacked, monochrome), brand pattern/texture element. Professional design system reference, print-ready, designer portfolio quality.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1536 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Event Flyer — promotional flyer
    eventFlyer: protectedProcedure
      .input(
        z.object({
          eventName: z.string().min(1).max(200),
          eventType: z.enum(["concert", "club-night", "conference", "workshop", "sale", "grand-opening", "fundraiser", "sports", "food", "art-show", "other"]).default("other"),
          details: z.string().min(1).max(500),
          style: z.enum(["bold-graphic", "minimal-elegant", "vintage-retro", "neon-club", "watercolor-indie", "corporate-clean", "handdrawn", "typographic"]).default("bold-graphic"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "event-flyer", "Event flyer");
        try {
          const prompt = `${input.eventType} event flyer, 8.5x11 portrait print-ready, ${input.style} design. Large headline: "${input.eventName}". Key details: "${input.details.slice(0, 350)}". Hero visual appropriate to ${input.eventType}, strong typographic hierarchy, eye-catching from across a room, QR-code-ready empty space. Professional promotional design, social-share-ready.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1344 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Certificate Designer — awards, diplomas, completions
    certificate: protectedProcedure
      .input(
        z.object({
          recipientName: z.string().min(1).max(100),
          awardTitle: z.string().min(1).max(200),
          issuer: z.string().min(1).max(150),
          issueDate: z.string().max(50).optional(),
          style: z.enum(["classical-formal", "modern-minimal", "playful-kids", "corporate", "academic", "creative-art"]).default("classical-formal"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "certificate", "Certificate");
        try {
          const dateNote = input.issueDate ? `Date: "${input.issueDate}". ` : "";
          const prompt = `Certificate of achievement, 11x8.5 landscape print-ready, ${input.style} design. Large ornate title "Certificate of Achievement" or similar. Awarded to: "${input.recipientName}" (large elegant script). For: "${input.awardTitle}". Issued by: "${input.issuer}". ${dateNote}Decorative border and seal appropriate to ${input.style} style, signature lines at bottom, professional diploma/award aesthetic.`;
          const { url } = await generateImage({ prompt, width: 1536, height: 1024 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Bookmark Designer — literary bookmarks
    bookmark: protectedProcedure
      .input(
        z.object({
          content: z.string().min(1).max(300),
          theme: z.enum(["literary-classic", "floral-botanical", "fantasy", "minimalist", "watercolor", "dark-academia", "cute-kawaii", "nature"]).default("literary-classic"),
          includeQuote: z.boolean().default(true),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "bookmark", "Bookmark design");
        try {
          const quoteNote = input.includeQuote ? `Features a quote or short phrase: "${input.content}" rendered beautifully as typography.` : `Hero visual inspired by: "${input.content}".`;
          const prompt = `Bookmark design, 2x6 inch portrait print-ready with ribbon tassel hole at top, ${input.theme} theme. ${quoteNote} Both sides designed as a matching set (front with visual, back with complementary pattern). Etsy-seller quality print-ready design, readable typography, collectible aesthetic.`;
          const { url } = await generateImage({ prompt, width: 512, height: 1536 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Zine Spread Designer — multi-page editorial
    zineSpread: protectedProcedure
      .input(
        z.object({
          topic: z.string().min(1).max(500),
          pages: z.number().min(2).max(6).default(4),
          style: z.enum(["punk-cut-paste", "indie-literary", "art-magazine", "photography-portfolio", "manifesto", "sci-fi-pulp"]).default("indie-literary"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "zine-spread", "Zine spread");
        try {
          const outline = await invokeLLM({
            messages: [
              { role: "system", content: `You edit zines. Given a topic, outline ${input.pages} distinct page spreads in JSON. Each page should have a heading, a short paragraph of editorial copy, and a description of the visual treatment.` },
              { role: "user", content: `Topic: ${input.topic}. Style: ${input.style}.` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "zine",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    pages: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { heading: { type: "string" }, body: { type: "string" }, visual: { type: "string" } },
                        required: ["heading", "body", "visual"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["pages"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = outline.choices[0]?.message?.content;
          const parsed = typeof content === "string" ? JSON.parse(content) : null;
          if (!parsed?.pages?.length) throw new Error("Failed to outline zine");
          const results: { heading: string; body: string; visual: string; url: string }[] = [];
          for (const p of parsed.pages as Array<{ heading: string; body: string; visual: string }>) {
            const prompt = `Zine page spread, ${input.style} aesthetic. Heading: "${p.heading}". Body copy: "${p.body}". Visual: ${p.visual}. Editorial layout with strong typography hierarchy, print-ready, hand-made zine feel with intentional design grit, consistent visual system.`;
            const { url } = await generateImage({ prompt, width: 1024, height: 1344 });
            results.push({ ...p, url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Concert Poster — gig/tour promotional
    concertPoster: protectedProcedure
      .input(
        z.object({
          artist: z.string().min(1).max(150),
          genre: z.enum(["rock", "hip-hop", "electronic", "indie", "country", "classical", "jazz", "metal", "folk", "punk", "pop", "reggae"]).default("indie"),
          details: z.string().min(1).max(400),
          style: z.enum(["psychedelic-60s", "punk-cut", "modern-gradient", "minimalist-editorial", "heavy-metal", "festival-colorful", "80s-synthwave", "woodblock-print"]).default("modern-gradient"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "concert-poster", "Concert poster");
        try {
          const prompt = `Concert / gig poster, 11x17 portrait print-ready, ${input.genre} music, ${input.style} design aesthetic. Massive artist typography: "${input.artist}". Tour/show details: "${input.details.slice(0, 300)}". Iconic hero visual or typography-driven composition, silkscreen-style print-ready artwork, collectible merch-quality design, live music poster tradition.`;
          const { url } = await generateImage({ prompt, width: 1024, height: 1536 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Architecture Concept — building visualization
    architectureConcept: protectedProcedure
      .input(
        z.object({
          buildingType: z.enum(["single-family-home", "apartment", "office-tower", "retail", "restaurant", "hotel", "civic", "industrial", "education", "cultural"]).default("single-family-home"),
          style: z.enum(["modern-minimalist", "mid-century", "traditional", "brutalist", "biophilic-green", "farmhouse", "mediterranean", "japanese", "scandinavian", "futuristic"]).default("modern-minimalist"),
          setting: z.string().min(1).max(300),
          view: z.enum(["exterior-hero", "street-view", "aerial", "interior-living", "interior-kitchen", "entry-approach"]).default("exterior-hero"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "architecture-concept", "Architecture concept");
        try {
          const prompt = `Architectural concept rendering, photorealistic 3D visualization quality, ${input.buildingType} in ${input.style} style. Setting: ${input.setting}. View: ${input.view.replace(/-/g, " ")}. Professional architectural rendering with natural lighting, landscaping detail, human-scale references, portfolio-quality composition, Archdaily magazine level, material realism.`;
          const { url } = await generateImage({ prompt, width: 1536, height: 1024 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
        }
      }),

    // Cosplay Reference Sheet — costume breakdown
    cosplayReference: protectedProcedure
      .input(
        z.object({
          character: z.string().min(1).max(300),
          views: z.number().min(2).max(4).default(3),
          focus: z.enum(["full-costume", "weapon-props", "hair-makeup", "accessories-detail"]).default("full-costume"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "cosplay-reference", "Cosplay reference");
        try {
          const viewLabels = ["front view", "3/4 side view", "side profile", "back view"].slice(0, input.views);
          const focusNote: Record<string, string> = {
            "full-costume": "full-body costume reference with every piece visible",
            "weapon-props": "detailed reference of weapons, props, and accessories",
            "hair-makeup": "close-up head and shoulders reference emphasizing hair, makeup, and facial details",
            "accessories-detail": "detailed close-ups of jewelry, buckles, belts, shoes, and small accessories",
          };
          const results: { view: string; url: string }[] = [];
          for (const view of viewLabels) {
            const prompt = `Cosplay costume reference sheet, ${view}: character is ${input.character}. Focus: ${focusNote[input.focus]}. Clean neutral studio background with grid, professional concept artist reference quality, consistent design across all views, costumer-friendly breakdown with visible seams, fabric textures, and construction details.`;
            const { url } = await generateImage({ prompt, width: 768, height: 1280 });
            results.push({ view, url });
          }
          return { results, status: "completed" as const };
        } catch (error: any) {
          return { results: [], status: "failed" as const, error: error.message };
        }
      }),

    // Travel Postcard — vintage postcard style
    travelPostcard: protectedProcedure
      .input(
        z.object({
          location: z.string().min(1).max(150),
          era: z.enum(["1920s", "1950s", "1970s", "modern", "retrofuturist"]).default("1950s"),
          tagline: z.string().max(150).optional(),
          style: z.enum(["illustrated", "photographic", "watercolor", "linocut", "art-deco"]).default("illustrated"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await tryDeductCredits(ctx.user.id, "travel-postcard", "Travel postcard");
        try {
          const taglineNote = input.tagline ? `Tagline or "Greetings from" style text: "${input.tagline}". ` : `Classic "Greetings from ${input.location}" headline text. `;
          const prompt = `Vintage travel postcard, 6x4 landscape format, ${input.era} era ${input.style} aesthetic. Location: ${input.location}. ${taglineNote}Iconic landmark or scene of the location prominently featured, vintage color palette appropriate to ${input.era}, authentic period typography, printed-postcard feel with slight vignette and paper texture, collectible travel memorabilia.`;
          const { url } = await generateImage({ prompt, width: 1536, height: 1024 });
          return { url, status: "completed" as const };
        } catch (error: any) {
          return { url: null, status: "failed" as const, error: error.message };
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

    // Text-to-Video — generate actual video clips via Veo 3 or Minimax
    textToVideo: protectedProcedure
      .input(
        z.object({
          prompt: z.string().min(1).max(2000),
          duration: z.enum(["4", "8"]).default("8"),
          aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
          style: z.enum(["cinematic", "anime", "documentary", "slow-motion", "timelapse", "drone", "handheld", "commercial"]).default("cinematic"),
          model: z.enum(["veo-3", "minimax", "runway-gen4.5", "runway-gen4-turbo", "kling-2.0", "kling-1.6", "cogvideo", "auto"]).default("auto"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Rate limit: 10 video requests per minute per user
        enforceRateLimit(`video.textToVideo:${ctx.user.id}`, 10, 60_000, "Video generation rate limit exceeded — max 10 per minute.");
        await tryDeductCredits(ctx.user.id, "text-to-video", "Text-to-video generation");

        const styleEnhancers: Record<string, string> = {
          "cinematic": "cinematic, shallow depth of field, film grain, dramatic lighting, professional color grading",
          "anime": "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
          "documentary": "documentary style, natural lighting, handheld camera, realistic",
          "slow-motion": "slow motion, 120fps, ultra smooth, dramatic moment captured in detail",
          "timelapse": "timelapse, hours compressed into seconds, dynamic movement of time",
          "drone": "aerial drone shot, sweeping bird's eye view, cinematic flyover",
          "handheld": "handheld camera, raw authentic feel, slight shake, intimate perspective",
          "commercial": "polished commercial production, perfect lighting, premium quality, advertising grade",
        };
        const enhancedPrompt = `${input.prompt}. ${styleEnhancers[input.style]}. High quality, professional production.`;

        // Direct model selection
        if (input.model.startsWith("runway-")) {
          const { RunwayProvider } = await import("./_core/providers/runway");
          const provider = new RunwayProvider();
          const result = await provider.generate({ prompt: enhancedPrompt, model: input.model, options: { duration: parseInt(input.duration) } });
          return { status: "completed" as const, videoUrl: result.url, model: input.model };
        }

        if (input.model.startsWith("kling-")) {
          const { KlingProvider } = await import("./_core/providers/kling");
          const provider = new KlingProvider();
          const result = await provider.generate({ prompt: enhancedPrompt, model: input.model, options: { duration: parseInt(input.duration) } });
          return { status: "completed" as const, videoUrl: result.url, model: input.model };
        }

        if (input.model === "minimax") {
          const { ReplicateProvider } = await import("./_core/providers/replicate");
          const provider = new ReplicateProvider();
          const result = await provider.generate({ prompt: enhancedPrompt, model: "minimax-video", options: { prompt_optimizer: true } });
          return { status: "completed" as const, videoUrl: result.url, model: "minimax" };
        }

        // Direct CogVideoX selection
        if (input.model === "cogvideo") {
          const { isRunPodAvailable, runpodCogVideo } = await import("./_core/runpod");
          if (!isRunPodAvailable()) return { videoUrl: null, status: "failed" as const, error: "RunPod not configured" };
          const videoBuffer = await runpodCogVideo(enhancedPrompt, 49, 50, 6.0);
          const { storagePut: stPut, generateStorageKey: genKey } = await import("./storage");
          const key = genKey("video", "mp4");
          const { url } = await stPut(key, videoBuffer, "video/mp4");
          return { status: "completed" as const, videoUrl: url, model: "cogvideo-selfhosted" };
        }

        // Auto mode: try providers in priority order based on availability
        const errors: string[] = [];

        // Priority 1: Runway Gen-4.5 (best quality)
        if (input.model === "auto" && process.env.RUNWAY_API_KEY) {
          try {
            const { RunwayProvider } = await import("./_core/providers/runway");
            const provider = new RunwayProvider();
            const result = await provider.generate({ prompt: enhancedPrompt, model: "runway-gen4.5", options: { duration: parseInt(input.duration) } });
            return { status: "completed" as const, videoUrl: result.url, model: "runway-gen4.5" };
          } catch (err: any) {
            errors.push(`Runway: ${err.message}`);
            console.warn("[Video] Runway failed, trying next:", err.message);
          }
        }

        // Priority 2: Google Veo 3
        if ((input.model === "auto" || input.model === "veo-3") && process.env.GEMINI_API_KEY) {
          try {
            const { generateVeo3Video } = await import("./_core/videoGeneration");
            const videoUrl = await generateVeo3Video({ prompt: enhancedPrompt, aspectRatio: input.aspectRatio, durationSeconds: parseInt(input.duration) });
            return { videoUrl, status: "completed" as const, duration: input.duration, style: input.style, model: "veo-3" };
          } catch (err: any) {
            if (input.model === "veo-3") return { videoUrl: null, status: "failed" as const, error: err.message };
            errors.push(`Veo 3: ${err.message}`);
            console.warn("[Video] Veo 3 failed, trying next:", err.message);
          }
        }

        // Priority 3: Kling 2.0 (best value)
        if (input.model === "auto" && process.env.KLING_ACCESS_KEY) {
          try {
            const { KlingProvider } = await import("./_core/providers/kling");
            const provider = new KlingProvider();
            const result = await provider.generate({ prompt: enhancedPrompt, model: "kling-2.0", options: { duration: parseInt(input.duration) } });
            return { status: "completed" as const, videoUrl: result.url, model: "kling-2.0" };
          } catch (err: any) {
            errors.push(`Kling: ${err.message}`);
            console.warn("[Video] Kling failed, trying next:", err.message);
          }
        }

        // Priority 4: Self-hosted CogVideoX on RunPod (~$0.07-0.18/video vs $0.50+ API)
        {
          const { isRunPodAvailable, runpodCogVideo } = await import("./_core/runpod");
          if (input.model === "auto" && isRunPodAvailable()) {
            try {
              const videoBuffer = await runpodCogVideo(enhancedPrompt, 49, 50, 6.0);
              const { storagePut: stPut, generateStorageKey: genKey } = await import("./storage");
              const key = genKey("video", "mp4");
              const { url } = await stPut(key, videoBuffer, "video/mp4");
              return { status: "completed" as const, videoUrl: url, model: "cogvideo-selfhosted" };
            } catch (err: any) {
              errors.push(`CogVideoX: ${err.message}`);
              console.warn("[Video] CogVideoX failed, trying Minimax:", err.message);
            }
          }
        }

        // Priority 5: Minimax via Replicate (fallback)
        if (input.model === "auto" && process.env.REPLICATE_API_TOKEN) {
          try {
            const { ReplicateProvider } = await import("./_core/providers/replicate");
            const provider = new ReplicateProvider();
            const result = await provider.generate({ prompt: enhancedPrompt, model: "minimax-video", options: { prompt_optimizer: true } });
            return { status: "completed" as const, videoUrl: result.url, model: "minimax" };
          } catch (err: any) {
            errors.push(`Minimax: ${err.message}`);
          }
        }

        return { videoUrl: null, status: "failed" as const, error: `All video providers failed:\n${errors.join("\n")}` }
      }),

    // Image-to-Video — animate a still image into a video clip via Veo 3
    imageToVideo: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string().url(),
          prompt: z.string().min(1).max(1000),
          duration: z.enum(["4", "8"]).default("8"),
          motionType: z.enum(["subtle", "moderate", "dynamic", "cinematic-zoom", "pan-left", "pan-right", "zoom-in", "zoom-out"]).default("moderate"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Rate limit: 10 video requests per minute per user
        enforceRateLimit(`video.imageToVideo:${ctx.user.id}`, 10, 60_000, "Video generation rate limit exceeded — max 10 per minute.");
        await tryDeductCredits(ctx.user.id, "image-to-video", "Image-to-video generation");

        const motionDescriptions: Record<string, string> = {
          "subtle": "very subtle gentle motion, slight parallax, breathing effect",
          "moderate": "moderate natural motion, elements gently moving, ambient animation",
          "dynamic": "dynamic movement, active motion, energetic camera work",
          "cinematic-zoom": "slow cinematic zoom with dramatic reveal",
          "pan-left": "smooth camera pan from right to left, revealing the scene",
          "pan-right": "smooth camera pan from left to right, revealing the scene",
          "zoom-in": "gradual zoom in towards the focal point, increasing intimacy",
          "zoom-out": "gradual zoom out revealing the full scene, establishing shot",
        };
        const enhancedPrompt = `${input.prompt}. Motion: ${motionDescriptions[input.motionType]}. Smooth, professional quality video animation.`;
        const errors: string[] = [];

        // Priority 1: Google Veo 3 (current primary, best quality-to-cost)
        if (process.env.GEMINI_API_KEY) {
          try {
            const imgResponse = await fetch(input.imageUrl);
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
            const imgBase64 = imgBuffer.toString("base64");
            const mimeType = imgResponse.headers.get("content-type") || "image/jpeg";
            const { generateVeo3Video } = await import("./_core/videoGeneration");
            const videoUrl = await generateVeo3Video({
              prompt: enhancedPrompt,
              durationSeconds: parseInt(input.duration),
              imageBase64: imgBase64,
              imageMimeType: mimeType,
            });
            return { videoUrl, status: "completed" as const, duration: input.duration, model: "veo-3" };
          } catch (err: any) {
            errors.push(`Veo 3: ${err.message}`);
            console.warn("[I2V] Veo 3 failed, trying next:", err.message);
          }
        }

        // Priority 2: Runway Gen-4.5 image-to-video
        if (process.env.RUNWAY_API_KEY) {
          try {
            const { RunwayProvider } = await import("./_core/providers/runway");
            const provider = new RunwayProvider();
            const result = await provider.generate({
              prompt: enhancedPrompt,
              model: "runway-gen4.5",
              options: { duration: parseInt(input.duration), imageUrl: input.imageUrl },
            });
            return { videoUrl: result.url, status: "completed" as const, duration: input.duration, model: "runway-gen4.5" };
          } catch (err: any) {
            errors.push(`Runway: ${err.message}`);
            console.warn("[I2V] Runway failed, trying next:", err.message);
          }
        }

        // Priority 3: Kling image-to-video
        if (process.env.KLING_ACCESS_KEY) {
          try {
            const { KlingProvider } = await import("./_core/providers/kling");
            const provider = new KlingProvider();
            const result = await provider.generate({
              prompt: enhancedPrompt,
              model: "kling-2.0",
              options: { duration: parseInt(input.duration), imageUrl: input.imageUrl },
            });
            return { videoUrl: result.url, status: "completed" as const, duration: input.duration, model: "kling-2.0" };
          } catch (err: any) {
            errors.push(`Kling: ${err.message}`);
            console.warn("[I2V] Kling failed, trying next:", err.message);
          }
        }

        // Priority 4: Minimax via Replicate (final fallback)
        if (process.env.REPLICATE_API_TOKEN) {
          try {
            const { ReplicateProvider } = await import("./_core/providers/replicate");
            const provider = new ReplicateProvider();
            const result = await provider.generate({
              prompt: enhancedPrompt,
              model: "minimax-video",
              options: { prompt_optimizer: true, first_frame_image: input.imageUrl },
            });
            return { videoUrl: result.url, status: "completed" as const, duration: input.duration, model: "minimax" };
          } catch (err: any) {
            errors.push(`Minimax: ${err.message}`);
          }
        }

        logToolFailure({
          toolId: "image-to-video",
          errorMessage: errors.join("; "),
          provider: "veo+runway+kling+minimax",
          userId: ctx.user.id,
        });
        return {
          videoUrl: null,
          status: "failed" as const,
          error: `All image-to-video providers failed:\n${errors.join("\n")}`,
        };
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
        const token = randomBytes(32).toString("hex");
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

  // ─── Audio Generation ─────────────────────────────────────────────────
  audio: audioRouter,

  // ─── Pricing & Subscriptions ─────────────────────────────────────────
  pricing: pricingRouter,

  // ─── Creator Marketplace ──────────────────────────────────────────────
  marketplace: marketplaceRouter,

  // ─── Real-time Collaboration ─────────────────────────────────────────
  collaboration: collaborationRouter,

  // ─── AI Support Chatbot ─────────────────────────────────────────────
  supportChat: supportChatRouter,

  export: router({
    metadata: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1).max(50) }))
      .query(async ({ ctx, input }) => {
        const gens = await getGenerationsForExport(input.ids, ctx.user.id);
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

  // ─── Song Creator ─────────────────────────────────────────────────────────
  song: router({
    generateLyrics: protectedProcedure
      .input(
        z.object({
          concept: z.string().min(1).max(1000),
          genre: z.enum(["pop", "rock", "hiphop", "rnb", "reggae", "dancehall", "afrobeats", "electronic", "house", "techno", "drill", "trap", "lofi", "jazz", "blues", "indie", "country", "latin", "reggaeton", "kpop", "soul", "gospel", "funk", "disco", "metal", "punk", "folk", "classical", "ambient", "phonk"]),
          mood: z.enum(["happy", "sad", "energetic", "chill", "dark", "romantic", "empowering", "nostalgic", "dreamy", "aggressive"]),
          songStructure: z.string().max(200).optional(),
          language: z.string().max(50).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        enforceRateLimit(`song.generateLyrics:${ctx.user.id}`, 20, 60_000, "Lyrics generation rate limit exceeded — max 20 per minute.");
        await tryDeductCredits(ctx.user.id, "prompt-assist", "AI lyrics generation");
        const { generateLyrics } = await import("./_core/songGeneration");
        return generateLyrics(input);
      }),

    generateSong: protectedProcedure
      .input(
        z.object({
          lyrics: z.string().min(1).max(5000),
          genre: z.string().min(1).max(100),
          mood: z.string().min(1).max(100),
          tempo: z.enum(["slow", "medium", "fast"]).optional(),
          vocalStyle: z.enum(["male", "female", "duet", "choir"]).optional(),
          instrumentStyle: z.string().max(500).optional(),
          title: z.string().max(200).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        enforceRateLimit(`song.generateSong:${ctx.user.id}`, 10, 60_000, "Song generation rate limit exceeded — max 10 per minute.");
        await tryDeductCredits(ctx.user.id, "music-gen", "AI Song generation");
        const { generateSong } = await import("./_core/songGeneration");
        const result = await generateSong(input);
        return { ...result, title: input.title || "Untitled" };
      }),

    generateMusicVideo: protectedProcedure
      .input(
        z.object({
          songUrl: z.string().min(1),
          photoUrl: z.string().optional(),
          concept: z.string().min(1).max(1000),
          style: z.enum(["cinematic", "animated", "psychedelic", "performance", "lyric-video", "abstract", "retro"]).default("cinematic"),
          aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("9:16"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Rate limit: 10 video requests per minute per user
        enforceRateLimit(`song.generateMusicVideo:${ctx.user.id}`, 10, 60_000, "Video generation rate limit exceeded — max 10 per minute.");
        await tryDeductCredits(ctx.user.id, "text-to-video", "Music video generation");

        // Generate video scenes based on the concept + photo
        const scenePrompt = input.photoUrl
          ? `Music video scene: ${input.concept}. Style: ${input.style}. The subject from the reference photo should appear prominently. Cinematic, high production value, synced to music.`
          : `Music video scene: ${input.concept}. Style: ${input.style}. Cinematic, high production value, visually stunning, synced to music.`;

        const { generateVeo3Video } = await import("./_core/videoGeneration");
        const videoUrl = await generateVeo3Video({
          prompt: scenePrompt,
          aspectRatio: input.aspectRatio,
          durationSeconds: 8,
        });

        return {
          videoUrl,
          songUrl: input.songUrl,
          status: "completed" as const,
          style: input.style,
          aspectRatio: input.aspectRatio,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
