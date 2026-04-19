/**
 * Newsletter subscribe endpoint. Was a UI-only stub in Footer.tsx; now
 * actually persists emails to newsletter_signups so Stay-Updated means
 * something.
 *
 * Rate-limited per IP to prevent someone pasting the subscribe URL into
 * a script and filling the list with junk. Quiet on duplicate email
 * (ON CONFLICT DO NOTHING) so existing subscribers see the same success
 * state instead of an error.
 */
import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { enforceIpRateLimit } from "../rate-limit";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email().max(320),
        source: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Soft limit: 5 signups per IP per day. Prevents list-stuffing
      // without annoying a family/office that shares an outbound IP.
      if (ctx.ip) {
        await enforceIpRateLimit(
          "newsletter.subscribe",
          ctx.ip,
          5,
          ONE_DAY_MS,
          "You've signed up enough for today — try again tomorrow.",
        );
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Subscription service temporarily unavailable.",
        });
      }

      const email = input.email.toLowerCase().trim();
      await db.execute(sql`
        INSERT INTO newsletter_signups (email, ip, source)
        VALUES (${email}, ${ctx.ip ?? null}, ${input.source ?? "footer"})
        ON CONFLICT (email) DO NOTHING
      `);

      return { success: true };
    }),
});
