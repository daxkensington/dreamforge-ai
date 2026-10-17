import { TRPCError } from "@trpc/server";
import { assertPrivateStorage } from "../_core/privateStorage";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  completeMediaUpload,
  createMediaUpload,
  mediaUploadInput,
} from "../_core/mediaUpload";
import { enforceRateLimit } from "../rate-limit";
export const mediaRouter = router({
  createUpload: protectedProcedure
    .input(mediaUploadInput)
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(`media.create:${ctx.user.id}`, 30, 3_600_000);
      try {
        await assertPrivateStorage();
      } catch {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message:
            "Private uploads are temporarily unavailable. No file was uploaded.",
        });
      }
      return createMediaUpload(ctx.user.id, input);
    }),
  completeUpload: protectedProcedure
    .input(z.object({ uploadId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      completeMediaUpload(ctx.user.id, input.uploadId)
    ),
});
