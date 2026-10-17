import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({ where: null as unknown, updates: null as unknown, rows: [] as unknown[] }));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => ({})) }));
vi.mock("drizzle-orm/neon-http", () => ({ drizzle: () => ({ update: () => ({ set: (value: unknown) => { mocks.updates = value; return { where: (predicate: unknown) => { mocks.where = predicate; return { returning: async () => mocks.rows }; } }; } }) }) }));
import { updateEditableVideoProject } from "./db";
describe("editable project persistence authorization SQL", () => {
  beforeEach(() => { vi.stubEnv("DATABASE_URL", "postgresql://fixture-only@127.0.0.1/fixture"); mocks.where = null; mocks.rows = [{ id: 77, userId: 1 }]; });
  afterEach(() => vi.unstubAllEnvs());
  it("puts project, owner-or-editor and live-owner checks in the actual UPDATE predicate", async () => {
    expect(await updateEditableVideoProject(77, 2, { title: "Saved", data: { scene: "new" } })).toEqual({ id: 77, userId: 1 });
    const query = new PgDialect().sqlToQuery(mocks.where as SQL);
    expect(query.sql).toContain('"videoProjects"."id"');
    expect(query.sql).toContain('"projectCollaborators" pc');
    expect(query.sql).toContain("pc.\"collabRole\" = 'editor'");
    expect(query.sql).toContain("owner.\"loginMethod\" IS DISTINCT FROM 'deleted'");
    expect(query.params).toContain(77); expect(query.params.filter(value => value === 2)).toHaveLength(2);
    expect(mocks.updates).toMatchObject({ title: "Saved", data: { scene: "new" }, updatedAt: expect.any(Date) });
  });
  it("returns no success object when the guarded UPDATE matches no current authority", async () => { mocks.rows = []; expect(await updateEditableVideoProject(77, 2, { title: "Rejected" })).toBeNull(); });
});
