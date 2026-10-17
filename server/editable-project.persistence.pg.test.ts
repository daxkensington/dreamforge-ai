import postgres from "postgres";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { projectCollaborators, users, videoProjects } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ neon: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: mocks.neon }));
import { updateEditableVideoProject } from "./db";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) {
  const target = new URL(testUrl);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55439" ||
    target.pathname !== "/dreamforge_billing_qa" ||
    target.username !== "dreamforge_qa"
  ) {
    throw new Error(
      "Project persistence tests require the isolated loopback fixture."
    );
  }
}

const suite = testUrl ? describe : describe.skip;
suite("editable project authorization on PostgreSQL", () => {
  const schemaName = `editable_project_qa_${process.pid}_${Date.now()}`;
  const pg = postgres(
    testUrl ??
      "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa",
    {
      max: 3,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: schemaName },
      // neon-http supplies JSON text already encoded by Drizzle. Preserve it
      // rather than letting postgres-js JSON.stringify that text a second time.
      types: {
        neonJsonb: {
          to: 3802,
          from: [3802],
          serialize: (value: unknown) =>
            typeof value === "string" ? value : JSON.stringify(value),
          parse: JSON.parse,
        },
      },
    }
  );
  const dialect = new PgDialect();
  const tables = [users, videoProjects, projectCollaborators];
  let createdSchema = false;
  const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  const literal = (value: unknown): string =>
    value === null
      ? "NULL"
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : "'" +
          (typeof value === "object"
            ? JSON.stringify(value)
            : String(value)
          ).replace(/'/g, "''") +
          "'";

  // Only the Neon transport is replaced. The actual helper, Drizzle adapter,
  // query builder, table metadata, UPDATE predicate and RETURNING all execute.
  async function wire(item: { text: string; params: any[]; options: any }) {
    const rows = await pg.unsafe(item.text, item.params);
    const columns = (rows.columns ?? []).map(column => ({
      name: column.name,
      dataTypeID: column.type,
    }));
    return {
      rows: item.options?.arrayMode
        ? rows.map(row => columns.map(column => row[column.name]))
        : [...rows],
      fields: columns,
      rowCount: rows.count,
      command: rows.command,
    };
  }
  function query(text: string, params: any[] = [], options: any = {}) {
    const item = { text, params, options };
    return {
      ...item,
      then: (resolve: any, reject: any) => wire(item).then(resolve, reject),
    };
  }
  Object.assign(query, { query });

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testUrl!);
    mocks.neon.mockReturnValue(query);
    await pg.unsafe(`CREATE SCHEMA ${quote(schemaName)}`);
    createdSchema = true;
    const enums = new Map<string, string[]>();
    for (const table of tables) {
      for (const column of getTableConfig(table).columns as any[]) {
        if (column.columnType === "PgEnumColumn") {
          enums.set(column.enum.enumName, column.enum.enumValues);
        }
      }
    }
    for (const [name, values] of enums) {
      await pg.unsafe(
        `CREATE TYPE ${quote(name)} AS ENUM (${values.map(literal).join(",")})`
      );
    }
    // Follow the current three table definitions. This focused fixture does not
    // claim migration/FK coverage; it tests the production UPDATE on real PG.
    for (const table of tables) {
      const config = getTableConfig(table);
      const columns = config.columns.map((column: any) => {
        const type =
          column.columnType === "PgEnumColumn"
            ? quote(column.enum.enumName)
            : column.getSQLType();
        let defaultSql = "";
        if (column.default !== undefined) {
          if (is(column.default, SQL)) {
            const compiled = dialect.sqlToQuery(column.default);
            defaultSql =
              " DEFAULT " +
              compiled.sql.replace(/\$(\d+)/g, (_: string, n: string) =>
                literal(compiled.params[Number(n) - 1])
              );
          } else defaultSql = " DEFAULT " + literal(column.default);
        }
        return (
          quote(column.name) +
          " " +
          type +
          defaultSql +
          (column.primary ? " PRIMARY KEY" : column.isUnique ? " UNIQUE" : "") +
          (column.notNull ? " NOT NULL" : "")
        );
      });
      await pg.unsafe(
        `CREATE TABLE ${quote(config.name)} (${columns.join(",")})`
      );
    }
  });

  beforeEach(async () => {
    await pg.unsafe(
      'TRUNCATE "projectCollaborators", "videoProjects", users RESTART IDENTITY'
    );
    await pg`INSERT INTO users (id, "openId", "loginMethod") VALUES
      (7, 'owner', 'google'), (8, 'editor', 'google'), (9, 'viewer', 'google'),
      (10, 'revoked-editor', 'google'), (11, 'other-owner', 'google')`;
    await pg`INSERT INTO "videoProjects" (id, "userId", type, title, data, "updatedAt") VALUES
      (41, 7, 'storyboard', 'Original', '{"scenes":["original"]}', '2000-01-01'),
      (42, 11, 'storyboard', 'Other project', '{}', '2000-01-01')`;
    await pg`INSERT INTO "projectCollaborators" ("projectId", "userId", "collabRole", "invitedBy") VALUES
      (41, 8, 'editor', 7), (41, 9, 'viewer', 7), (41, 10, 'editor', 7), (42, 11, 'editor', 11)`;
  });

  afterAll(async () => {
    try {
      if (createdSchema)
        await pg.unsafe(`DROP SCHEMA ${quote(schemaName)} CASCADE`);
    } finally {
      await pg.end();
      vi.unstubAllEnvs();
    }
  });

  const readProject = async () =>
    (await pg`SELECT * FROM "videoProjects" WHERE id = 41`)[0];
  async function expectDenied(actorId: number) {
    const before = await readProject();
    expect(
      await updateEditableVideoProject(41, actorId, {
        title: "Unauthorized change",
        data: { scenes: ["unauthorized"] },
      })
    ).toBeNull();
    expect(await readProject()).toEqual(before);
  }

  it.each([
    { actorId: 7, role: "owner" },
    { actorId: 8, role: "editor" },
  ])(
    "persists and returns an actual $role update without changing ownership",
    async ({ actorId, role }) => {
      const changes = {
        title: `Saved by ${role}`,
        description: "Persisted description",
        data: { scenes: [{ id: "scene-1", prompt: "updated" }] },
        thumbnailUrl: "https://example.test/thumbnail.png",
      };
      const result = await updateEditableVideoProject(41, actorId, changes);
      expect(result).toMatchObject({ id: 41, userId: 7, ...changes });
      const persisted = await readProject();
      expect(persisted).toMatchObject({ id: 41, userId: 7, ...changes });
      expect(new Date(persisted.updatedAt).getTime()).toBeGreaterThan(
        Date.UTC(2000, 0, 1)
      );
      expect(
        (await pg`SELECT title FROM "videoProjects" WHERE id = 42`)[0].title
      ).toBe("Other project");
    }
  );

  it("rejects a current viewer without touching data or updatedAt", async () => {
    await expectDenied(9);
  });

  it("rejects an editor whose grant was removed after a prior authorization read", async () => {
    expect(
      (
        await pg`SELECT "collabRole" FROM "projectCollaborators" WHERE "projectId" = 41 AND "userId" = 10`
      )[0].collabRole
    ).toBe("editor");
    await pg`DELETE FROM "projectCollaborators" WHERE "projectId" = 41 AND "userId" = 10`;
    await expectDenied(10);
  });

  it("rejects an editor downgraded to viewer after a prior authorization read", async () => {
    expect(
      (
        await pg`SELECT "collabRole" FROM "projectCollaborators" WHERE "projectId" = 41 AND "userId" = 8`
      )[0].collabRole
    ).toBe("editor");
    await pg`UPDATE "projectCollaborators" SET "collabRole" = 'viewer' WHERE "projectId" = 41 AND "userId" = 8`;
    await expectDenied(8);
  });

  it("rejects a stranger who owns and edits a different project", async () => {
    await expectDenied(11);
  });

  it.each([7, 8])(
    "rejects actor %i when the project owner was deleted",
    async actorId => {
      await pg`UPDATE users SET "loginMethod" = 'deleted' WHERE id = 7`;
      await expectDenied(actorId);
    }
  );

  it("allows an active owner with a null login method", async () => {
    await pg`UPDATE users SET "loginMethod" = NULL WHERE id = 7`;
    expect(
      await updateEditableVideoProject(41, 8, { title: "Active legacy owner" })
    ).toMatchObject({
      id: 41,
      userId: 7,
      title: "Active legacy owner",
    });
    expect((await readProject()).title).toBe("Active legacy owner");
  });
});
