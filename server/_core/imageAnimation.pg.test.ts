import { readFileSync } from "node:fs";
import postgres from "postgres";
import sharp from "sharp";
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
import {
  users,
  generations,
  creditBalances,
  creditTransactions,
  subscriptionPlans,
  userSubscriptions,
  mediaAssets,
  mediaUploads,
} from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({
  neon: vi.fn(),
  source: vi.fn(),
  put: vi.fn(),
  download: vi.fn(),
  privateReady: vi.fn(),
  loseReceiptAck: false,
  loseBeginAck: false,
}));
vi.mock("@neondatabase/serverless", () => ({ neon: mocks.neon }));
vi.mock("../stripe", () => ({
  getOrCreateBalance: vi.fn(async () => ({ balance: 5000 })),
}));
vi.mock("../storage", () => ({
  storageGetObjectBounded: mocks.source,
  storagePut: mocks.put,
}));
vi.mock("./imageUrlGuard", () => ({ fetchGuardedMedia: mocks.download }));
vi.mock("./toolStatus", () => ({ requireToolActive: vi.fn(async () => {}) }));
vi.mock("./privateStorage", () => ({
  assertPrivateStorage: mocks.privateReady,
}));
import {
  imageAnimationService,
  readAnimationRequest,
  registerUploadedAnimationSource,
  sweepImageAnimations,
} from "./imageAnimation";
import { registerMediaAsset } from "./mediaLifecycle";
import { storageOwner } from "./storageContext";

const testUrl = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (testUrl) {
  const url = new URL(testUrl);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55439" ||
    url.pathname !== "/dreamforge_billing_qa" ||
    url.username !== "dreamforge_qa"
  )
    throw new Error(
      "Animation tests require the isolated owned loopback fixture."
    );
}
const suite = testUrl ? describe : describe.skip;
suite("real queued animation persistence on isolated PostgreSQL", () => {
  const schemaName = `animation_qa_${process.pid}_${Date.now()}`;
  const pg = postgres(
    testUrl ??
      "postgresql://dreamforge_qa:local_qa_only@127.0.0.1:55439/dreamforge_billing_qa",
    {
      max: 6,
      prepare: false,
      onnotice: () => {},
      connection: { search_path: schemaName },
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
  let created = false;
  const tables = [
    users,
    generations,
    creditBalances,
    creditTransactions,
    subscriptionPlans,
    userSubscriptions,
    mediaAssets,
    mediaUploads,
  ];
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
  const dialect = new PgDialect();
  async function wire(
    item: { text: string; params: any[]; options: any },
    transport: any = pg
  ) {
    const rows = await transport.unsafe(item.text, item.params);
    if (mocks.loseReceiptAck && item.text.includes("animation:receipt")) {
      mocks.loseReceiptAck = false;
      throw new Error("Fixture lost committed receipt acknowledgment");
    }
    if (mocks.loseBeginAck && item.text.includes("generation-billing:begin")) {
      mocks.loseBeginAck = false;
      throw new Error("Fixture lost committed begin acknowledgment");
    }
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
  Object.assign(query, {
    query,
    transaction: (items: any[]) =>
      pg.begin(async tx => {
        const results = [];
        for (const item of items) results.push(await wire(item, tx));
        return results;
      }),
  });
  const input = {
    requestId: "11111111-1111-4111-8111-111111111111",
    generationId: 41,
    prompt: "A slow cinematic camera pan",
    expectedCreditCost: 1293,
  };
  const receipt = {
    request_id: "fal-queue-fixture",
    status_url:
      "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-queue-fixture/status",
    response_url:
      "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-queue-fixture",
  };
  let providerStatus = "IN_PROGRESS";
  let providerError = false;
  let rejectSubmit = false;
  let fetch: ReturnType<typeof vi.fn>;
  const png = readFileSync(
    new URL("../../public/icon-192.png", import.meta.url)
  );
  const mp4 = readFileSync(
    new URL("../../public/video/hero-bg.mp4", import.meta.url)
  );

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", testUrl!);
    vi.stubEnv("FAL_API_KEY", "mock-only-never-live");
    mocks.neon.mockReturnValue(query);
    await pg.unsafe(`CREATE SCHEMA ${quote(schemaName)}`);
    created = true;
    const enums = new Map<string, string[]>();
    for (const table of tables)
      for (const column of getTableConfig(table).columns as any[])
        if (column.columnType === "PgEnumColumn")
          enums.set(column.enum.enumName, column.enum.enumValues);
    for (const [name, values] of enums)
      await pg.unsafe(
        `CREATE TYPE ${quote(name)} AS ENUM (${values.map(literal).join(",")})`
      );
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
            const q = dialect.sqlToQuery(column.default);
            def =
              " DEFAULT " +
              q.sql.replace(/\$(\d+)/g, (_: string, n: string) =>
                literal(q.params[Number(n) - 1])
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
    // Real durable-request migration, including its uniqueness/state fences.
    const migration = readFileSync(
      new URL("../../drizzle/0014_generation_requests.sql", import.meta.url),
      "utf8"
    );
    for (const statement of migration.split("--> statement-breakpoint"))
      if (statement.trim()) await pg.unsafe(statement).simple();
  });
  beforeEach(async () => {
    mocks.privateReady.mockReset().mockResolvedValue({});
    await pg.unsafe(
      'TRUNCATE "generationRequests", generations, "mediaUploads", "mediaAssets", "creditTransactions", "creditBalances", "userSubscriptions", "subscriptionPlans", users RESTART IDENTITY CASCADE'
    );
    await pg`INSERT INTO users (id,"openId","loginMethod") VALUES (7,'owner','google'),(8,'other-owner','google')`;
    await pg`INSERT INTO "subscriptionPlans" (id,name,"displayName","monthlyCredits") VALUES (1,'creator','Creator',5000)`;
    await pg`INSERT INTO "userSubscriptions" ("userId","planId","subStatus","currentPeriodStart","currentPeriodEnd") VALUES (7,1,'active',now()-interval '1 day',now()+interval '1 day')`;
    await pg`INSERT INTO "creditBalances" ("userId",balance,"bonusCredits","walletAccountingVersion") VALUES (7,5000,3500,1),(8,5000,5000,1)`;
    await pg`INSERT INTO generations (id,"userId",prompt,"mediaType",status,"fileKey","imageUrl") VALUES (41,7,'A landscape','image','completed','source.png','/api/media/source.png'),(42,8,'Other owner','image','completed','other.png','/api/media/other.png')`;
    await pg`INSERT INTO "mediaAssets" (key,"ownerUserId","isPrivate") VALUES ('source.png',7,true),('other.png',8,true)`;
    mocks.loseReceiptAck = false;
    mocks.loseBeginAck = false;
    providerStatus = "IN_PROGRESS";
    providerError = false;
    rejectSubmit = false;
    mocks.source
      .mockReset()
      .mockResolvedValue({ bytes: png, contentType: "image/png" });
    mocks.download
      .mockReset()
      .mockResolvedValue({ buffer: mp4, contentType: "video/mp4" });
    mocks.put
      .mockReset()
      .mockImplementation(
        async (
          key: string,
          _bytes: Buffer,
          _contentType: string,
          options: any
        ) => {
          await registerMediaAsset(key, storageOwner(), options?.isPrivate);
          return { key, url: `/api/media/${key}` };
        }
      );
    fetch = vi.fn(async (url: string, options: RequestInit) => {
      if (options.method === "POST")
        return rejectSubmit
          ? new Response("Rejected", { status: 422 })
          : Response.json(receipt);
      if (url.endsWith("/status"))
        return Response.json({
          status: providerStatus,
          request_id: receipt.request_id,
          ...(providerError
            ? {
                error: "Provider finished without output",
                error_type: "content_policy_violation",
              }
            : {}),
        });
      return Response.json({
        video: {
          url: "https://v3.fal.media/fixture.mp4",
          content_type: "video/mp4",
        },
      });
    });
    vi.stubGlobal("fetch", fetch);
  });
  afterAll(async () => {
    try {
      if (created) await pg.unsafe(`DROP SCHEMA ${quote(schemaName)} CASCADE`);
    } finally {
      await pg.end();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
  const wallet = async () =>
    (
      await pg`SELECT balance,"bonusCredits","lifetimeSpent" FROM "creditBalances" WHERE "userId" = 7`
    )[0];
  const postCount = () =>
    fetch.mock.calls.filter(([, options]) => options.method === "POST").length;

  it("executes actual source/claim/receipt/completion SQL and stores a private MP4 exactly once", async () => {
    expect(await imageAnimationService.start(7, input)).toMatchObject({
      status: "generating",
      creditCost: 1293,
    });
    const row = await readAnimationRequest(7, input.requestId);
    expect(row!.metadata!.animationReceipt.providerRequestId).toBe(
      receipt.request_id
    );
    expect(await wallet()).toMatchObject({
      balance: 3707,
      bonusCredits: 3500,
      lifetimeSpent: 1293,
    });
    providerStatus = "COMPLETED";
    expect(
      await imageAnimationService.status(7, input.requestId)
    ).toMatchObject({
      status: "completed",
      mediaType: "video",
      imageUrl: `/api/media/animation/7/${input.requestId}.mp4`,
      creditCost: 1293,
    });
    await imageAnimationService.start(7, input);
    await imageAnimationService.status(7, input.requestId);
    expect(postCount()).toBe(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][2]).toBe("video/mp4");
    expect(mocks.put.mock.calls[0][3]).toEqual({ isPrivate: true });
    const [asset] =
      await pg`SELECT "ownerUserId","isPrivate" FROM "mediaAssets" WHERE key = ${`animation/7/${input.requestId}.mp4`}`;
    expect(asset).toMatchObject({ ownerUserId: 7, isPrivate: true });
    expect(
      Number(
        (
          await pg`SELECT count(*) n FROM "creditTransactions" WHERE "txType" = 'usage'`
        )[0].n
      )
    ).toBe(1);
  });
  it("recovers a committed receipt after lost acknowledgment and a later request", async () => {
    mocks.loseReceiptAck = true;
    expect(await imageAnimationService.start(7, input)).toMatchObject({
      status: "generating",
      reconciliationRequired: false,
    });
    providerStatus = "COMPLETED";
    expect(await imageAnimationService.start(7, input)).toMatchObject({
      status: "completed",
    });
    expect(postCount()).toBe(1);
    expect((await wallet()).balance).toBe(3707);
  });
  it("never submits after a lost begin acknowledgment", async () => {
    mocks.loseBeginAck = true;
    expect(await imageAnimationService.start(7, input)).toMatchObject({
      status: "generating",
      reconciliationRequired: true,
    });
    await imageAnimationService.start(7, input);
    expect(postCount()).toBe(0);
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("serializes simultaneous start retries into one actual debit and provider POST", async () => {
    await Promise.all([
      imageAnimationService.start(7, input),
      imageAnimationService.start(7, input),
    ]);
    expect(postCount()).toBe(1);
    expect((await wallet()).balance).toBe(3707);
    expect(
      Number((await pg`SELECT count(*) n FROM "generationRequests"`)[0].n)
    ).toBe(1);
  });
  it.each(["submit rejection", "completed provider failure"])(
    "returns exact original credit buckets on %s and never refunds twice",
    async reason => {
      await pg`UPDATE "creditBalances" SET "bonusCredits" = 4800 WHERE "userId" = 7`;
      if (reason === "submit rejection") rejectSubmit = true;
      let result = await imageAnimationService.start(7, input);
      if (reason !== "submit rejection") {
        providerStatus = "COMPLETED";
        providerError = true;
        result = await imageAnimationService.status(7, input.requestId);
      }
      expect(result).toMatchObject({ status: "failed", refundedCredits: 1293 });
      await imageAnimationService.start(7, input);
      await imageAnimationService.status(7, input.requestId);
      expect(await wallet()).toMatchObject({
        balance: 5000,
        bonusCredits: 4800,
        lifetimeSpent: 0,
      });
      expect(
        (
          await pg`SELECT "txMetadata" FROM "creditTransactions" WHERE "txType" = 'usage'`
        )[0].txMetadata.purchasedCreditsDebited
      ).toBe(1093);
      expect(
        Number(
          (
            await pg`SELECT count(*) n FROM "creditTransactions" WHERE "txType" = 'refund'`
          )[0].n
        )
      ).toBe(1);
      expect(mocks.put).not.toHaveBeenCalled();
    }
  );
  it("rejects foreign or revoked source images before spending credits", async () => {
    await expect(
      imageAnimationService.start(7, { ...input, generationId: 42 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await pg`UPDATE "mediaAssets" SET "revokedAt" = now() WHERE key = 'source.png'`;
    await expect(imageAnimationService.start(7, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect((await wallet()).balance).toBe(5000);
    expect(postCount()).toBe(0);
  });
  it("rejects unverified private storage before reserving credits or calling a provider", async () => {
    mocks.privateReady.mockRejectedValue(
      new Error("Private bucket could not be verified")
    );
    await expect(imageAnimationService.start(7, input)).rejects.toThrow(
      "Private bucket"
    );
    expect((await wallet()).balance).toBe(5000);
    expect(postCount()).toBe(0);
    expect(
      Number((await pg`SELECT count(*) n FROM "generationRequests"`)[0].n)
    ).toBe(0);
  });
  it("rechecks a source revoked after its bytes were prepared before allowing provider submission", async () => {
    mocks.source.mockImplementationOnce(async () => {
      await pg`UPDATE "mediaAssets" SET "revokedAt" = now() WHERE key = 'source.png'`;
      return { bytes: png, contentType: "image/png" };
    });
    expect(await imageAnimationService.start(7, input)).toMatchObject({
      status: "failed",
      refundedCredits: 1293,
    });
    expect((await wallet()).balance).toBe(5000);
    expect(postCount()).toBe(0);
  });
  it("recovers a failed refund transaction from its durable confirmed-failure marker", async () => {
    await pg
      .unsafe(
        `CREATE FUNCTION reject_animation_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."txType" = 'refund' THEN RAISE EXCEPTION 'fixture refund outage'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_animation_refund BEFORE INSERT ON "creditTransactions" FOR EACH ROW EXECUTE FUNCTION reject_animation_refund();`
      )
      .simple();
    rejectSubmit = true;
    try {
      expect(await imageAnimationService.start(7, input)).toMatchObject({
        status: "generating",
      });
      expect(
        (await readAnimationRequest(7, input.requestId))!.request.errorCode
      ).toBe("animation-known-failure");
      expect((await wallet()).balance).toBe(3707);
    } finally {
      await pg
        .unsafe(
          'DROP TRIGGER reject_animation_refund ON "creditTransactions"; DROP FUNCTION reject_animation_refund();'
        )
        .simple();
    }
    expect(
      await imageAnimationService.status(7, input.requestId)
    ).toMatchObject({ status: "failed", refundedCredits: 1293 });
    expect((await wallet()).balance).toBe(5000);
    expect(postCount()).toBe(1);
  });
  it("executes the actual polling lease so overlapping status calls copy and complete only once", async () => {
    await imageAnimationService.start(7, input);
    providerStatus = "COMPLETED";
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const original = fetch.getMockImplementation()!;
    fetch.mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith("/status")) await gate;
      return original(url, options);
    });
    const first = imageAnimationService.status(7, input.requestId);
    await vi.waitFor(() =>
      expect(
        fetch.mock.calls.filter(([url]) => url.endsWith("/status"))
      ).toHaveLength(1)
    );
    expect(
      await imageAnimationService.status(7, input.requestId)
    ).toMatchObject({ status: "generating", reconciliationRequired: false });
    release();
    expect(await first).toMatchObject({ status: "completed" });
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith("/status"))
    ).toHaveLength(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });
  it("rejects a completed PNG mislabeled as video and refunds without publishing a false MP4", async () => {
    await imageAnimationService.start(7, input);
    providerStatus = "COMPLETED";
    mocks.download.mockResolvedValue({ buffer: png, contentType: "video/mp4" });
    expect(
      await imageAnimationService.status(7, input.requestId)
    ).toMatchObject({ status: "failed", refundedCredits: 1293 });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(
      (await readAnimationRequest(7, input.requestId))!.request.state
    ).toBe("refunded");
    expect((await wallet()).balance).toBe(5000);
  });
  it("rejects another owner's status and blocks outputs after account deletion", async () => {
    await imageAnimationService.start(7, input);
    await expect(
      imageAnimationService.status(8, input.requestId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await pg`UPDATE users SET "loginMethod" = 'deleted' WHERE id = 7`;
    providerStatus = "COMPLETED";
    await expect(
      imageAnimationService.status(7, input.requestId)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(postCount()).toBe(1);
  });
  it("recovers a saved receipt with the browser closed using GET-only cron polling", async () => {
    await imageAnimationService.start(7, input);
    providerStatus = "COMPLETED";
    expect(await sweepImageAnimations(2)).toMatchObject({
      checked: 1,
      completed: 1,
      errors: 0,
    });
    expect(postCount()).toBe(1);
    expect(
      (await readAnimationRequest(7, input.requestId))!.request.state
    ).toBe("completed");
    expect(await sweepImageAnimations(2)).toMatchObject({ checked: 0 });
  });
  async function seedUpload(
    purpose = "animation",
    state = "completed",
    contentType = "image/png"
  ) {
    const key = "uploads/7/uploaded-image.png";
    await pg`INSERT INTO "mediaUploads" (id,"userId",key,"fileName","contentType",size,purpose,"partCount",state,"expiresAt") VALUES ('33333333-3333-4333-8333-333333333333',7,${key},'Image.png',${contentType},${png.length},${purpose},1,${state},now()+interval '1 hour')`;
    await pg`INSERT INTO "mediaAssets" (key,"ownerUserId","isPrivate") VALUES (${key},7,true)`;
    return key;
  }
  it("imports a completed private image idempotently under simultaneous READ COMMITTED owner locks", async () => {
    const key = await seedUpload();
    const results = await Promise.all([
      registerUploadedAnimationSource(7, key),
      registerUploadedAnimationSource(7, key),
      registerUploadedAnimationSource(7, key),
    ]);
    expect(new Set(results.map(result => result.generationId)).size).toBe(1);
    expect(results[0].imageUrl).toBe(`/api/media/${key}`);
    const [generation] =
      await pg`SELECT "fileKey","modelVersion","mediaType",status,metadata FROM generations WHERE id = ${results[0].generationId}`;
    expect(generation).toMatchObject({
      fileKey: key,
      modelVersion: "user-upload",
      mediaType: "image",
      status: "completed",
      metadata: { sourceImport: "animation" },
    });
    expect(
      Number(
        (
          await pg`SELECT count(*) n FROM generations WHERE "fileKey" = ${key}`
        )[0].n
      )
    ).toBe(1);
    expect((await wallet()).balance).toBe(5000);
    expect(postCount()).toBe(0);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(
      await imageAnimationService.start(7, {
        ...input,
        generationId: results[0].generationId,
      })
    ).toMatchObject({ status: "generating" });
    expect(postCount()).toBe(1);
  });
  it.each(["timeline", "training"])(
    "rejects completed %s uploads as animation imports",
    async purpose => {
      const key = await seedUpload(purpose);
      await expect(
        registerUploadedAnimationSource(7, key)
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(postCount()).toBe(0);
    }
  );
  it("rejects unfinished, foreign, revoked and deleted-owner imports without creating a generation", async () => {
    const key = await seedUpload("animation", "open");
    await expect(registerUploadedAnimationSource(7, key)).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
    await pg`UPDATE "mediaUploads" SET state = 'completed' WHERE key = ${key}`;
    await expect(registerUploadedAnimationSource(8, key)).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
    await pg`UPDATE "mediaAssets" SET "revokedAt" = now() WHERE key = ${key}`;
    await expect(registerUploadedAnimationSource(7, key)).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
    await pg`UPDATE "mediaAssets" SET "revokedAt" = NULL WHERE key = ${key}`;
    await pg`UPDATE users SET "loginMethod" = 'deleted' WHERE id = 7`;
    await expect(registerUploadedAnimationSource(7, key)).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
    expect(
      Number(
        (
          await pg`SELECT count(*) n FROM generations WHERE "fileKey" = ${key}`
        )[0].n
      )
    ).toBe(0);
    expect(postCount()).toBe(0);
  });
  it("rejects image MIME mismatch and source revocation between decode and INSERT", async () => {
    const key = await seedUpload("animation", "completed", "image/jpeg");
    await expect(registerUploadedAnimationSource(7, key)).rejects.toMatchObject(
      { code: "BAD_REQUEST" }
    );
    await pg`UPDATE "mediaUploads" SET "contentType" = 'image/png' WHERE key = ${key}`;
    mocks.source.mockImplementationOnce(async () => {
      await pg`UPDATE "mediaAssets" SET "revokedAt" = now() WHERE key = ${key}`;
      return { bytes: png, contentType: "image/png" };
    });
    await expect(registerUploadedAnimationSource(7, key)).rejects.toMatchObject(
      { code: "NOT_FOUND" }
    );
    expect(
      Number(
        (
          await pg`SELECT count(*) n FROM generations WHERE "fileKey" = ${key}`
        )[0].n
      )
    ).toBe(0);
    expect(postCount()).toBe(0);
  });
  it("imports a real AVIF decoded as HEIF with AV1 compression", async () => {
    const avif = await sharp(png).avif({ quality: 40, effort: 1 }).toBuffer();
    expect(await sharp(avif).metadata()).toMatchObject({
      format: "heif",
      compression: "av1",
    });
    const key = await seedUpload("animation", "completed", "image/avif");
    await pg`UPDATE "mediaUploads" SET size = ${avif.length} WHERE key = ${key}`;
    mocks.source.mockResolvedValue({ bytes: avif, contentType: "image/avif" });
    expect(await registerUploadedAnimationSource(7, key)).toMatchObject({
      generationId: expect.any(Number),
      imageUrl: `/api/media/${key}`,
    });
    expect(postCount()).toBe(0);
  });
});
