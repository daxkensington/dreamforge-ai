/**
 * Tool Kill-Switch — runtime control over whether a paid tool is usable.
 *
 * Three states:
 *   - active   → tool works normally
 *   - degraded → tool works but UI shows "may be slow/unreliable" banner
 *   - offline  → requireToolActive() throws, blocking the generation before
 *                credits are debited
 *
 * Rows in tool_status override; absent rows default to active. Cached in
 * memory for TOOL_STATUS_TTL_MS because we hit this on every generation call.
 */
import { getDb } from "../db";
import { toolStatus, toolFailureEvents, type ToolStatus } from "../../drizzle/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

const TOOL_STATUS_TTL_MS = 30_000;

export type ToolStatusValue = "active" | "degraded" | "offline";

export interface CachedStatus {
  status: ToolStatusValue;
  message: string | null;
}

const cache = new Map<string, CachedStatus>();
let lastFullLoad = 0;
let loadingPromise: Promise<void> | null = null;

async function loadAll(): Promise<void> {
  if (Date.now() - lastFullLoad < TOOL_STATUS_TTL_MS) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const rows: ToolStatus[] = await db.select().from(toolStatus);
      cache.clear();
      for (const r of rows) {
        cache.set(r.toolId, { status: r.status, message: r.message });
      }
      lastFullLoad = Date.now();
    } catch (err: any) {
      // Table missing (migration not yet applied) or transient DB error —
      // fail open: treat everything as active. Log once.
      if (!(loadAll as any).__warned) {
        console.warn("[toolStatus] load failed, failing open:", err?.message ?? err);
        (loadAll as any).__warned = true;
      }
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

export async function getToolStatus(toolId: string): Promise<CachedStatus> {
  await loadAll();
  return cache.get(toolId) ?? { status: "active", message: null };
}

export async function getAllToolStatus(): Promise<Array<{ toolId: string } & CachedStatus>> {
  await loadAll();
  return Array.from(cache.entries()).map(([toolId, v]) => ({ toolId, ...v }));
}

/**
 * Call at the top of any generation mutation BEFORE debiting credits.
 * Throws if the tool is offline. Degraded state does not throw — callers
 * may surface a warning in the response payload.
 */
export async function requireToolActive(toolId: string): Promise<CachedStatus> {
  const s = await getToolStatus(toolId);
  if (s.status === "offline") {
    const why = s.message ? ` — ${s.message}` : "";
    throw new Error(`Tool "${toolId}" is temporarily offline${why}. No credits charged.`);
  }
  return s;
}

export async function setToolStatus(
  toolId: string,
  status: ToolStatusValue,
  message: string | null,
  userId: number | null,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(toolStatus)
    .values({
      toolId,
      status,
      message,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: toolStatus.toolId,
      set: { status, message, updatedBy: userId, updatedAt: new Date() },
    });
  cache.set(toolId, { status, message });
  lastFullLoad = Date.now();
}

export async function clearToolStatus(toolId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(toolStatus).where(eq(toolStatus.toolId, toolId));
  cache.delete(toolId);
}

export function invalidateCache() {
  lastFullLoad = 0;
  cache.clear();
}

// ─── Failure logging + auto-degrade ─────────────────────────────────────────

/**
 * Fire-and-forget log of a tool generation failure. Called from every
 * refund path. Errors are swallowed — logging MUST NOT propagate further
 * breakage up the request chain.
 */
export async function logToolFailure(input: {
  toolId: string;
  errorMessage?: string;
  provider?: string;
  userId?: number;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(toolFailureEvents).values({
      toolId: input.toolId,
      errorMessage: (input.errorMessage ?? "").slice(0, 500) || null,
      provider: input.provider ?? null,
      userId: input.userId ?? null,
    });
  } catch {
    // intentionally silent
  }
}

export interface FailureStats {
  toolId: string;
  last15m: number;
  last1h: number;
  last24h: number;
  lastError: string | null;
  lastAt: Date | null;
}

/** Aggregated failure counts per tool — for admin dashboards. */
export async function getFailureStats(): Promise<FailureStats[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const now = new Date();
    const rows = await db
      .select({
        toolId: toolFailureEvents.toolId,
        last15m: sql<number>`COUNT(*) FILTER (WHERE ${toolFailureEvents.createdAt} >= NOW() - INTERVAL '15 minutes')`,
        last1h: sql<number>`COUNT(*) FILTER (WHERE ${toolFailureEvents.createdAt} >= NOW() - INTERVAL '1 hour')`,
        last24h: sql<number>`COUNT(*) FILTER (WHERE ${toolFailureEvents.createdAt} >= NOW() - INTERVAL '24 hours')`,
        lastError: sql<string | null>`(array_agg(${toolFailureEvents.errorMessage} ORDER BY ${toolFailureEvents.createdAt} DESC))[1]`,
        lastAt: sql<Date | null>`MAX(${toolFailureEvents.createdAt})`,
      })
      .from(toolFailureEvents)
      .where(gte(toolFailureEvents.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))
      .groupBy(toolFailureEvents.toolId)
      .orderBy(desc(sql`COUNT(*) FILTER (WHERE ${toolFailureEvents.createdAt} >= NOW() - INTERVAL '15 minutes')`));
    return rows.map((r) => ({
      toolId: r.toolId,
      last15m: Number(r.last15m ?? 0),
      last1h: Number(r.last1h ?? 0),
      last24h: Number(r.last24h ?? 0),
      lastError: r.lastError,
      lastAt: r.lastAt,
    }));
  } catch {
    return [];
  }
}

const AUTO_DEGRADE_THRESHOLD = 5;
const AUTO_DEGRADE_WINDOW_MIN = 10;

/**
 * Scan recent failures and auto-flip tools with concentrated errors to
 * "degraded" state. Only promotes active → degraded; never touches offline
 * tools, and never demotes a user-set degraded state. Runs via cron.
 */
export async function runAutoDegradeScan(): Promise<{ flipped: string[] }> {
  const db = await getDb();
  if (!db) return { flipped: [] };
  const flipped: string[] = [];
  try {
    const rows = await db
      .select({
        toolId: toolFailureEvents.toolId,
        fails: sql<number>`COUNT(*)`,
      })
      .from(toolFailureEvents)
      .where(
        gte(
          toolFailureEvents.createdAt,
          new Date(Date.now() - AUTO_DEGRADE_WINDOW_MIN * 60 * 1000),
        ),
      )
      .groupBy(toolFailureEvents.toolId);

    for (const r of rows) {
      const fails = Number(r.fails ?? 0);
      if (fails < AUTO_DEGRADE_THRESHOLD) continue;
      const current = await getToolStatus(r.toolId);
      if (current.status !== "active") continue; // don't override operator state
      await setToolStatus(
        r.toolId,
        "degraded",
        `Auto-degraded: ${fails} failures in the last ${AUTO_DEGRADE_WINDOW_MIN} min.`,
        null,
      );
      flipped.push(r.toolId);
    }
  } catch (err: any) {
    console.warn("[toolStatus.autoDegrade] scan failed:", err?.message ?? err);
  }
  return { flipped };
}
