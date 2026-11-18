import { failLegacyJobAndRefund } from "../_core/walletAccounting";
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
import { refundCreditsVerified } from "../_core/legacyToolRefund";
import { getDb } from "../db";
import { getCharacter } from "../dbExtended";
import { audioGenerations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Cost: storyboard LLM call + N image gens + optional music.
// Charged as one bundled cost so the "one-click" feels honest.
const STORYBOARD_COST = 5;
const STORY_IMAGE_COST = 5;
const STORY_MUSIC_COST = 6;

function totalCost(sceneCount: number, withMusic: boolean): number {
  const storyboard = STORYBOARD_COST;
  const perImage = STORY_IMAGE_COST;
  const music = withMusic ? STORY_MUSIC_COST : 0;
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

      // Resolve the optional character before charging, so a lookup error
      // cannot strand a debit before any story work has begun.
      let characterClause = "";
      if (input.characterId) {
        const char = await getCharacter(input.characterId, ctx.user.id);
        if (char) {
          characterClause =
            ` Main character: ${char.name}. ${char.description ?? ""} ${char.styleNotes ?? ""}`.trim();
        }
      }

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

      let remainingPurchased = debit.purchasedCreditsDebited ?? 0;
      let billingWarning: string | null = null;
      const refund = async (_userId: number, amount: number, reason: string) => {
        const purchased = Math.min(amount, remainingPurchased);
        const key = debit.transactionId ? `story-refund:${debit.transactionId}:${amount}:${reason.slice(0,40)}` : null;
        try {
          if (!key || debit.purchasedCreditsDebited === undefined) throw new Error("Missing debit provenance");
          await refundCreditsVerified(ctx.user.id, amount, purchased, key, reason);
        } catch {
          billingWarning = "A credit refund could not be verified. Please contact support to review your credits.";
        }
        // Reserve provenance even if acknowledgement is ambiguous: it may
        // have committed, so it must not also fund a later music refund.
        remainingPurchased -= purchased;
      };

      // ─── Step 1: generate storyboard JSON via LLM ───────────────────
      let storyboard: any;
      try {
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
        storyboard = typeof content === "string" ? JSON.parse(content) : null;
      } catch (err) {
        // LLM step failed before anything was produced — refund the whole bundle.
        await refund(
          ctx.user.id,
          cost,
          `Refund: story creation failed — ${(err as Error)?.message ?? "storyboard generation failed"}`,
        );
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: billingWarning ?? "Storyboard generation failed" });
      }
      if (!Array.isArray(storyboard?.scenes) || !storyboard.scenes.length || storyboard.scenes.some((scene: any) => !scene || typeof scene.visual !== "string" || typeof scene.mood !== "string")) {
        // LLM returned unusable output — the user received nothing for the
        // storyboard portion, so refund the entire bundle.
        await refund(
          ctx.user.id,
          cost,
          "Refund: story creation failed — storyboard generation returned no scenes",
        );
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: billingWarning ?? "Storyboard generation failed" });
      }

      // ─── Step 2: generate one image per scene ───────────────────────
      // Sequential rather than parallel — most providers throttle and we
      // want determinism in the order returned to the user.
      const scenesWithImages: any[] = [];
      const requestedScenes = storyboard.scenes.slice(0, input.sceneCount);
      let failedImages = Math.max(0, input.sceneCount - requestedScenes.length);
      for (const scene of requestedScenes) {
        const prompt =
          `${scene.visual}. ${characterClause}. ` +
          `Style: ${input.style} cinematography, ${input.aspectRatio} aspect ratio. ` +
          `Mood: ${scene.mood}. High production value, professional composition.`;
        try {
          const { url } = await generateImage({ prompt });
          scenesWithImages.push({ ...scene, imageUrl: url ?? null });
        } catch {
          failedImages++;
          scenesWithImages.push({ ...scene, imageUrl: null });
        }
      }

      // Refund the per-scene image cost for every scene that produced no
      // image — the user paid for N scenes and got N - failedImages.
      if (failedImages > 0) {
        await refund(
          ctx.user.id,
          failedImages * STORY_IMAGE_COST,
          `Refund: ${failedImages} story scene image(s) failed to generate`,
        );
      }

      // ─── Step 3: kick off music generation async ─────────────────────
      let audioGenerationId: number | null = null;
      if (input.withMusic) {
          let insertAttempted = false;
          try {
            const db = await getDb();
            if (!db) throw new Error("Database unavailable for music");
            insertAttempted = true;
            const [inserted] = await db
              .insert(audioGenerations)
              .values({
                userId: ctx.user.id,
                type: "music",
                prompt: `${storyboard.musicMood} soundtrack for: ${storyboard.synopsis}`,
                duration: 30,
                model: "musicgen",
                status: "generating",
                metadata: { storyTitle: storyboard.title, cost: STORY_MUSIC_COST, purchasedCreditsDebited: Math.min(STORY_MUSIC_COST, remainingPurchased) },
              })
              .returning({ id: audioGenerations.id });
            audioGenerationId = inserted?.id ?? null;
            if (!audioGenerationId) throw new Error("Music job was not created");

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
                  await failLegacyJobAndRefund({ table: "audioGenerations", id: audioGenerationId, userId: ctx.user.id,
                    amount: STORY_MUSIC_COST, purchasedCredits: Math.min(STORY_MUSIC_COST, remainingPurchased), reason: "Story music failed. Credits returned." });
                }
              }
            })().catch(() => {});
          } catch (err) {
            console.error("[story] failed to kick off music gen:", err);
            if (insertAttempted) {
              // A failed acknowledgement can hide a committed music job.
              // Do not issue a second refund that could race its recovery.
              billingWarning = "The music job could not be confirmed. Please contact support to review your credits.";
            } else {
              await refund(ctx.user.id, STORY_MUSIC_COST, "Refund: story music could not be started");
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
        billingWarning,
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
