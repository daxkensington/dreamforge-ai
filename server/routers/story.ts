/**
 * One-Click Story router — turns "an idea" into a 4-6 scene illustrated
 * story with optional character consistency and optional generated music.
 *
 * This is the OpenArt "Story" pattern — competitor proven to convert. We
 * don't ship anything new under the hood; this composes existing pieces:
 *   - LLM storyboard generation (Phase 11 logic, inlined)
 *   - generateImage (with optional character description prepended)
 *   - audio.generate music (kicked off async, polled by the client)
 *
 * Returns the full story payload synchronously (scenes + image URLs) plus
 * an `audioGenerationId` the client polls if music was requested.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { generateImage } from "../_core/imageGeneration";
import { invokeLLM } from "../_core/llm";
import { requireToolActive } from "../_core/toolStatus";
import { deductCredits } from "../stripe";
import { getDb } from "../db";
import { getCharacter } from "../dbExtended";
import { audioGenerations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Cost: storyboard LLM call + N image gens + optional music.
// Charged as one bundled cost so the "one-click" feels honest.
function totalCost(sceneCount: number, withMusic: boolean): number {
  const storyboard = 5;
  const perImage = 5;
  const music = withMusic ? 6 : 0;
  return storyboard + sceneCount * perImage + music;
}

export const storyRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        idea: z.string().min(10).max(1000),
        sceneCount: z.number().min(3).max(6).default(4),
        style: z
          .enum(["cinematic", "anime", "watercolor", "comic", "noir", "dreamlike"])
          .default("cinematic"),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
        characterId: z.number().optional(),
        withMusic: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("storyboard");

      const cost = totalCost(input.sceneCount, input.withMusic);
      const debit = await deductCredits(
        ctx.user.id,
        cost,
        `One-Click Story (${input.sceneCount} scenes${input.withMusic ? " + music" : ""})`,
      );
      if (!debit.success) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: `Insufficient credits. Story costs ${cost} — you have ${debit.balance}.`,
        });
      }

      // Optional character description prepended to every scene prompt for
      // visual consistency across scenes — the OpenArt pattern.
      let characterClause = "";
      if (input.characterId) {
        const char = await getCharacter(input.characterId, ctx.user.id);
        if (char) {
          characterClause =
            ` Main character: ${char.name}. ${char.description ?? ""} ${char.styleNotes ?? ""}`.trim();
        }
      }

      // ─── Step 1: generate storyboard JSON via LLM ───────────────────
      const storyboardResp = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              `You are a video story director. Create a ${input.sceneCount}-scene short story from the user's idea, in ${input.style} style. ` +
              `For each scene, write a vivid 2-3 sentence visual description suitable for AI image generation. ` +
              `Maintain narrative continuity — set up, escalate, resolve. ` +
              `Output JSON: { title, synopsis, mood, musicMood, scenes: [{ sceneNumber, narration, visual, mood }] }`,
          },
          {
            role: "user",
            content: `Idea: ${input.idea}${characterClause ? `\n\n${characterClause}` : ""}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "story_storyboard",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                synopsis: { type: "string" },
                mood: { type: "string" },
                musicMood: { type: "string", description: "1-3 words: e.g. 'epic cinematic', 'gentle whimsical'" },
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneNumber: { type: "number" },
                      narration: { type: "string" },
                      visual: { type: "string" },
                      mood: { type: "string" },
                    },
                    required: ["sceneNumber", "narration", "visual", "mood"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "synopsis", "mood", "musicMood", "scenes"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = storyboardResp.choices[0]?.message?.content;
      const storyboard = typeof content === "string" ? JSON.parse(content) : null;
      if (!storyboard?.scenes?.length) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Storyboard generation failed" });
      }

      // ─── Step 2: generate one image per scene ───────────────────────
      // Sequential rather than parallel — most providers throttle and we
      // want determinism in the order returned to the user.
      const scenesWithImages: any[] = [];
      for (const scene of storyboard.scenes) {
        const prompt =
          `${scene.visual}. ${characterClause}. ` +
          `Style: ${input.style} cinematography, ${input.aspectRatio} aspect ratio. ` +
          `Mood: ${scene.mood}. High production value, professional composition.`;
        try {
          const { url } = await generateImage({ prompt });
          scenesWithImages.push({ ...scene, imageUrl: url ?? null });
        } catch {
          scenesWithImages.push({ ...scene, imageUrl: null });
        }
      }

      // ─── Step 3: kick off music generation async ─────────────────────
      let audioGenerationId: number | null = null;
      if (input.withMusic) {
        const db = await getDb();
        if (db) {
          try {
            const [inserted] = await db
              .insert(audioGenerations)
              .values({
                userId: ctx.user.id,
                type: "music",
                prompt: `${storyboard.musicMood} soundtrack for: ${storyboard.synopsis}`,
                duration: 30,
                model: "musicgen",
                status: "generating",
                metadata: { storyTitle: storyboard.title },
              })
              .returning({ id: audioGenerations.id });
            audioGenerationId = inserted?.id ?? null;

            // Fire-and-forget the actual generation. It updates the row in
            // place; the client polls audio.get(id) to retrieve when ready.
            (async () => {
              try {
                const { generateMusic } = await import("../_core/audioGeneration");
                const audioResult = await generateMusic({
                  type: "music",
                  prompt: `${storyboard.musicMood} soundtrack for: ${storyboard.synopsis}`,
                  duration: 30,
                });
                const dbInner = await getDb();
                if (dbInner && audioGenerationId) {
                  await dbInner
                    .update(audioGenerations)
                    .set({
                      status: "complete",
                      audioUrl: audioResult.audioUrl,
                    } as any)
                    .where(eq(audioGenerations.id, audioGenerationId));
                }
              } catch (err) {
                console.error("[story] music gen failed:", err);
                const dbInner = await getDb();
                if (dbInner && audioGenerationId) {
                  await dbInner
                    .update(audioGenerations)
                    .set({
                      status: "failed",
                      errorMessage: (err as Error)?.message ?? "music gen failed",
                    } as any)
                    .where(eq(audioGenerations.id, audioGenerationId));
                }
              }
            })().catch(() => {});
          } catch (err) {
            console.error("[story] failed to kick off music gen:", err);
          }
        }
      }

      return {
        status: "completed" as const,
        title: storyboard.title as string,
        synopsis: storyboard.synopsis as string,
        mood: storyboard.mood as string,
        scenes: scenesWithImages,
        audioGenerationId,
      };
    }),

  /**
   * Poll endpoint for the music gen kicked off in story.create. Returns the
   * audio status + URL when ready. Owned by the calling user.
   */
  getAudioStatus: protectedProcedure
    .input(z.object({ audioGenerationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const rows = await db
        .select()
        .from(audioGenerations)
        .where(
          and(
            eq(audioGenerations.id, input.audioGenerationId),
            eq(audioGenerations.userId, ctx.user.id),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        status: row.status,
        audioUrl: row.audioUrl ?? null,
        errorMessage: (row as any).errorMessage ?? null,
      };
    }),
});
