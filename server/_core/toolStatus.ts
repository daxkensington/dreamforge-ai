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
import { toolStatus, type ToolStatus } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
