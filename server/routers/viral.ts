/**
 * Viral preset router — branded landing pages for the trends actually moving
 * volume on TikTok / IG / X (per the keyword-research workstream of the
 * Phase 39 audit). Each preset wraps the same img2img backend with curated
 * prompt augmentation, packaged behind a memorable URL.
 *
 * Strategy: cheap to ship (zero new infra), high SEO leverage (each preset
 * is a top-volume long-tail query), and the outputs are shareable enough
 * to land on social — which in turn becomes inbound traffic via the
 * /g/[id] share route shipped in T1.3.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { generateImage } from "../_core/imageGeneration";
import { requireToolActive } from "../_core/toolStatus";
import { deductCredits, CREDIT_COSTS } from "../stripe";

// Preset name → { creditTool, prompt-augmentation }.
// `creditTool` lookups go through TOOL_CREDIT_COSTS so the user-facing
// CreditCostBadge shows the right number.
const PRESETS = {
  "action-figure": {
    creditTool: "tshirt-design", // reuse existing 10-credit cost band
    label: "AI Action Figure",
    promptTemplate: (subject: string) =>
      `Transform the subject from the reference photo into a 6-inch articulated collectible action figure inside transparent plastic blister-pack toy packaging on a white cardboard backer. ${subject ? `Character details: ${subject}. ` : ""}Include a printed character name banner at the top, fictional accessories laid out around the figure (in their own molded blister bays), and small printed character stats on the cardboard. Photorealistic product shot, soft studio lighting, slight reflections on the plastic blister, shot on white background, looks like a real Hasbro / Funko / Marvel Legends boxed toy. Centered composition.`,
  },
  "funko-pop": {
    creditTool: "tshirt-design",
    label: "AI Funko Pop",
    promptTemplate: (subject: string) =>
      `Transform the subject from the reference photo into a Funko Pop! style vinyl figurine — oversized round head, tiny body, large solid black eyes, simplified colors, classic Funko Pop proportions. ${subject ? `Character details: ${subject}. ` : ""}Display the figure inside its iconic Funko Pop window box packaging with a recognizable character-name label at the top, the character number printed in the corner, and the signature Funko aesthetic. Photorealistic product shot, soft studio lighting, slight reflection on the cellophane window, shot on neutral background.`,
  },
  "chibi-figure": {
    creditTool: "tshirt-design",
    label: "AI Chibi Figure",
    promptTemplate: (subject: string) =>
      `Transform the subject from the reference photo into an adorable 3D chibi-style collectible figurine — oversized cute head (about 60% of total height), small rounded body, big sparkly anime eyes, soft pastel anime colors, gentle smile. ${subject ? `Character details: ${subject}. ` : ""}Display on a clean glossy display base. Studio product photography, soft pink/cream gradient backdrop, soft rim lighting, looks like a high-end PVC anime figure from Good Smile Company.`,
  },
  "lego-mini": {
    creditTool: "tshirt-design",
    label: "AI Lego Mini",
    promptTemplate: (subject: string) =>
      `Transform the subject from the reference photo into a LEGO minifigure — classic blocky LEGO body proportions, rectangular torso, cylindrical head with painted face, claw hands, ABS plastic shine. ${subject ? `Character details: ${subject}. ` : ""}The minifigure stands on a small green LEGO baseplate. Photorealistic product photography, soft studio lighting on white background, slight reflections on the glossy plastic, looks like an authentic LEGO promotional product shot.`,
  },
  "pet-to-person": {
    creditTool: "headshot",
    label: "AI Pet-to-Person",
    promptTemplate: (subject: string) =>
      `Imagine the pet from the reference photo as a human person — translate their species traits into matching human features (a fluffy golden retriever becomes a warm blonde person with kind smile, a sleek black cat becomes a sharp dark-haired person with green eyes, etc.). Keep the personality, color palette, and energy of the pet but render as a photorealistic human portrait. ${subject ? `Additional notes: ${subject}. ` : ""}Professional editorial portrait photography, natural lighting, neutral studio background, shoulders-up framing, looks like a real person photo.`,
  },
} as const;

type PresetKey = keyof typeof PRESETS;

export const viralRouter = router({
  /**
   * Single mutation that powers all viral preset tools — switch on `preset`,
   * deduct via the preset's credit tool, then run img2img with the preset's
   * prompt template applied to the user's photo + optional custom note.
   */
  transform: protectedProcedure
    .input(
      z.object({
        preset: z.enum([
          "action-figure",
          "funko-pop",
          "chibi-figure",
          "lego-mini",
          "pet-to-person",
        ]),
        imageUrl: z.string().url().max(2048),
        // Optional creative note — appended to the preset prompt so users
        // can specify hair color, accessories, name banner text, etc.
        note: z.string().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const preset = PRESETS[input.preset as PresetKey];
      await requireToolActive(preset.creditTool);

      const cost = CREDIT_COSTS[preset.creditTool] ?? 10;
      const result = await deductCredits(
        ctx.user.id,
        cost,
        `${preset.label} (${input.preset})`,
      );
      if (!result.success) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: `Insufficient credits. ${preset.label} costs ${cost} — you have ${result.balance}.`,
        });
      }

      const prompt = preset.promptTemplate((input.note ?? "").trim());
      try {
        const { url } = await generateImage({
          prompt,
          originalImages: [{ url: input.imageUrl, mimeType: "image/png" }],
        });
        return { url, status: "completed" as const, preset: input.preset };
      } catch (error: any) {
        return {
          url: null,
          status: "failed" as const,
          error: error?.message ?? "Generation failed",
        };
      }
    }),
});
