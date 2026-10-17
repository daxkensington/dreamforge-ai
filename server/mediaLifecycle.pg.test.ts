import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  neon: vi.fn(),
  send: vi.fn(),
  cancel: vi.fn(),
  afterStatement: null as null | ((text: string) => Promise<void>),
}));
vi.mock("@neondatabase/serverless", () => ({ neon: mocks.neon }));
vi.mock("./stripe", () => ({
  cancelStripeSubscriptionsForCustomer: mocks.cancel,
}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send(command: any) {
      return mocks.send(command);
    }
  },
  PutObjectCommand: class {
    operation = "put";
    constructor(public input: any) {}
  },
  GetObjectCommand: class {
    operation = "get";
    constructor(public input: any) {}
  },
  DeleteObjectCommand: class {
    operation = "delete";
    constructor(public input: any) {}
  },
}));
import { deleteUserAccount } from "./_core/deleteAccount";
import {
  confirmMediaUpload,
  isMediaRevoked,
  purgeRevokedMedia,
  registerMediaAsset,
  revokeMediaUrls,
} from "./_core/mediaLifecycle";
import { withStorageOwner } from "./_core/storageContext";
import { storagePut } from "./storage";
import { createUserForAuthIdentity, hasAuthIdentity } from "./db";
import { GET as imageGet } from "../app/img/[...key]/route";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) {
  const target = new URL(testUrl);
  if (
    target.hostname !== "127.0.0.1" ||
    target.port !== "55439" ||
    target.pathname !== "/dreamforge_billing_qa" ||
    target.username !== "dreamforge_qa"
  )
    throw new Error("Media tests require the isolated loopback fixture.");
}
const suite = testUrl ? describe : describe.skip;
suite("media lifecycle and account deletion on PostgreSQL", () => {
  const pg = postgres(
    testUrl ??
      "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa",
    {
      max: 12,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: "media_security_qa" },
    }
  );
  const dialect = new PgDialect();
  const objects = new Map<string, Buffer>();
  let failDelete = false;
  const tables = Object.values(schema).filter(
    value => is(value, PgTable) && getTableConfig(value).name !== "mediaAssets"
  ) as PgTable[];
  const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  const literal = (value: any): string =>
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

  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(r => {
      resolve = r;
    });
    return { promise, resolve };
  }
  async function wire(tx: any, item: any) {
    const rows = await tx.unsafe(item.text, item.params);
    const columns = (rows.columns ?? []).map((column: any) => ({
      name: column.name,
      dataTypeID: column.type,
    }));
    return {
      rows: item.options?.arrayMode
        ? rows.map((row: any) => columns.map((c: any) => row[c.name]))
        : [...rows],
      fields: columns,
      rowCount: rows.count,
      command: rows.command,
    };
  }
  // Real Drizzle neon-http adapter, backed only by the owned local PG socket.
  function query(text: string, params: any[] = [], options: any = {}) {
    const item: any = {
      text,
      params,
      options,
      then: (resolve: any, reject: any) => wire(pg, item).then(resolve, reject),
    };
    return item;
  }
  Object.assign(query, {
    query,
    transaction: (items: any[]) =>
      pg.begin(async tx => {
        const results = [];
        for (const item of items) {
          results.push(await wire(tx, item));
          if (mocks.afterStatement) await mocks.afterStatement(item.text);
        }
        return results;
      }),
  });

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testUrl!);
    vi.stubEnv("R2_PUBLIC_URL", "https://dreamforgex.ai/img");
    mocks.neon.mockReturnValue(query);
    await pg.unsafe("CREATE SCHEMA media_security_qa");
    for (const value of Object.values(schema)) {
      if (
        typeof value === "function" &&
        "enumValues" in value &&
        "enumName" in value
      ) {
        const enumeration = value as any;
        await pg.unsafe(
          `CREATE TYPE ${quote(enumeration.enumName)} AS ENUM (${enumeration.enumValues.map(literal).join(",")})`
        );
      }
    }
    // Fixture tables follow actual schema column names/types/defaults. The
    // migration under test supplies real registry constraints and all fences.
    for (const table of tables) {
      const config = getTableConfig(table);
      const columns = config.columns.map((column: any) => {
        const type =
          column.columnType === "PgEnumColumn"
            ? quote(column.enum.enumName)
            : column.getSQLType();
        let def = "";
        if (column.default !== undefined) {
          if (is(column.default, SQL)) {
            const compiled = dialect.sqlToQuery(column.default);
            def =
              " DEFAULT " +
              compiled.sql.replace(/\$(\d+)/g, (_: string, n: string) =>
                literal(compiled.params[Number(n) - 1])
              );
          } else def = " DEFAULT " + literal(column.default);
        }
        return (
          quote(column.name) +
          " " +
          type +
          def +
          (column.primary ? " PRIMARY KEY" : column.isUnique ? " UNIQUE" : "") +
          (column.notNull ? " NOT NULL" : "")
        );
      });
      await pg.unsafe(
        `CREATE TABLE ${quote(config.name)} (${columns.join(",")})`
      );
    }
    const foreignKeys = await readFile(
      new URL("../drizzle/0013_foreign_keys_not_valid.sql", import.meta.url),
      "utf8"
    );
    for (const statement of foreignKeys.split("--> statement-breakpoint"))
      await pg.unsafe(statement).simple();
    const migration = await readFile(
      new URL("../drizzle/0016_media_revocation.sql", import.meta.url),
      "utf8"
    );
    for (const statement of migration.split("--> statement-breakpoint"))
      await pg.unsafe(statement).simple();
  }, 30000);

  beforeEach(async () => {
    mocks.afterStatement = null;
    mocks.cancel.mockReset().mockResolvedValue(undefined);
    mocks.send.mockReset();
    objects.clear();
    failDelete = false;
    await pg.unsafe(
      `TRUNCATE ${[...tables.map(t => quote(getTableConfig(t).name)), '"mediaAssets"'].join(",")} RESTART IDENTITY CASCADE`
    );
    await pg`INSERT INTO users (id,"openId",name,email,"loginMethod") VALUES (7,'auth-owner','Owner','owner@example.test','google'), (8,'auth-other','Other','other@example.test','google')`;
    await pg`INSERT INTO auth_users (id,email) VALUES ('auth-owner','owner@example.test'),('auth-other','other@example.test')`;
    await pg`INSERT INTO "creditBalances" ("userId",balance,"stripeCustomerId") VALUES (7,50,'cus_fixture')`;
    mocks.send.mockImplementation(async command => {
      const key = command.input.Key;
      if (command.operation === "put") {
        objects.set(key, Buffer.from(command.input.Body));
        return {};
      }
      if (command.operation === "delete") {
        if (failDelete) throw new Error("Fixture storage outage");
        objects.delete(key);
        return {};
      }
      const bytes = objects.get(key);
      if (!bytes)
        throw Object.assign(new Error("missing"), { name: "NoSuchKey" });
      return {
        ContentType: "image/png",
        Body: { transformToByteArray: async () => bytes },
      };
    });
  });
  afterAll(async () => {
    mocks.afterStatement = null;
    await pg.unsafe("DROP SCHEMA IF EXISTS media_security_qa CASCADE");
    await pg.end();
    vi.unstubAllEnvs();
  });

  async function seedContent() {
    await withStorageOwner(7, () =>
      storagePut("private/owned.png", Buffer.from("PRIVATE"), "image/png")
    );
    await withStorageOwner(8, () =>
      storagePut("private/other.png", Buffer.from("OTHER"), "image/png")
    );
    await pg`INSERT INTO generations (id,"userId",prompt,"imageUrl","fileKey",status) VALUES (70,7,'private prompt','https://dreamforgex.ai/img/private/owned.png','private/owned.png','completed'),(80,8,'other prompt','https://dreamforgex.ai/img/private/other.png','private/other.png','completed')`;
    await pg`INSERT INTO "videoProjects" (id,"userId",type,title,data) VALUES (41,7,'storyboard','private project','{}'),(42,8,'storyboard','other project','{}')`;
    await pg`INSERT INTO "projectShareTokens" ("projectId",token,"createdBy") VALUES (41,'share-fixture',7)`;
    await pg`INSERT INTO "projectRevisions" ("projectId","userId",version,data) VALUES (41,7,1,'{}'),(42,7,1,'{}')`;
    await pg`INSERT INTO "projectCollaborators" ("projectId","userId","invitedBy") VALUES (41,8,7)`;
    await pg`INSERT INTO "projectChatMessages" ("projectId","userId",message) VALUES (41,8,'private chat'),(42,7,'own chat')`;
    await pg`INSERT INTO "projectActivityLog" ("projectId","userId","activityAction") VALUES (41,7,'settings_changed')`;
    await pg`INSERT INTO "audioGenerations" ("userId","audioType",prompt,duration,"projectId","audioUrl") VALUES (7,'music','private audio',10,41,'https://dreamforgex.ai/img/private/owned.png')`;
    await pg`INSERT INTO "galleryItems" (id,"generationId","userId",title) VALUES (50,70,7,'owned'),(51,80,8,'other')`;
    await pg`INSERT INTO "galleryComments" ("userId","galleryItemId",content) VALUES (8,50,'comment on owned'),(7,51,'owned comment')`;
    await pg`INSERT INTO "galleryLikes" ("userId","galleryItemId") VALUES (8,50),(7,51)`;
    await pg`INSERT INTO auth_sessions ("sessionToken","userId",expires) VALUES ('session-fixture','auth-owner',now()+interval '1 day')`;
    await pg`INSERT INTO auth_accounts ("userId",type,provider,"providerAccountId") VALUES ('auth-owner','oauth','google','provider-fixture')`;
    await pg`INSERT INTO "creditTransactions" ("userId",amount,"txType",description,"txMetadata","stripeSessionId","stripePaymentIntentId") VALUES (7,50,'purchase','Video keyframe: Sensitive fixture prompt',${pg.json({ prompt: "Sensitive fixture prompt", purchasedCreditsDebited: 5, operationId: "fixture-operation", generationRequestId: 11 })},'cs_fixture','pi_fixture')`;
    objects.set("keyframes/legacy.png", Buffer.from("LEGACY"));
    await pg`INSERT INTO "sceneKeyframes" ("projectId","sceneIndex",prompt,"imageUrl") VALUES (41,0,'private keyframe','https://dreamforgex.ai/img/keyframes/legacy.png'),(42,0,'other keyframe',NULL)`;
    await pg`INSERT INTO "generationRequests" ("userId","requestId","payloadHash","executionToken","quotedCredits",state,"generationId",result)
      VALUES (7,'11111111-1111-4111-8111-111111111111',${"a".repeat(64)},'22222222-2222-4222-8222-222222222222',5,'completed',70,'{"imageUrl":"https://dreamforgex.ai/img/private/owned.png"}')`;
    await pg`INSERT INTO "generationBatchRequests" ("userId","requestId","payloadHash","executionToken","quotedCredits",state,result)
      VALUES (7,'batch-fixture',${"b".repeat(64)},'33333333-3333-4333-8333-333333333333',10,'completed','{"results":["private"]}')`;
    await pg`INSERT INTO "marketplaceListings" (id,"sellerId",title,"listingType",price,"promptData","previewImages","listingTags") VALUES (61,7,'Private paid prompt','prompt',5000,'{"prompt":"secret"}','["https://dreamforgex.ai/img/private/owned.png"]','["private"]')`;
    await pg`INSERT INTO "sellerProfiles" ("userId","displayName",bio,"stripeConnectId","payoutBalance") VALUES (7,'Private seller','private bio','acct_fixture',1000)`;
    await pg`INSERT INTO "marketplaceReviews" ("buyerId","listingId","reviewRating",comment) VALUES (7,61,5,'private review')`;
    await pg`INSERT INTO analytics_events ("anonId","userId",event,path) VALUES ('anon-fixture',7,'view','/private')`;
  }
  async function image(key: string) {
    return imageGet(undefined as any, {
      params: Promise.resolve({ key: key.split("/") }),
    });
  }

  it("atomically removes content/shares/identities, revokes assets and retains financial history", async () => {
    await seedContent();
    await deleteUserAccount(7);
    const [user] = await pg`SELECT * FROM users WHERE id=7`;
    expect(user.loginMethod).toBe("deleted");
    expect(user.email).toBeNull();
    const [generation] = await pg`SELECT * FROM generations WHERE id=70`;
    expect(generation.prompt).toBe("[deleted]");
    expect(generation.imageUrl).toBeNull();
    expect(generation.fileKey).toBeNull();
    for (const table of [
      "projectShareTokens",
      "projectRevisions",
      "projectCollaborators",
      "projectChatMessages",
      "projectActivityLog",
      "audioGenerations",
      "galleryComments",
      "galleryLikes",
      "auth_sessions",
      "auth_accounts",
    ]) {
      expect(
        (await pg.unsafe(`SELECT count(*)::int AS n FROM ${quote(table)}`))[0]
          .n,
        table
      ).toBe(0);
    }
    expect(
      (await pg`SELECT count(*)::int AS n FROM "creditTransactions"`)[0].n
    ).toBe(1);
    const [receipt] =
      await pg`SELECT * FROM "creditTransactions" WHERE "userId"=7`;
    expect(receipt.description).not.toContain("Sensitive fixture prompt");
    expect(receipt.txMetadata).not.toHaveProperty("prompt");
    expect(receipt.txMetadata.purchasedCreditsDebited).toBe(5);
    expect(receipt.txMetadata.operationId).toBe("fixture-operation");
    expect(receipt.txMetadata.generationRequestId).toBe(11);
    expect(receipt.stripeSessionId).toBe("cs_fixture");
    expect(receipt.stripePaymentIntentId).toBe("pi_fixture");
    expect(receipt.amount).toBe(50);
    expect(
      (
        await pg`SELECT count(*)::int AS n FROM "sceneKeyframes" WHERE "projectId"=41`
      )[0].n
    ).toBe(0);
    expect(
      (await pg`SELECT prompt FROM "sceneKeyframes" WHERE "projectId"=42`)[0]
        .prompt
    ).toBe("other keyframe");
    expect((await image("keyframes/legacy.png")).status).toBe(404);
    expect(
      (await pg`SELECT result FROM "generationRequests" WHERE "userId"=7`)[0]
        .result
    ).toEqual({ deleted: true });
    expect(
      (
        await pg`SELECT result FROM "generationBatchRequests" WHERE "userId"=7`
      )[0].result
    ).toEqual({ deleted: true });
    const [listing] = await pg`SELECT * FROM "marketplaceListings" WHERE id=61`;
    expect(listing.listingStatus).toBe("suspended");
    expect(listing.promptData).toBeNull();
    expect(listing.previewImages).toBeNull();
    const [seller] = await pg`SELECT * FROM "sellerProfiles" WHERE "userId"=7`;
    expect(seller.displayName).toBe("Deleted user");
    expect(seller.bio).toBeNull();
    expect(seller.stripeConnectId).toBe("acct_fixture");
    expect(
      (await pg`SELECT count(*)::int AS n FROM "marketplaceReviews"`)[0].n
    ).toBe(0);
    expect(
      (
        await pg`SELECT count(*)::int AS n FROM analytics_events WHERE "userId"=7`
      )[0].n
    ).toBe(0);
    expect(
      (await pg`SELECT count(*)::int AS n FROM "videoProjects" WHERE id=42`)[0]
        .n
    ).toBe(1);
    expect(await hasAuthIdentity("auth-owner", "owner@example.test")).toBe(
      false
    );
    await createUserForAuthIdentity({
      id: "auth-owner",
      email: "owner@example.test",
    });
    expect((await pg`SELECT count(*)::int AS n FROM users`)[0].n).toBe(2);
    expect((await image("private/owned.png")).status).toBe(404);
    expect((await image("private/other.png")).status).toBe(200);
    expect(objects.has("private/owned.png")).toBe(false);
  });

  it("rolls back every scrub and revocation when the final tombstone write fails", async () => {
    await seedContent();
    await pg
      .unsafe(
        `CREATE FUNCTION deletion_fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."loginMethod"='deleted' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER deletion_fixture_failure BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION deletion_fixture_failure();`
      )
      .simple();
    try {
      await expect(deleteUserAccount(7)).rejects.toThrow(/fixture rollback/);
      expect(
        (await pg`SELECT prompt FROM generations WHERE id=70`)[0].prompt
      ).toBe("private prompt");
      expect(
        (await pg`SELECT count(*)::int AS n FROM "projectShareTokens"`)[0].n
      ).toBe(1);
      expect(await hasAuthIdentity("auth-owner", "owner@example.test")).toBe(
        true
      );
      expect(await isMediaRevoked("private/owned.png")).toBe(false);
      expect(objects.has("private/owned.png")).toBe(true);
      expect(
        mocks.send.mock.calls.filter(([c]) => c.operation === "delete")
      ).toHaveLength(0);
    } finally {
      await pg
        .unsafe(
          "DROP TRIGGER deletion_fixture_failure ON users; DROP FUNCTION deletion_fixture_failure()"
        )
        .simple();
    }
  });

  it("denies old URLs during storage outage and keeps cleanup retryable", async () => {
    await seedContent();
    failDelete = true;
    await deleteUserAccount(7);
    expect((await image("private/owned.png")).status).toBe(404);
    const [asset] =
      await pg`SELECT * FROM "mediaAssets" WHERE key='private/owned.png'`;
    expect(asset.revokedAt).not.toBeNull();
    expect(asset.deletedAt).toBeNull();
    expect(asset.deleteAttempts).toBe(1);
    expect(objects.has("private/owned.png")).toBe(true);
    failDelete = false;
    await purgeRevokedMedia();
    expect(objects.has("private/owned.png")).toBe(false);
    expect(
      (await image("private/other.png")).headers.get("cache-control")
    ).toContain("no-store");
  });

  it("a slow upload racing account deletion never returns a usable object", async () => {
    const started = deferred(),
      finishPut = deferred();
    const ordinary = mocks.send.getMockImplementation()!;
    mocks.send.mockImplementation(async command => {
      if (command.operation === "put") {
        started.resolve();
        await finishPut.promise;
      }
      return ordinary(command);
    });
    const upload = withStorageOwner(7, () =>
      storagePut("uploads/late.png", Buffer.from("LATE"), "image/png")
    );
    const outcome = upload.then(
      () => "completed",
      error => String(error.message)
    );
    await started.promise;
    await deleteUserAccount(7);
    finishPut.resolve();
    expect(await outcome).toMatch(/cancelled/);
    expect(objects.has("uploads/late.png")).toBe(false);
    expect((await image("uploads/late.png")).status).toBe(404);
  });

  it("an older successful cleanup cannot hide a newer failed cleanup after a late PUT", async () => {
    await registerMediaAsset("uploads/race.png", 7);
    objects.set("uploads/race.png", Buffer.from("OLD"));
    await revokeMediaUrls(
      "https://dreamforgex.ai/img/uploads/race.png",
      "fixture"
    );
    const firstStarted = deferred(),
      finishFirst = deferred();
    let deletes = 0;
    mocks.send.mockImplementation(async command => {
      if (command.operation !== "delete")
        throw new Error("unexpected fixture operation");
      deletes++;
      if (deletes === 1) {
        objects.delete(command.input.Key);
        firstStarted.resolve();
        await finishFirst.promise;
        return {};
      }
      throw new Error("newer cleanup unavailable");
    });
    const firstCleanup = purgeRevokedMedia();
    await firstStarted.promise;
    objects.set("uploads/race.png", Buffer.from("LATE"));
    await expect(confirmMediaUpload("uploads/race.png")).rejects.toThrow(
      /cancelled/
    );
    finishFirst.resolve();
    await firstCleanup;
    expect(
      (
        await pg`SELECT "deletedAt" FROM "mediaAssets" WHERE key='uploads/race.png'`
      )[0].deletedAt
    ).toBeNull();
    expect(objects.has("uploads/race.png")).toBe(true);
    expect((await image("uploads/race.png")).status).toBe(404);
  });

  it("database fences reject a deleted actor's late writes into another user's active project", async () => {
    await seedContent();
    await deleteUserAccount(7);
    await expect(
      pg`INSERT INTO "projectChatMessages" ("projectId","userId",message) VALUES (42,7,'late private chat')`
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pg`INSERT INTO "projectRevisions" ("projectId","userId",version,data) VALUES (42,7,2,'{}')`
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pg`INSERT INTO "galleryComments" ("userId","galleryItemId",content) VALUES (7,51,'late comment')`
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pg`INSERT INTO notifications ("userId","notifType",title,message) VALUES (7,'generation','Complete','Late private prompt')`
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      pg`INSERT INTO "sceneKeyframes" ("projectId","sceneIndex",prompt) VALUES (41,1,'Late private keyframe')`
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("a content writer waiting behind deletion cannot resurrect a generation", async () => {
    const locked = deferred(),
      proceed = deferred();
    mocks.afterStatement = async text => {
      if (
        text.includes("SELECT id FROM users") &&
        text.includes("FOR UPDATE")
      ) {
        locked.resolve();
        await proceed.promise;
      }
    };
    const deletion = deleteUserAccount(7);
    await Promise.race([
      locked.promise,
      deletion.then(() => {
        throw new Error("Deletion did not reach fixture lock");
      }),
    ]);
    const lateWrite =
      pg`INSERT INTO generations ("userId",prompt) VALUES (7,'late secret')`.then(
        () => null,
        error => error
      );
    proceed.resolve();
    await deletion;
    expect(await lateWrite).toMatchObject({ code: "23514" });
    expect(
      (
        await pg`SELECT count(*)::int AS n FROM generations WHERE "userId"=7 AND prompt='late secret'`
      )[0].n
    ).toBe(0);
  });

  it("a late auth bridge waiting on the removed adapter identity cannot recreate the account", async () => {
    const removed = deferred(),
      proceed = deferred();
    mocks.afterStatement = async text => {
      if (text.includes("DELETE FROM auth_users")) {
        removed.resolve();
        await proceed.promise;
      }
    };
    const deletion = deleteUserAccount(7);
    await Promise.race([
      removed.promise,
      deletion.then(() => {
        throw new Error("Deletion did not reach fixture identity removal");
      }),
    ]);
    const bridge = createUserForAuthIdentity({
      id: "auth-owner",
      email: "owner@example.test",
      name: "Old JWT",
    });
    proceed.resolve();
    await deletion;
    await bridge;
    expect(await hasAuthIdentity("auth-owner", "owner@example.test")).toBe(
      false
    );
    expect(
      (
        await pg`SELECT count(*)::int AS n FROM users WHERE email='owner@example.test'`
      )[0].n
    ).toBe(0);
  });

  it("same-user concurrent deletion is idempotent after waiting for the owner lock", async () => {
    await seedContent();
    const outcomes = await Promise.allSettled([
      deleteUserAccount(7),
      deleteUserAccount(7),
    ]);
    expect(outcomes.map(outcome => outcome.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
    expect(
      (await pg`SELECT "loginMethod" FROM users WHERE id=7`)[0].loginMethod
    ).toBe("deleted");
    expect((await image("private/owned.png")).status).toBe(404);
    expect(
      (await pg`SELECT count(*)::int AS n FROM "creditTransactions"`)[0].n
    ).toBe(1);
  });
});
