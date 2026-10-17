import { and, eq, sql } from "drizzle-orm";
import { videoProjects, projectCollaborators, users } from "../drizzle/schema";
import { getDb } from "./db";
import { emptyTimeline, timelineDocumentSchema, type TimelineDocument } from "../shared/timeline";

function sourceAccess(actorId: number, document: TimelineDocument, existing = false) {
  const urls = document.clips.map(clip => clip.sourceUrl).filter((url): url is string => Boolean(url?.startsWith("/api/media/")));
  return sql`NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(${JSON.stringify(urls)}::jsonb) source(url)
    WHERE NOT EXISTS (SELECT 1 FROM "mediaAssets" asset WHERE asset.key = substring(source.url from 12) AND asset."revokedAt" IS NULL AND asset."ownerUserId" = ${actorId})
    ${existing ? sql`AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${videoProjects.data}->'timeline'->'document'->'clips') = 'array' THEN ${videoProjects.data}->'timeline'->'document'->'clips' ELSE '[]'::jsonb END) clip WHERE clip->>'sourceUrl' = source.url)` : sql``})`;
}

const active = (id: number) => sql`EXISTS (SELECT 1 FROM ${users} actor WHERE actor.id = ${id} AND actor."loginMethod" IS DISTINCT FROM 'deleted')`;
const ownerActive = sql`EXISTS (SELECT 1 FROM ${users} owner WHERE owner.id = ${videoProjects.userId} AND owner."loginMethod" IS DISTINCT FROM 'deleted')`;
const access = (id: number, edit = false) => sql`(${videoProjects.userId} = ${id} OR EXISTS (SELECT 1 FROM ${projectCollaborators} pc WHERE pc."projectId" = ${videoProjects.id} AND pc."userId" = ${id} ${edit ? sql`AND pc."collabRole" = 'editor'` : sql``}))`;
// JSON revision is independent of legacy project editors and timestamp precision.
const revision = sql<number>`CASE WHEN (${videoProjects.data}->'timeline'->>'revision') ~ '^[0-9]{1,9}$' THEN (${videoProjects.data}->'timeline'->>'revision')::integer ELSE 0 END`;
export async function loadTimelineProject(id: number, actorId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const [row] = await db.select({ id: videoProjects.id, title: videoProjects.title, type: videoProjects.type,
    data: videoProjects.data, revision, canEdit: access(actorId, true), ownerId: videoProjects.userId })
    .from(videoProjects).where(and(eq(videoProjects.id, id), access(actorId), active(actorId), ownerActive)).limit(1);
  if (!row) return null;
  const data = row.data as Record<string, unknown>;
  const parsed = timelineDocumentSchema.safeParse((data?.timeline as { document?: unknown } | undefined)?.document);
  return { id: row.id, title: row.title, type: row.type, revision: Number(row.revision),
    canEdit: Boolean(row.canEdit), role: row.ownerId === actorId ? "owner" as const : row.canEdit ? "editor" as const : "viewer" as const,
    document: parsed.success ? parsed.data : emptyTimeline(), hasTimeline: Boolean(data?.timeline),
    invalidDocument: Boolean(data?.timeline) && !parsed.success };
}
export async function createTimelineProject(actorId: number, title: string, document: TimelineDocument) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const result = await db.execute(sql`INSERT INTO "videoProjects" ("userId", type, title, data)
    SELECT ${actorId}, 'timeline', ${title}, ${JSON.stringify({ timeline: { revision: 1, document } })}::jsonb
    WHERE ${active(actorId)} AND ${sourceAccess(actorId, document)} RETURNING id`);
  const row = result.rows[0] as { id: number } | undefined;
  if (!row) throw new Error("Media unavailable or access removed");
  return { id: row.id, revision: 1 };
}
export async function saveTimelineProject(id: number, actorId: number, expectedRevision: number, title: string, document: TimelineDocument) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const [row] = await db.update(videoProjects).set({ title, updatedAt: new Date(),
    data: sql`jsonb_set(CASE WHEN jsonb_typeof(${videoProjects.data}) = 'object' THEN ${videoProjects.data} ELSE '{}'::jsonb END, '{timeline}', ${JSON.stringify({ revision: expectedRevision + 1, document })}::jsonb, true)` })
    .where(and(eq(videoProjects.id, id), active(actorId), ownerActive, access(actorId, true), sourceAccess(actorId, document, true), sql`${revision} = ${expectedRevision}`))
    .returning({ id: videoProjects.id });
  return row ? { id: row.id, revision: expectedRevision + 1 } : null;
}

/** A reference is shareable only after save has checked ownership of newly added private sources. */
export async function canReadTimelineMedia(actorId: number, key: string) {
  const db = await getDb(); if (!db) return false;
  const rows = await db.select({ id: videoProjects.id }).from(videoProjects)
    .where(and(active(actorId), ownerActive, access(actorId), sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${videoProjects.data}->'timeline'->'document'->'clips') = 'array'
        THEN ${videoProjects.data}->'timeline'->'document'->'clips' ELSE '[]'::jsonb END) clip
      WHERE clip->>'sourceUrl' = ${`/api/media/${key}`})`)).limit(1);
  return rows.length > 0;
}
