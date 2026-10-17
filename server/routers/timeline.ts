import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createTimelineProject, loadTimelineProject, saveTimelineProject } from "../dbTimeline";
import { timelineDocumentSchema } from "../../shared/timeline";

export const timelineRouter = router({
  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const project = await loadTimelineProject(input.id, ctx.user.id);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project unavailable or access removed" });
    return project;
  }),
  save: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(),
    expectedRevision: z.number().int().min(0).max(999999998), title: z.string().trim().min(1).max(256), document: timelineDocumentSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!input.id) return createTimelineProject(ctx.user.id, input.title, input.document);
      const saved = await saveTimelineProject(input.id, ctx.user.id, input.expectedRevision, input.title, input.document);
      if (saved) return saved;
      const current = await loadTimelineProject(input.id, ctx.user.id);
      if (!current?.canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "Editing access has been removed" });
      if (current.revision === input.expectedRevision) throw new TRPCError({ code: "BAD_REQUEST", message: "A private media source is unavailable or belongs to another account. Upload your own media before saving." });
      throw new TRPCError({ code: "CONFLICT", message: "Another edit was saved. Download your timeline backup, then reload the latest project before saving." });
    }),
});
