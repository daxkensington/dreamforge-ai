/**
 * Public demo router — lets unauthenticated visitors generate ONE image per
 * day per IP without signing up, so the landing page can have a real
 * "try it before you buy it" CTA.
 *
 * Conversion logic — every audit-source said our paywall is opaque:
 *   - GSC shows we're search-invisible, so most arrivals are share-driven and
 *     have low intent
 *   - 100+ tools without trial = bounce
 *
 * Cost containment — bound to the cheapest fallback (Flux Schnell on RunPod
 * or Cloudflare AI, ~$0.003/image). Hard rate limit of 1/IP/day caps cost
 * exposure to a few dollars/day in the worst case.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { generateImage } from "../_core/imageGeneration";
import { enforceIpRateLimit } from "../rate-limit";
import { requireToolActive } from "../_core/toolStatus";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const demoRouter = router({
  /**
   * One image per IP per 24h. No auth, no credits.
   * Quietly forces cheap providers to keep cost bounded.
   */
  generate: publicProcedure
    .input(
      z.object({
        prompt: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tool kill-switch — same gate paid generations honor.
      await requireToolActive("text-to-image");

      // Hard cap: 1 generation / 24h / IP. If we can't read IP, deny rather
      // than serve unlimited free generations to a single bad actor.
      if (!ctx.ip) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not determine your IP. Please sign up for a free account to continue.",
        });
      }

      await enforceIpRateLimit(
        "demo.generate",
        ctx.ip,
        1,
        ONE_DAY_MS,
        "You've used your free demo generation for today. Sign up free to continue creating.",
      );

      try {
        // model: "auto" enters the fallback chain (Cloudflare → RunPod
        // Schnell → Grok → Replicate Schnell → ...). The cheap providers
        // win first; cost stays in the fractions-of-a-cent range.
        const result = await generateImage({
          prompt: input.prompt,
          model: "auto",
          size: "1024x1024",
        });
        return {
          status: "completed" as const,
          url: result.url,
          prompt: input.prompt,
        };
      } catch (err: any) {
        return {
          status: "failed" as const,
          error: err?.message ?? "Generation failed. Please try again.",
        };
      }
    }),
});
