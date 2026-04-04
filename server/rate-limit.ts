/**
 * In-memory rate limiter for tRPC procedures.
 * Tracks hits per key within a sliding window and throws TOO_MANY_REQUESTS when exceeded.
 * Includes periodic cleanup to prevent memory leaks.
 */

import { TRPCError } from "@trpc/server";

interface RateLimitEntry {
  hits: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup — remove expired entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove hits older than 2 minutes (covers any reasonable window)
      entry.hits = entry.hits.filter((t) => now - t < 2 * 60 * 1000);
      if (entry.hits.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit without waiting for this timer
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

startCleanup();

/**
 * Enforce a rate limit for a given key.
 *
 * @param key      Unique identifier (e.g. `generation.create:${userId}`)
 * @param maxHits  Maximum number of requests allowed in the window
 * @param windowMs Duration of the sliding window in milliseconds
 * @param message  Optional custom error message
 *
 * @throws TRPCError with code TOO_MANY_REQUESTS when the limit is exceeded
 */
export function enforceRateLimit(
  key: string,
  maxHits: number,
  windowMs: number,
  message?: string,
): void {
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { hits: [] };
    store.set(key, entry);
  }

  // Prune hits outside the current window
  entry.hits = entry.hits.filter((t) => now - t < windowMs);

  if (entry.hits.length >= maxHits) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        message ??
        `Rate limit exceeded. Maximum ${maxHits} requests per ${Math.round(windowMs / 1000)}s.`,
    });
  }

  entry.hits.push(now);
}
