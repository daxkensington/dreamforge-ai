import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { enforceRateLimit } from "../rate-limit";
import {
  generateAudio,
  syncAudioToVideo,
  type AudioGenerationRequest,
} from "../_core/audioGeneration";
import { getDb } from "../db";
import { audioGenerations, audioPresets, videoProjects } from "../../drizzle/schema";
import { deductCredits, CREDIT_COSTS } from "../stripe";

// ─── Credit costs for audio tools ───────────────────────────────────────────

// Extend CREDIT_COSTS at runtime
CREDIT_COSTS["audio-sfx"] = 2;
CREDIT_COSTS["audio-music"] = 4;
CREDIT_COSTS["audio-voiceover"] = 3;
CREDIT_COSTS["audio-ambient"] = 3;
CREDIT_COSTS["audio-merge"] = 2;

async function tryDeductAudioCredits(userId: number, tool: string, description?: string) {
  const cost = CREDIT_COSTS[tool] || 2;
  try {
    await deductCredits(userId, cost, description ?? `Audio: ${tool}`);
  } catch (error: any) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error.message || "Insufficient credits",
    });
  }
}

// ─── Default Presets ────────────────────────────────────────────────────────

const DEFAULT_PRESETS = [
  { name: "Epic Orchestral", category: "cinematic" as const, settings: { mood: "epic", style: "orchestral", tempo: 120 } },
  { name: "Suspense Strings", category: "cinematic" as const, settings: { mood: "tense", style: "strings", tempo: 80 } },
  { name: "Heroic Brass", category: "cinematic" as const, settings: { mood: "triumphant", style: "brass orchestra", tempo: 130 } },
  { name: "Synthwave Pulse", category: "electronic" as const, settings: { mood: "energetic", style: "synthwave", tempo: 128 } },
  { name: "Lo-fi Chill", category: "electronic" as const, settings: { mood: "relaxed", style: "lo-fi hip hop", tempo: 85 } },
  { name: "Techno Drive", category: "electronic" as const, settings: { mood: "driving", style: "techno", tempo: 140 } },
  { name: "Floating Pads", category: "ambient" as const, settings: { mood: "dreamy", style: "ambient pads", tempo: 60 } },
  { name: "Deep Space", category: "ambient" as const, settings: { mood: "ethereal", style: "space ambient", tempo: 50 } },
  { name: "Forest Morning", category: "nature" as const, settings: { mood: "peaceful", style: "nature sounds", tempo: 0 } },
  { name: "Ocean Waves", category: "nature" as const, settings: { mood: "calm", style: "ocean", tempo: 0 } },
  { name: "Rainy City", category: "urban" as const, settings: { mood: "melancholy", style: "urban rain", tempo: 0 } },
  { name: "Busy Cafe", category: "urban" as const, settings: { mood: "cozy", style: "cafe ambience", tempo: 0 } },
  { name: "Thunder Storm", category: "dramatic" as const, settings: { mood: "intense", style: "storm", tempo: 0 } },
  { name: "War Drums", category: "dramatic" as const, settings: { mood: "aggressive", style: "tribal drums", tempo: 110 } },
];

// ─── Audio Router ───────────────────────────────────────────────────────────

export const audioRouter = router({
  // Generate audio from a prompt
  generate: protectedProcedure
    .input(
      z.object({
        type: z.enum(["sfx", "music", "voiceover", "ambient"]),
        prompt: z.string().min(1).max(2000),
        duration: z.number().min(1).max(300),
        options: z
          .object({
            tempo: z.number().min(20).max(300).optional(),
            mood: z.string().max(128).optional(),
            style: z.string().max(256).optional(),
            voiceId: z.string().max(128).optional(),
            syncToVideo: z.string().max(2048).optional(),
          })
          .optional(),
        projectId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate limit: 10 audio requests per minute per user
      enforceRateLimit(`audio.generate:${ctx.user.id}`, 10, 60_000, "Audio generation rate limit exceeded — max 10 per minute.");

      const creditTool = `audio-${input.type}`;
      await tryDeductAudioCredits(
        ctx.user.id,
        creditTool,
        `Audio ${input.type}: ${input.prompt.slice(0, 50)}`
      );

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // If projectId given, verify ownership
      if (input.projectId) {
        const [project] = await db
          .select()
          .from(videoProjects)
          .where(
            and(
              eq(videoProjects.id, input.projectId),
              eq(videoProjects.userId, ctx.user.id)
            )
          );
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
      }

      // Create the audio generation record
      const [inserted] = await db.insert(audioGenerations).values({
        userId: ctx.user.id,
        type: input.type,
        prompt: input.prompt,
        duration: input.duration,
        model: input.type === "voiceover" ? "bark" : input.type === "sfx" ? "audiogen" : "musicgen",
        status: "generating",
        projectId: input.projectId ?? null,
        metadata: input.options ?? {},
      }).returning({ id: audioGenerations.id });
      const audioId = inserted.id;

      // Generate in background (non-blocking)
      const request: AudioGenerationRequest = {
        type: input.type,
        prompt: input.prompt,
        duration: input.duration,
        options: input.options,
      };

      (async () => {
        try {
          const result = await generateAudio(request);

          await db
            .update(audioGenerations)
            .set({
              status: "complete",
              audioUrl: result.audioUrl,
              model: result.model,
              duration: result.duration,
              metadata: result.metadata,
            })
            .where(eq(audioGenerations.id, Number(audioId)));
        } catch (error: any) {
          await db
            .update(audioGenerations)
            .set({
              status: "failed",
              errorMessage: error.message,
            })
            .where(eq(audioGenerations.id, Number(audioId)));
        }
      })();

      return { id: Number(audioId), status: "generating" as const };
    }),

  // Get current user's audio generations (paginated)
  getMyAudios: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          type: z.enum(["sfx", "music", "voiceover", "ambient"]).optional(),
          projectId: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      const conditions = [eq(audioGenerations.userId, ctx.user.id)];

      if (input?.type) {
        conditions.push(eq(audioGenerations.type, input.type));
      }
      if (input?.projectId !== undefined) {
        conditions.push(eq(audioGenerations.projectId, input.projectId));
      }

      const rows = await db
        .select()
        .from(audioGenerations)
        .where(and(...conditions))
        .orderBy(desc(audioGenerations.createdAt))
        .limit(limit)
        .offset(offset);

      return rows;
    }),

  // Get available audio presets (public)
  getAudioPresets: publicProcedure
    .input(
      z
        .object({
          category: z
            .enum(["cinematic", "electronic", "ambient", "nature", "urban", "dramatic"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();

      // Try database first
      if (db) {
        try {
          const conditions = input?.category
            ? [eq(audioPresets.category, input.category)]
            : [];
          const rows = await db
            .select()
            .from(audioPresets)
            .where(conditions.length ? and(...conditions) : undefined);

          if (rows.length > 0) return rows;
        } catch {
          // Fall through to defaults
        }
      }

      // Return built-in defaults
      const filtered = input?.category
        ? DEFAULT_PRESETS.filter((p) => p.category === input.category)
        : DEFAULT_PRESETS;

      return filtered.map((p, i) => ({
        id: i + 1,
        name: p.name,
        category: p.category,
        settings: p.settings,
        isDefault: true,
        createdAt: new Date(),
      }));
    }),

  // Attach an existing audio generation to a video project
  attachToProject: protectedProcedure
    .input(
      z.object({
        audioId: z.number(),
        projectId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify audio ownership
      const [audio] = await db
        .select()
        .from(audioGenerations)
        .where(
          and(
            eq(audioGenerations.id, input.audioId),
            eq(audioGenerations.userId, ctx.user.id)
          )
        );
      if (!audio) throw new TRPCError({ code: "NOT_FOUND", message: "Audio not found" });

      // Verify project ownership
      const [project] = await db
        .select()
        .from(videoProjects)
        .where(
          and(
            eq(videoProjects.id, input.projectId),
            eq(videoProjects.userId, ctx.user.id)
          )
        );
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      await db
        .update(audioGenerations)
        .set({ projectId: input.projectId })
        .where(eq(audioGenerations.id, input.audioId));

      return { success: true };
    }),

  // Detach audio from a video project
  detachFromProject: protectedProcedure
    .input(z.object({ audioId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [audio] = await db
        .select()
        .from(audioGenerations)
        .where(
          and(
            eq(audioGenerations.id, input.audioId),
            eq(audioGenerations.userId, ctx.user.id)
          )
        );
      if (!audio) throw new TRPCError({ code: "NOT_FOUND", message: "Audio not found" });

      await db
        .update(audioGenerations)
        .set({ projectId: null })
        .where(eq(audioGenerations.id, input.audioId));

      return { success: true };
    }),

  // Get all audio tracks for a specific video project
  getProjectAudio: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify project ownership
      const [project] = await db
        .select()
        .from(videoProjects)
        .where(
          and(
            eq(videoProjects.id, input.projectId),
            eq(videoProjects.userId, ctx.user.id)
          )
        );
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      const rows = await db
        .select()
        .from(audioGenerations)
        .where(eq(audioGenerations.projectId, input.projectId))
        .orderBy(desc(audioGenerations.createdAt));

      return rows;
    }),

  // Merge audio and video into a final output
  mergeAudioVideo: protectedProcedure
    .input(
      z.object({
        audioId: z.number(),
        videoUrl: z.string().min(1).max(2048),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      await tryDeductAudioCredits(ctx.user.id, "audio-merge", "Merge audio + video");

      // Verify audio ownership and completion
      const [audio] = await db
        .select()
        .from(audioGenerations)
        .where(
          and(
            eq(audioGenerations.id, input.audioId),
            eq(audioGenerations.userId, ctx.user.id)
          )
        );
      if (!audio) throw new TRPCError({ code: "NOT_FOUND", message: "Audio not found" });
      if (audio.status !== "complete" || !audio.audioUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Audio generation must be complete before merging",
        });
      }

      // Merge in background
      let mergedUrl: string | null = null;
      try {
        mergedUrl = await syncAudioToVideo(audio.audioUrl, input.videoUrl);
      } catch (error: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Merge failed: ${error.message}`,
        });
      }

      return { mergedUrl, status: "complete" as const };
    }),
});
