import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { analyticsEvents } from "../../drizzle/schema";
import { enforceRateLimit } from "../rate-limit";

/**
 * The funnel events worth counting. A closed list keeps junk out of the table
 * and makes the drop-off query a simple GROUP BY.
 */
export const TRACKED_EVENTS = [
  "page_view",
  "signup_started",
  "signup_completed",
  "studio_opened",
  "generation_started",
  "generation_completed",
  "paywall_viewed",
  "checkout_started",
  "checkout_completed",
] as const;

const trim = (v: string | undefined | null, max: number) =>
  v ? v.slice(0, max) : null;

export const analyticsRouter = router({
  /**
   * Record one funnel event. Public on purpose — the most important events
   * happen before a visitor has an account. Never throws to the caller: a
   * failed measurement must not break the page it is measuring.
   */
  track: publicProcedure
    .input(
      z.object({
        anonId: z.string().min(8).max(64),
        event: z.enum(TRACKED_EVENTS),
        path: z.string().max(512).optional(),
        referrer: z.string().max(512).optional(),
        utmSource: z.string().max(128).optional(),
        utmMedium: z.string().max(128).optional(),
        utmCampaign: z.string().max(128).optional(),
        props: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Generous, but enough to stop a loop or a bot filling the table.
        await enforceRateLimit(`analytics.track:${input.anonId}`, 120, 60_000);

        const db = await getDb();
        if (!db) return { ok: false };

        await db.insert(analyticsEvents).values({
          anonId: input.anonId,
          userId: ctx.user?.id ?? null,
          event: input.event,
          path: trim(input.path, 512),
          referrer: trim(input.referrer, 512),
          utmSource: trim(input.utmSource, 128),
          utmMedium: trim(input.utmMedium, 128),
          utmCampaign: trim(input.utmCampaign, 128),
          props: (input.props as any) ?? null,
        });

        return { ok: true };
      } catch {
        // Telemetry is never worth a user-visible failure.
        return { ok: false };
      }
    }),
});
