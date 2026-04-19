/**
 * Postgres-backed rate limiter for tRPC procedures.
 *
 * Replaces the previous in-memory limiter, which was effectively a no-op on
 * Vercel serverless: every cold start spawned a new process with an empty
 * Map, so attackers (or buggy clients) could simply trigger cold starts to
 * reset their counters. This implementation persists hits to the
 * `rate_limit_hits` table and counts within a sliding window.
 *
 * Single round-trip per call via a CTE that:
 *   1. counts existing hits in the window
 *   2. inserts a new hit ONLY if under the limit
 *   3. returns the current count + whether the call was allowed
 *
 * Failure mode: if the DB is unavailable, the limiter fails OPEN (allows
 * the request) and logs a warning. The reasoning is that rejecting legit
 * traffic during a brief DB hiccup hurts more than letting through a few
 * extra requests during the same window.
 */

import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * Enforce a rate limit for a given key.
 *
 * @param key      Unique identifier (e.g. `"generation.create:user:42"`)
 * @param maxHits  Max requests allowed in the window
 * @param windowMs Sliding window size in milliseconds
 * @param message  Optional custom error message
 *
 * @throws TRPCError(TOO_MANY_REQUESTS) when over the limit
 */
export async function enforceRateLimit(
  key: string,
  maxHits: number,
  windowMs: number,
  message?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    // No DB → fail open. Caller continues. Logged once per call so it's
    // visible during outages without spamming.
    console.warn("[rate-limit] DB unavailable, failing open for key:", key);
    return;
  }

  const intervalSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    // CTE: count, conditionally insert, return both. One round-trip.
    const result: any = await db.execute(sql`
      WITH counted AS (
        SELECT COUNT(*)::int AS hits
        FROM rate_limit_hits
        WHERE key = ${key}
          AND ts > NOW() - (${intervalSeconds}::int * INTERVAL '1 second')
      ),
      inserted AS (
        INSERT INTO rate_limit_hits (key)
        SELECT ${key}
        WHERE (SELECT hits FROM counted) < ${maxHits}
        RETURNING 1
      )
      SELECT
        (SELECT hits FROM counted) AS current_hits,
        EXISTS(SELECT 1 FROM inserted) AS allowed
    `);

    // Drizzle's neon adapter returns { rows: [...] }; the http adapter
    // sometimes returns the array directly. Handle both.
    const row = (result.rows ?? result)[0] as
      | { current_hits: number; allowed: boolean }
      | undefined;

    if (!row?.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          message ??
          `Rate limit exceeded. Maximum ${maxHits} requests per ${Math.round(windowMs / 1000)}s.`,
      });
    }
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    // DB error → fail open + log. Don't block legit users on infra blips.
    console.warn("[rate-limit] DB error, failing open for key:", key, err);
  }
}

/**
 * Convenience wrapper for keying by user ID.
 */
export async function enforceUserRateLimit(
  procedureName: string,
  userId: number | string,
  maxHits: number,
  windowMs: number,
  message?: string,
): Promise<void> {
  return enforceRateLimit(
    `${procedureName}:user:${userId}`,
    maxHits,
    windowMs,
    message,
  );
}

/**
 * Convenience wrapper for keying by IP address. Used as a pre-filter for
 * abuse from many accounts behind the same IP.
 */
export async function enforceIpRateLimit(
  procedureName: string,
  ip: string,
  maxHits: number,
  windowMs: number,
  message?: string,
): Promise<void> {
  return enforceRateLimit(
    `${procedureName}:ip:${ip}`,
    maxHits,
    windowMs,
    message,
  );
}
