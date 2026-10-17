import { createHash } from "node:crypto";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { enforceRateLimit } from "../rate-limit";
import { requireToolActive } from "../_core/toolStatus";
import { normalizeStorageKey } from "../_core/mediaLifecycle";
import * as jobs from "../dbTraining";
import {
  cancelOwnedTraining,
  getOwnedModelDownload,
  prepareOwnedTraining,
  publicTrainingJob,
  recoverOwnedTrainingImage,
  refreshOwnedTraining,
  submitOwnedTraining,
  trainingProviderAvailable,
} from "../_core/modelTraining";
import { getTrainingCredits, TRAINING_POLICY } from "../../shared/training";
import { privateStorageAvailable } from "../_core/privateStorage";

const idSchema = z.object({ id: z.number().int().positive() });
const createSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(128),
  type: z.enum(["face", "style", "product", "object"]),
  triggerWord: z
    .string()
    .regex(
      /^[A-Za-z][A-Za-z0-9_]{2,31}$/,
      "Use 3–32 letters, digits or underscores, starting with a letter."
    ),
  steps: z.union([z.literal(800), z.literal(1200)]),
  imageKeys: z.array(z.string().min(1).max(1024)).min(5).max(20),
});

export const trainingRouter = router({
  policy: protectedProcedure.query(async ({ ctx }) => ({
    ...TRAINING_POLICY,
    eligible: await jobs.isTrainingEligible(ctx.user.id),
    providerAvailable:
      trainingProviderAvailable() && (await privateStorageAvailable()),
    explanation:
      "Agency includes three saved custom model slots. Each training run costs credits separately. Keep permission to use every uploaded image.",
  })),
  list: protectedProcedure.query(async ({ ctx }) =>
    (await jobs.listTrainingJobs(ctx.user.id)).map(publicTrainingJob)
  ),
  imageStatus: protectedProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        `training.imageStatus:user:${ctx.user.id}`,
        120,
        60_000
      );
      return recoverOwnedTrainingImage(ctx.user.id, input.requestId);
    }),
  discardImages: protectedProcedure
    .input(
      z.object({
        imageKeys: z.array(z.string().min(1).max(1024)).min(1).max(20),
      })
    )
    .mutation(({ ctx, input }) =>
      jobs.discardTrainingImages(
        ctx.user.id,
        input.imageKeys.map(normalizeStorageKey)
      )
    ),
  create: protectedProcedure
    .input(createSchema)
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("model-training");
      await enforceRateLimit(
        `training.create:user:${ctx.user.id}`,
        12,
        3600_000
      );
      const imageKeys = input.imageKeys.map(normalizeStorageKey);
      const payload = {
        name: input.name,
        type: input.type,
        triggerWord: input.triggerWord,
        steps: input.steps,
        imageKeys,
      };
      const payloadHash = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      return publicTrainingJob(
        await jobs.createTrainingJob(ctx.user.id, {
          ...payload,
          requestId: input.requestId,
          payloadHash,
        })
      );
    }),
  prepare: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("model-training");
      await enforceRateLimit(
        `training.prepare:user:${ctx.user.id}`,
        12,
        3600_000
      );
      return prepareOwnedTraining(ctx.user.id, input.id);
    }),
  submit: protectedProcedure
    .input(idSchema.extend({ quotedCredits: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireToolActive("model-training");
      await enforceRateLimit(
        `training.submit:user:${ctx.user.id}`,
        12,
        3600_000
      );
      const job = await jobs.getTrainingJob(ctx.user.id, input.id);
      if (!job) throw new Error("Training job not found.");
      if (
        input.quotedCredits !== getTrainingCredits(job.steps) ||
        Number(job.quotedCredits) !== input.quotedCredits
      )
        throw new Error(
          "The training quote changed. Review it before starting."
        );
      return submitOwnedTraining(ctx.user.id, input.id);
    }),
  refresh: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      await enforceRateLimit(
        `training.refresh:user:${ctx.user.id}`,
        120,
        60_000
      );
      return refreshOwnedTraining(ctx.user.id, input.id);
    }),
  cancel: protectedProcedure
    .input(idSchema)
    .mutation(({ ctx, input }) => cancelOwnedTraining(ctx.user.id, input.id)),
  download: protectedProcedure
    .input(idSchema)
    .mutation(({ ctx, input }) => getOwnedModelDownload(ctx.user.id, input.id)),
  delete: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      const job = await jobs.getTrainingJob(ctx.user.id, input.id);
      if (!job) return { deleted: true };
      if (
        [
          "submitting",
          "queued",
          "training",
          "cancel_requested",
          "reconciliation",
        ].includes(job.state)
      )
        throw new Error(
          "Resolve or finish this training request before deleting it. You can request cancellation."
        );
      if (await jobs.hasPendingTrainingImages(ctx.user.id, input.id))
        throw new Error(
          "Finish the images currently using this model before deleting it."
        );
      await jobs.deleteTrainingJob(ctx.user.id, input.id);
      return { deleted: true };
    }),
});
