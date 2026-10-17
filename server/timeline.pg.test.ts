import postgres from "postgres";
import { drizzle } from "drizzle-orm/neon-http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: null as any }));
vi.mock("./db", () => ({ getDb: async () => mocks.db }));
import { canReadTimelineMedia, createTimelineProject, loadTimelineProject, saveTimelineProject } from "./dbTimeline";
import { timelineRouter } from "./routers/timeline";
import { emptyTimeline, type TimelineDocument } from "../shared/timeline";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) { const url = new URL(testUrl); if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/dreamforge_billing_qa" || url.username !== "dreamforge_qa") throw new Error("Timeline tests require the owned local PostgreSQL fixture"); }
const suite = testUrl ? describe : describe.skip;
suite("timeline actual persistence, permissions, concurrency and private media on PostgreSQL", () => {
  const pg = postgres(testUrl ?? "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa", { max: 12, prepare: false, onnotice: () => {}, connection: { search_path: "timeline_tools_qa" },
    // neon-http receives already serialized JSON strings from Drizzle. Preserve
    // those bytes rather than letting postgres-js JSON.stringify them twice.
    types: { neonJson: { to: 3802, from: [114, 3802], serialize: value => typeof value === "string" ? value : JSON.stringify(value), parse: JSON.parse } } });
  function query(text: string, params: any[] = [], options: any = {}) {
    return { then: (resolve: any, reject: any) => pg.unsafe(text, params).then(rows => {
      const columns = rows.columns.map((column: any) => ({ name: column.name, dataTypeID: column.type }));
      return { rows: options.arrayMode ? rows.map(row => columns.map(c => row[c.name])) : [...rows], fields: columns, rowCount: rows.count };
    }).then(resolve, reject) };
  }
  const doc = (url?: string): TimelineDocument => ({ ...emptyTimeline(), clips: url ? [{ id: "asset", trackId: "video-1", type: "video", mediaKind: "image", sourceUrl: url, startTime: 0, duration: 2 }] : [] });
  beforeAll(async () => {
    await pg.unsafe("CREATE SCHEMA timeline_tools_qa");
    await pg.unsafe(`CREATE TABLE users (id integer PRIMARY KEY, "loginMethod" text);
      CREATE TABLE "videoProjects" (id serial PRIMARY KEY, "userId" integer NOT NULL REFERENCES users(id), type text NOT NULL, title text NOT NULL, data jsonb NOT NULL, "updatedAt" timestamp DEFAULT now());
      CREATE TABLE "projectCollaborators" ("projectId" integer NOT NULL, "userId" integer NOT NULL, "collabRole" text NOT NULL);
      CREATE TABLE "mediaAssets" (key text PRIMARY KEY, "ownerUserId" integer, "revokedAt" timestamp);`).simple();
    Object.assign(query, { query }); mocks.db = drizzle(query as any);
  });
  beforeEach(async () => {
    await pg.unsafe('TRUNCATE "videoProjects", "projectCollaborators", "mediaAssets", users RESTART IDENTITY CASCADE');
    await pg`INSERT INTO users VALUES (1,'google'),(2,'google'),(3,'google'),(4,'google'),(5,'deleted')`;
    await pg`INSERT INTO "mediaAssets" VALUES ('timeline/owner.png',1,NULL),('timeline/editor.png',2,NULL),('timeline/foreign.png',4,NULL),('timeline/revoked.png',1,now())`;
  });
  afterAll(async () => { await pg.unsafe('DROP SCHEMA timeline_tools_qa CASCADE'); await pg.end(); });
  async function collaborativeProject() {
    const result = await createTimelineProject(1, "Original", doc("/api/media/timeline/owner.png"));
    await pg`INSERT INTO "projectCollaborators" VALUES (${result.id},2,'editor'),(${result.id},3,'viewer')`;
    return result;
  }
  it("creates blank real projects and persists owner/editor edits without changing original project data or type", async () => {
    const { id } = await collaborativeProject();
    await pg`UPDATE "videoProjects" SET type='storyboard', data=data || '{"scenes":[{"privatePrompt":"retain original"}],"other":42}'::jsonb WHERE id=${id}`;
    expect((await loadTimelineProject(id, 1))?.role).toBe("owner");
    expect((await loadTimelineProject(id, 2))?.role).toBe("editor");
    expect((await loadTimelineProject(id, 3))?.canEdit).toBe(false);
    expect(await loadTimelineProject(id, 4)).toBeNull();
    const next = doc("/api/media/timeline/editor.png");
    expect(await saveTimelineProject(id, 2, 1, "Editor saved", next)).toEqual({ id, revision: 2 });
    const [stored] = await pg`SELECT * FROM "videoProjects" WHERE id=${id}`;
    expect(stored).toMatchObject({ title: "Editor saved", type: "storyboard", data: { scenes: [{ privatePrompt: "retain original" }], other: 42, timeline: { revision: 2, document: next } } });
    expect((await loadTimelineProject(id, 1))?.document).toEqual(next);
  });
  it("rejects viewer and stranger writes and grants no source data on unauthorized loads", async () => {
    const { id } = await collaborativeProject();
    expect(await saveTimelineProject(id, 3, 1, "viewer", doc())).toBeNull();
    expect(await saveTimelineProject(id, 4, 1, "stranger", doc())).toBeNull();
    await expect(timelineRouter.createCaller({ user: { id: 3, loginMethod: "google" } } as any).save({ id, expectedRevision: 1, title: "viewer", document: doc() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(timelineRouter.createCaller({ user: { id: 4, loginMethod: "google" } } as any).get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("allows exactly one concurrent save of the same revision, and reports conflicts without overwriting", async () => {
    const { id } = await collaborativeProject();
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => saveTimelineProject(id, index % 2 ? 2 : 1, 1, `Edit ${index}`, doc())));
    expect(results.filter(Boolean)).toHaveLength(1); expect((await loadTimelineProject(id, 1))?.revision).toBe(2);
    await expect(timelineRouter.createCaller({ user: { id: 1, loginMethod: "google" } } as any).save({ id, expectedRevision: 1, title: "Stale", document: doc() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("permits only owned new private media and intentional existing project shares", async () => {
    const { id } = await collaborativeProject();
    expect(await canReadTimelineMedia(2, "timeline/owner.png")).toBe(true);
    expect(await canReadTimelineMedia(3, "timeline/owner.png")).toBe(true);
    expect(await canReadTimelineMedia(4, "timeline/owner.png")).toBe(false);
    expect(await canReadTimelineMedia(2, "timeline/foreign.png")).toBe(false);
    expect(await saveTimelineProject(id, 2, 1, "Guessed key", doc("/api/media/timeline/foreign.png"))).toBeNull();
    expect(await canReadTimelineMedia(2, "timeline/foreign.png")).toBe(false);
    expect(await saveTimelineProject(id, 2, 1, "Keep shared source", doc("/api/media/timeline/owner.png"))).toEqual({ id, revision: 2 });
    await expect(createTimelineProject(2, "Stolen", doc("/api/media/timeline/foreign.png"))).rejects.toThrow("Media unavailable");
    await expect(createTimelineProject(1, "Revoked", doc("/api/media/timeline/revoked.png"))).rejects.toThrow("Media unavailable");
  });
  it("rechecks revoked collaboration and deleted identities in the persistence statement", async () => {
    const { id } = await collaborativeProject();
    await pg`DELETE FROM "projectCollaborators" WHERE "userId"=2`;
    expect(await saveTimelineProject(id, 2, 1, "Late editor", doc())).toBeNull();
    expect(await canReadTimelineMedia(2, "timeline/owner.png")).toBe(false);
    await pg`UPDATE users SET "loginMethod"='deleted' WHERE id=1`;
    expect(await loadTimelineProject(id, 3)).toBeNull();
    expect(await saveTimelineProject(id, 1, 1, "Deleted owner", doc())).toBeNull();
    await expect(createTimelineProject(5, "Deleted", doc())).rejects.toThrow();
  });
});
