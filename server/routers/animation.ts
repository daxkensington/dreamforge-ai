import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { enforceRateLimit } from "../rate-limit";
import { ENV } from "../_core/env";
import { privateStorageAvailable } from "../_core/privateStorage";
import { IMAGE_ANIMATION_POLICY } from "../../shared/imageAnimation";
import {
  imageAnimationService,
  registerUploadedAnimationSource,
} from "../_core/imageAnimation";

export const animationRouter = router({
  policy: publicProcedure.query(async () => ({
    ...IMAGE_ANIMATION_POLICY,
    isConfigured: !!ENV.falApiKey && (await privateStorageAvailable()),
  })),
  importSource: protectedProcedure
    .input(z.object({ key: z.string().min(1).max(1024) }))
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        `animation:import:${ctx.user.id}`,
        12,
        3_600_000,
        "Image imports are limited to 12 per hour."
      );
      return registerUploadedAnimationSource(ctx.user.id, input.key);
    }),
  start: protectedProcedure
    .input(
      z.object({
        requestId: z
          .string()
          .uuid()
          .transform(value => value.toLowerCase()),
        generationId: z.number().int().positive(),
        prompt: z.string().trim().min(3).max(1000),
        expectedCreditCost: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        `animation:start:${ctx.user.id}`,
        10,
        60_000,
        "Please wait before starting another animation."
      );
      return imageAnimationService.start(ctx.user.id, input);
    }),
  status: protectedProcedure
    .input(
      z.object({
        requestId: z
          .string()
          .uuid()
          .transform(value => value.toLowerCase()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        `animation:status:${ctx.user.id}`,
        30,
        60_000,
        "Please wait before checking this animation again."
      );
      return imageAnimationService.status(ctx.user.id, input.requestId);
    }),
});
