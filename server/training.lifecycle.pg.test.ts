import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const state = vi.hoisted(() => ({
  db: null as any,
  objects: new Map<string, Buffer>(),
  submits: 0,
  weightDownloads: 0,
  providerStatus: "IN_QUEUE",
  providerError: false,
  mode: "ok",
  cancelCalls: 0,
  renderStatus: "error",
  beforeModelPut: undefined as undefined | (() => Promise<void>),
  onImageRead: undefined as undefined | (() => void),
  privateReady: true,
  lostSubmissionAck: false,
  lostPreparationAck: false,
  lostCompletionAck: false,
}));
vi.mock("./db", () => ({ getDb: async () => state.db }));
vi.mock("./stripe", () => ({ getOrCreateBalance: async () => {} }));
vi.mock("./_core/privateStorage", () => ({
  privateStorageConfigured: () => true,
  privateStorageAvailable: async () => state.privateReady,
  assertPrivateStorage: async () => {
    if (!state.privateReady)
      throw new Error("Private storage verification is unavailable.");
    return {
      bucket: "fixture-private-only",
      accountId: "fixture",
      accessKeyId: "fixture",
      secretAccessKey: "fixture",
    };
  },
}));
vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn(async () => {}) }));
vi.mock("./_core/toolStatus", () => ({
  requireToolActive: vi.fn(async () => {}),
}));
vi.mock("./_core/imageUrlGuard", () => ({
  fetchGuardedImage: async (url: string) => {
    if (url !== "https://v3.fal.media/files/render.jpg")
      throw new Error("Unexpected fixture image URL");
    return {
      buffer: Buffer.from("fixture normalized image bytes"),
      contentType: "image/jpeg",
    };
  },
}));
vi.mock("./storage", () => ({
  storageGetObjectBounded: async (key: string, limit: number) => {
    const bytes = state.objects.get(key);
    if (!bytes) return null;
    if (bytes.length > limit) throw new Error("Too large");
    return { bytes, contentType: "image/jpeg" };
  },
  storageGetSigned: async (key: string) => {
    const { isMediaRevoked } = await import("./_core/mediaLifecycle");
    if (await isMediaRevoked(key)) throw new Error("Revoked");
    return `https://fixture.r2.example/${key}?signed=fixture`;
  },
  storagePut: async (
    key: string,
    data: Buffer,
    _type: string,
    options: any
  ) => {
    if (key.startsWith("training/models/")) await state.beforeModelPut?.();
    const { registerMediaAsset, confirmMediaUpload } =
      await import("./_core/mediaLifecycle");
    const { storageOwner } = await import("./_core/storageContext");
    await registerMediaAsset(key, storageOwner(), options?.isPrivate === true);
    state.objects.set(key, Buffer.from(data));
    await confirmMediaUpload(key);
    return { key, url: `/api/media/${key}` };
  },
  storageDelete: async (key: string) => {
    state.objects.delete(key);
  },
}));
import { trainingRouter } from "./routers/training";
import * as jobs from "./dbTraining";
import {
  executeOwnedTrainingImage,
  resolveOwnedTrainingModel,
  TrainingImageOutcomeUncertain,
  sweepOwnedTrainingJobs,
} from "./_core/modelTraining";
import {
  claimGenerationRequest,
  beginGenerationRequest,
  markGenerationReconciliation,
} from "./_core/generationBilling";

const url = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    u.hostname !== "127.0.0.1" ||
    u.port !== "55439" ||
    u.pathname !== "/dreamforge_billing_qa" ||
    u.username !== "dreamforge_qa"
  )
    throw new Error("Owned loopback fixture required.");
}
const suite = url ? describe : describe.skip;
suite("owned custom training through real router and PostgreSQL", () => {
  const schema = `training_tools_${randomUUID().replaceAll("-", "").slice(0, 10)}`,
    admin = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
  const pg = postgres(url!, {
      max: 12,
      prepare: false,
      connection: { options: `-c search_path=${schema}` },
      onnotice: () => {},
    }),
    dialect = new PgDialect();
  let weights: Buffer;
  const execute = async (query: SQL) => {
    const q = dialect.sqlToQuery(query),
      result = await pg.unsafe(
        q.sql,
        q.params.map(p => (p instanceof Date ? p.toISOString() : p)) as any[]
      );
    if (/^\s*SELECT m\.key FROM "mediaAssets"/.test(q.sql))
      state.onImageRead?.();
    if (
      state.lostSubmissionAck &&
      q.sql.includes('claimed AS (UPDATE "trainingJobs"')
    ) {
      state.lostSubmissionAck = false;
      throw new Error("Fixture lost debit acknowledgment");
    }
    if (
      state.lostPreparationAck &&
      q.sql.includes('"archiveKey"=') &&
      q.params.includes("ready_to_submit")
    ) {
      state.lostPreparationAck = false;
      throw new Error("Fixture lost preparation acknowledgment");
    }
    if (state.lostCompletionAck && q.sql.includes("state='succeeded'")) {
      state.lostCompletionAck = false;
      throw new Error("Fixture lost completion acknowledgment");
    }
    return result;
  };
  beforeAll(async () => {
    // Remove only the exact schema left by the earlier timed-out fixture run.
    await admin.unsafe("DROP SCHEMA IF EXISTS training_tools_qa CASCADE");
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    const migrations = (await readdir(new URL("../drizzle/", import.meta.url)))
      .filter(
        name => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) <= 18
      )
      .sort();
    for (const migration of migrations) {
      const body = (
        await readFile(
          new URL(`../drizzle/${migration}`, import.meta.url),
          "utf8"
        )
      ).replaceAll('"public".', `"${schema}".`);
      for (const query of body.split("--> statement-breakpoint"))
        if (query.trim()) await pg.unsafe(query).simple();
    }
    const orm = drizzle(pg);
    state.db = {
      select: orm.select.bind(orm),
      update: orm.update.bind(orm),
      insert: orm.insert.bind(orm),
      delete: orm.delete.bind(orm),
      execute: (query: SQL) => ({
        query,
        then: (resolve: any, reject: any) =>
          execute(query).then(resolve, reject),
      }),
      batch: async (queries: { query: SQL }[]) =>
        pg.begin(async tx => {
          const results = [];
          for (const query of queries) {
            const q = dialect.sqlToQuery(query.query);
            results.push(
              await tx.unsafe(
                q.sql,
                q.params.map(p =>
                  p instanceof Date ? p.toISOString() : p
                ) as any[]
              )
            );
          }
          return results;
        }),
    };
    const header = Buffer.from(
      JSON.stringify({
        "transformer.lora_A.weight": {
          dtype: "F32",
          shape: [1],
          data_offsets: [0, 4],
        },
      })
    );
    const length = Buffer.alloc(8);
    length.writeBigUInt64LE(BigInt(header.length));
    weights = Buffer.concat([length, header, Buffer.alloc(4)]);
  }, 30_000);
  beforeEach(async () => {
    process.env.FAL_API_KEY = "fixture_not_a_real_key";
    Object.assign(state, {
      submits: 0,
      weightDownloads: 0,
      providerStatus: "IN_QUEUE",
      providerError: false,
      mode: "ok",
      cancelCalls: 0,
      renderStatus: "error",
      beforeModelPut: undefined,
      onImageRead: undefined,
      privateReady: true,
      lostSubmissionAck: false,
      lostPreparationAck: false,
      lostCompletionAck: false,
    });
    state.objects.clear();
    await pg
      .unsafe(
        `TRUNCATE "trainingJobs","mediaUploads","mediaAssets",generations,"generationRequests","creditTransactions","creditBalances","userSubscriptions","subscriptionPlans",users RESTART IDENTITY CASCADE`
      )
      .simple();
    await pg`INSERT INTO users (id,"openId",email) VALUES (1,'training-owner','training@example.invalid'),(2,'other-owner','other@example.invalid')`;
    await pg`INSERT INTO "creditBalances" ("userId",balance,"bonusCredits","walletAccountingVersion") VALUES (1,20000,15000,1),(2,20000,0,1)`;
    await pg`INSERT INTO "subscriptionPlans" (id,name,"displayName","monthlyCredits") VALUES (1,'agency','Agency',300000)`;
    await pg`INSERT INTO "userSubscriptions" ("userId","planId","subStatus","currentPeriodStart","currentPeriodEnd") VALUES (1,1,'active',now()-interval '1 day',now()+interval '1 day'),(2,1,'active',now()-interval '1 day',now()+interval '1 day')`;
    for (let i = 0; i < 5; i++) {
      const key = `uploads/training_fixture_${i}.jpg`;
      state.objects.set(
        key,
        await sharp({
          create: {
            width: 64,
            height: 64,
            channels: 3,
            background: { r: i * 40, g: 70, b: 210 },
          },
        })
          .jpeg()
          .toBuffer()
      );
      await pg`INSERT INTO "mediaAssets" (key,"ownerUserId","isPrivate") VALUES (${key},1,true)`;
      await pg`INSERT INTO "mediaUploads" (id,"userId",key,"fileName","contentType",size,purpose,"partCount",state,"expiresAt")
        VALUES (${randomUUID()},1,${key},${`fixture_${i}.jpg`},'image/jpeg',${state.objects.get(key)!.length},'training',1,'completed',now()+interval '24 hours')`;
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any, options: any) => {
        const u = String(input);
        if (
          u === "https://queue.fal.run/fal-ai/flux-lora-fast-training" &&
          options.method === "POST"
        ) {
          state.submits++;
          const body = JSON.parse(options.body);
          expect(body.images_data_url).toContain(
            "fixture.r2.example/training/datasets/"
          );
          expect(body.steps).toBe(800);
          if (state.mode === "rejected")
            return new Response("{}", { status: 422 });
          if (state.mode === "ambiguous")
            throw new TypeError("Fixture interrupted after request send");
          return Response.json({
            request_id: "fixture_train",
            status_url:
              "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/fixture_train/status",
            response_url:
              "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/fixture_train",
            cancel_url:
              "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/fixture_train/cancel",
          });
        }
        if (
          u ===
          "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/fixture_train/status"
        )
          return Response.json({
            status: state.providerStatus,
            ...(state.providerError
              ? { error: "fixture terminal failure" }
              : { queue_position: 2 }),
          });
        if (
          u ===
            "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/fixture_train/cancel" &&
          options.method === "PUT"
        ) {
          state.cancelCalls++;
          return Response.json(
            { status: "CANCELLATION_REQUESTED" },
            { status: 202 }
          );
        }
        if (
          u ===
          "https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/fixture_train"
        )
          return Response.json({
            diffusers_lora_file: {
              url: "https://v3.fal.media/files/fixture.safetensors",
            },
          });
        if (u === "https://v3.fal.media/files/fixture.safetensors") {
          state.weightDownloads++;
          return new Response(
            state.mode === "invalid_model"
              ? Buffer.from("not weights")
              : weights
          );
        }
        if (
          u === "https://queue.fal.run/fal-ai/flux-lora" &&
          options.method === "POST"
        )
          return Response.json({
            request_id: "fixture_render",
            status_url:
              "https://queue.fal.run/fal-ai/flux-lora/requests/fixture_render/status",
            response_url:
              "https://queue.fal.run/fal-ai/flux-lora/requests/fixture_render",
          });
        if (
          u ===
          "https://queue.fal.run/fal-ai/flux-lora/requests/fixture_render/status"
        ) {
          if (state.renderStatus === "error")
            throw new Error("Fixture uncertain render polling");
          return Response.json({
            status: state.renderStatus,
            ...(state.providerError
              ? { error: "fixture terminal failure" }
              : {}),
          });
        }
        if (
          u === "https://queue.fal.run/fal-ai/flux-lora/requests/fixture_render"
        )
          return Response.json({
            images: [{ url: "https://v3.fal.media/files/render.jpg" }],
          });
        throw new Error(
          `Unexpected fixture HTTP request blocked: ${new URL(u).origin}`
        );
      })
    );
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    await pg.end();
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
    delete process.env.FAL_API_KEY;
  });
  const caller = (id = 1) =>
    trainingRouter.createCaller({
      user: { id, role: "user", loginMethod: "email" } as any,
      session: null,
      ip: "127.0.0.1",
    });
  const input = () => ({
    requestId: randomUUID(),
    name: "QA product",
    type: "product" as const,
    triggerWord: "qaproduct_xyz",
    steps: 800 as const,
    imageKeys: [0, 1, 2, 3, 4].map(i => `uploads/training_fixture_${i}.jpg`),
  });
  async function ready() {
    const job = await caller().create(input());
    await caller().prepare({ id: job.id });
    return job;
  }
  async function queued() {
    const job = await ready();
    await caller().submit({ id: job.id, quotedCredits: 10000 });
    return job;
  }
  async function wallet() {
    return (
      await pg`SELECT balance,"bonusCredits","lifetimeSpent" FROM "creditBalances" WHERE "userId"=1`
    )[0];
  }

  it("prepares a private bounded ZIP, submits once under races, saves private actual weights and downloads only for owner", async () => {
    const job = await ready();
    expect(await wallet()).toMatchObject({
      balance: 20000,
      bonusCredits: 15000,
    });
    const prepared = await jobs.getTrainingJob(1, job.id);
    expect(prepared?.archiveKey).toMatch(/^training\/datasets\//);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        caller().submit({ id: job.id, quotedCredits: 10000 })
      )
    );
    expect(state.submits).toBe(1);
    expect(results.some(x => x.state === "queued")).toBe(true);
    expect(await wallet()).toMatchObject({
      balance: 10000,
      bonusCredits: 10000,
      lifetimeSpent: 10000,
    });
    state.providerStatus = "COMPLETED";
    await Promise.all([
      caller().refresh({ id: job.id }),
      caller().refresh({ id: job.id }),
    ]);
    const saved = await jobs.getTrainingJob(1, job.id);
    expect(saved?.state).toBe("succeeded");
    expect(state.weightDownloads).toBe(1);
    expect(
      (
        await pg`SELECT "isPrivate","ownerUserId" FROM "mediaAssets" WHERE key=${saved!.modelKey}`
      )[0]
    ).toMatchObject({ isPrivate: true, ownerUserId: 1 });
    expect((await caller().download({ id: job.id })).url).toContain(
      "fixture.r2.example/training/models/"
    );
    await expect(caller(2).download({ id: job.id })).rejects.toThrow(
      "not found"
    );
    expect(await resolveOwnedTrainingModel(1, job.id)).toMatchObject({
      id: job.id,
      creditCost: 420,
    });
    expect(
      Number(
        (
          await pg`SELECT count(*) n FROM "creditTransactions" WHERE "txType"='usage'`
        )[0].n
      )
    ).toBe(1);
  });
  it("rejects foreign/private-revoked/expired uploads and an expired Agency plan before provider/debit", async () => {
    await expect(caller(2).create(input())).rejects.toThrow("private uploads");
    await pg`UPDATE "mediaAssets" SET "revokedAt"=now() WHERE key='uploads/training_fixture_0.jpg'`;
    await expect(caller().create(input())).rejects.toThrow("private uploads");
    await pg`UPDATE "mediaAssets" SET "revokedAt"=NULL,"createdAt"=now()-interval '2 days'`;
    await expect(caller().create(input())).rejects.toThrow("private uploads");
    await pg`UPDATE "mediaAssets" SET "createdAt"=now()`;
    await pg`UPDATE "userSubscriptions" SET "currentPeriodEnd"=now()-interval '1 second'`;
    await expect(caller().create(input())).rejects.toThrow("Agency");
    expect(state.submits).toBe(0);
    expect((await wallet()).balance).toBe(20000);
  });
  it("enforces three slots atomically under concurrent creates and preserves immutable request content", async () => {
    const draft = input();
    const prior = await caller().create(draft);
    expect((await caller().create(draft)).id).toBe(prior.id);
    await expect(
      caller().create({ ...draft, name: "changed" })
    ).rejects.toThrow("already used");
    const result = await Promise.allSettled(
      Array.from({ length: 6 }, () => caller().create(input()))
    );
    expect(result.filter(x => x.status === "fulfilled")).toHaveLength(2);
    expect(Number((await pg`SELECT count(*) n FROM "trainingJobs"`)[0].n)).toBe(
      3
    );
  });
  it("accepts only completed training-purpose upload proof and deletes dataset images after their last active job", async () => {
    await pg`UPDATE "mediaUploads" SET purpose='timeline' WHERE key='uploads/training_fixture_0.jpg'`;
    await expect(caller().create(input())).rejects.toThrow("private uploads");
    await pg`UPDATE "mediaUploads" SET purpose='training',state='open' WHERE key='uploads/training_fixture_0.jpg'`;
    await expect(caller().create(input())).rejects.toThrow("private uploads");
    await pg`UPDATE "mediaUploads" SET state='completed'`;
    const first = await caller().create(input()),
      second = await caller().create(input());
    await caller().delete({ id: first.id });
    expect(
      (
        await pg`SELECT count(*) n FROM "mediaAssets" WHERE key LIKE 'uploads/%' AND "revokedAt" IS NOT NULL`
      )[0].n
    ).toBe("0");
    await caller().delete({ id: second.id });
    expect(
      (
        await pg`SELECT count(*) n FROM "mediaAssets" WHERE key LIKE 'uploads/%' AND "revokedAt" IS NOT NULL`
      )[0].n
    ).toBe("5");
    await expect(caller().create(input())).rejects.toThrow("private uploads");
  });
  it("discards only owned unused training uploads and preserves foreign, timeline and active dataset keys", async () => {
    const imageKeys = input().imageKeys;
    expect(await caller(2).discardImages({ imageKeys })).toEqual({
      discarded: 0,
    });
    await pg`UPDATE "mediaUploads" SET purpose='timeline' WHERE key=${imageKeys[0]}`;
    expect(await caller().discardImages({ imageKeys: [imageKeys[0]] })).toEqual(
      { discarded: 0 }
    );
    await pg`UPDATE "mediaUploads" SET purpose='training'`;
    const job = await caller().create(input());
    expect(await caller().discardImages({ imageKeys })).toEqual({
      discarded: 0,
    });
    await caller().cancel({ id: job.id });
    expect(await caller().discardImages({ imageKeys: [imageKeys[0]] })).toEqual(
      { discarded: 1 }
    );
    expect(
      (
        await pg`SELECT count(*) n FROM "mediaAssets" WHERE key LIKE 'uploads/%' AND "revokedAt" IS NULL`
      )[0].n
    ).toBe("4");
  });
  it("rechecks upload revocation inside the owner lock after a concurrent dataset deletion", async () => {
    let unlock!: () => void, locked!: () => void, read!: () => void;
    const release = new Promise<void>(resolve => {
        unlock = resolve;
      }),
      ready = new Promise<void>(resolve => {
        locked = resolve;
      }),
      imageRead = new Promise<void>(resolve => {
        read = resolve;
      });
    const holder = pg.begin(async tx => {
      await tx`SELECT id FROM users WHERE id=1 FOR UPDATE`;
      await tx`UPDATE "mediaAssets" SET "revokedAt"=now() WHERE key='uploads/training_fixture_0.jpg'`;
      locked();
      await release;
    });
    await ready;
    state.onImageRead = () => {
      state.onImageRead = undefined;
      read();
    };
    const request = caller().create(input()),
      assertion = expect(request).rejects.toThrow("private uploads");
    await imageRead;
    unlock();
    await holder;
    await assertion;
    expect((await pg`SELECT count(*) n FROM "trainingJobs"`)[0].n).toBe("0");
  });
  it("refunds a confirmed submit rejection exactly once with purchased provenance", async () => {
    const job = await ready();
    state.mode = "rejected";
    expect(
      (await caller().submit({ id: job.id, quotedCredits: 10000 })).state
    ).toBe("failed");
    await caller().submit({ id: job.id, quotedCredits: 10000 });
    expect(state.submits).toBe(1);
    expect(await wallet()).toMatchObject({
      balance: 20000,
      bonusCredits: 15000,
      lifetimeSpent: 0,
    });
    expect(
      Number(
        (
          await pg`SELECT count(*) n FROM "creditTransactions" WHERE "txType"='refund'`
        )[0].n
      )
    ).toBe(1);
  });
  it("recovers preparation and completion acknowledgments without revoking committed artifacts", async () => {
    const job = await caller().create(input());
    state.lostPreparationAck = true;
    expect((await caller().prepare({ id: job.id })).state).toBe(
      "ready_to_submit"
    );
    const prepared = await jobs.getTrainingJob(1, job.id);
    expect(
      (
        await pg`SELECT "revokedAt" FROM "mediaAssets" WHERE key=${prepared!.archiveKey}`
      )[0].revokedAt
    ).toBeNull();
    await caller().submit({ id: job.id, quotedCredits: 10000 });
    state.providerStatus = "COMPLETED";
    state.lostCompletionAck = true;
    expect((await caller().refresh({ id: job.id })).state).toBe("succeeded");
    const saved = await jobs.getTrainingJob(1, job.id);
    expect(
      (
        await pg`SELECT "revokedAt" FROM "mediaAssets" WHERE key=${saved!.modelKey}`
      )[0].revokedAt
    ).toBeNull();
    expect(state.submits).toBe(1);
  });
  it("rechecks dataset expiry and Agency entitlement immediately before submission without charging", async () => {
    const job = await ready();
    await pg`UPDATE "userSubscriptions" SET "currentPeriodEnd"=now()-interval '1 second'`;
    await expect(
      caller().submit({ id: job.id, quotedCredits: 10000 })
    ).rejects.toThrow("Agency");
    await pg`UPDATE "userSubscriptions" SET "currentPeriodEnd"=now()+interval '1 day'`;
    await pg`UPDATE "mediaAssets" SET "createdAt"=now()-interval '2 days' WHERE key LIKE 'uploads/%'`;
    await expect(
      caller().submit({ id: job.id, quotedCredits: 10000 })
    ).rejects.toThrow("private uploads");
    expect((await wallet()).balance).toBe(20000);
    expect(state.submits).toBe(0);
  });
  it("requires verified non-public private storage before a training or custom-image paid claim", async () => {
    const job = await ready();
    state.privateReady = false;
    await expect(
      caller().submit({ id: job.id, quotedCredits: 10000 })
    ).rejects.toThrow("Private storage");
    expect((await wallet()).balance).toBe(20000);
    expect(state.submits).toBe(0);
    expect((await caller().policy()).providerAvailable).toBe(false);
    state.privateReady = true;
    await caller().submit({ id: job.id, quotedCredits: 10000 });
    state.providerStatus = "COMPLETED";
    await caller().refresh({ id: job.id });
    state.privateReady = false;
    await expect(resolveOwnedTrainingModel(1, job.id)).rejects.toThrow(
      "Private storage"
    );
    expect((await wallet()).balance).toBe(10000);
  });
  it("holds an ambiguous paid submission without provider replay or automatic refund", async () => {
    const job = await ready();
    state.mode = "ambiguous";
    expect(
      (await caller().submit({ id: job.id, quotedCredits: 10000 })).state
    ).toBe("reconciliation");
    await caller().submit({ id: job.id, quotedCredits: 10000 });
    await caller().refresh({ id: job.id });
    expect(state.submits).toBe(1);
    expect((await wallet()).balance).toBe(10000);
  });
  it("a lost atomic-debit acknowledgment never submits and does not charge twice", async () => {
    const job = await ready();
    state.lostSubmissionAck = true;
    expect(
      (await caller().submit({ id: job.id, quotedCredits: 10000 })).state
    ).toBe("submitting");
    await caller().submit({ id: job.id, quotedCredits: 10000 });
    expect(state.submits).toBe(0);
    expect((await wallet()).balance).toBe(10000);
  });
  it("ledger failure rolls back state and debit; exact request safely submits after rollback", async () => {
    const job = await ready();
    await pg
      .unsafe(
        `CREATE FUNCTION reject_training_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description='Custom model training' THEN RAISE EXCEPTION 'fixture ledger rejection'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_training_ledger BEFORE INSERT ON "creditTransactions" FOR EACH ROW EXECUTE FUNCTION reject_training_ledger();`
      )
      .simple();
    expect(
      (await caller().submit({ id: job.id, quotedCredits: 10000 })).state
    ).toBe("ready_to_submit");
    expect((await wallet()).balance).toBe(20000);
    expect(state.submits).toBe(0);
    await pg
      .unsafe(
        'DROP TRIGGER reject_training_ledger ON "creditTransactions"; DROP FUNCTION reject_training_ledger()'
      )
      .simple();
    expect(
      (await caller().submit({ id: job.id, quotedCredits: 10000 })).state
    ).toBe("queued");
    expect(state.submits).toBe(1);
  });
  it("terminal COMPLETED error and invalid weights both refund once", async () => {
    const job = await queued();
    state.providerStatus = "COMPLETED";
    state.providerError = true;
    expect((await caller().refresh({ id: job.id })).state).toBe("failed");
    await caller().refresh({ id: job.id });
    expect((await wallet()).balance).toBe(20000);
    await pg`TRUNCATE "trainingJobs" RESTART IDENTITY`;
    state.providerError = false;
    state.mode = "invalid_model";
    const second = await queued();
    expect((await caller().refresh({ id: second.id })).state).toBe("failed");
    expect((await wallet()).balance).toBe(20000);
  });
  it("cancel 202 stays pending and holds credits until provider terminal confirmation", async () => {
    const job = await queued();
    expect((await caller().cancel({ id: job.id })).state).toBe(
      "cancel_requested"
    );
    expect(state.cancelCalls).toBe(1);
    expect((await wallet()).balance).toBe(10000);
    state.providerStatus = "COMPLETED";
    state.providerError = true;
    await caller().refresh({ id: job.id });
    expect((await wallet()).balance).toBe(20000);
  });
  it("late model completion after atomic account deletion cannot upload or restore data", async () => {
    const job = await queued();
    state.providerStatus = "COMPLETED";
    state.beforeModelPut = async () => {
      await state.db.batch([
        state.db.execute(
          (await import("drizzle-orm"))
            .sql`SELECT id FROM users WHERE id=1 FOR UPDATE`
        ),
        ...jobs.trainingDeletionQueries(state.db, 1),
        state.db.execute(
          (await import("drizzle-orm"))
            .sql`UPDATE "mediaAssets" SET "revokedAt"=now() WHERE "ownerUserId"=1`
        ),
        state.db.execute(
          (await import("drizzle-orm"))
            .sql`UPDATE users SET "loginMethod"='deleted' WHERE id=1`
        ),
      ]);
    };
    await expect(caller().refresh({ id: job.id })).rejects.toThrow("not found");
    expect(
      (
        await pg`SELECT state,"imageKeys","modelKey" FROM "trainingJobs" WHERE id=${job.id}`
      )[0]
    ).toMatchObject({ state: "deleted", imageKeys: [], modelKey: null });
    expect(
      (
        await pg`SELECT count(*) n FROM "mediaAssets" WHERE key LIKE 'training/models/%'`
      )[0].n
    ).toBe("0");
  });
  it("download survives plan expiry but generation is denied, and deleting a model revokes its assets", async () => {
    const job = await queued();
    state.providerStatus = "COMPLETED";
    await caller().refresh({ id: job.id });
    await pg`UPDATE "userSubscriptions" SET "currentPeriodEnd"=now()-interval '1 second'`;
    expect((await caller().download({ id: job.id })).url).toContain(
      "signed=fixture"
    );
    await expect(resolveOwnedTrainingModel(1, job.id)).rejects.toThrow(
      "Agency"
    );
    await caller().delete({ id: job.id });
    expect(await jobs.getTrainingJob(1, job.id)).toBeUndefined();
    expect(
      (
        await pg`SELECT count(*) n FROM "mediaAssets" WHERE key LIKE 'training/%' AND "revokedAt" IS NULL`
      )[0].n
    ).toBe("0");
  });
  it("accepted custom-image polling failures are explicitly uncertain, not refundable rejections", async () => {
    const job = await queued();
    state.providerStatus = "COMPLETED";
    await caller().refresh({ id: job.id });
    const accepted = vi.fn(async () => {});
    await expect(
      executeOwnedTrainingImage({
        userId: 1,
        trainedModelId: job.id,
        prompt: "product photo",
        width: 512,
        height: 768,
        onProviderAccepted: accepted,
      })
    ).rejects.toBeInstanceOf(TrainingImageOutcomeUncertain);
    expect(accepted).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "fixture_render" })
    );
  }, 10_000);
  async function acceptedImage() {
    const model = await queued();
    state.providerStatus = "COMPLETED";
    await caller().refresh({ id: model.id });
    const requestId = randomUUID(),
      claim = await claimGenerationRequest({
        userId: 1,
        requestId,
        payloadHash: "a".repeat(64),
        credits: 210,
      });
    if (claim.kind !== "owned")
      throw new Error("Fixture did not acquire generation");
    const receipt = {
      requestId: "fixture_render",
      statusUrl:
        "https://queue.fal.run/fal-ai/flux-lora/requests/fixture_render/status",
      responseUrl:
        "https://queue.fal.run/fal-ai/flux-lora/requests/fixture_render",
      acceptedAt: new Date().toISOString(),
    };
    const metadata = {
      billingRequestId: requestId,
      trainedModelId: model.id,
      customTrainingReceipt: receipt,
    };
    const [generation] =
      await pg`INSERT INTO generations ("userId",prompt,"mediaType",width,height,status,metadata) VALUES (1,'product','image',512,768,'generating',${JSON.stringify(metadata)}::jsonb) RETURNING id`;
    await beginGenerationRequest(claim.owner, Number(generation.id));
    await markGenerationReconciliation(claim.owner, {
      errorCode: "custom-pending",
      generationId: Number(generation.id),
    });
    return { requestId, modelId: model.id };
  }
  it("recovers an accepted custom image after reload and plan expiry without another provider submit/debit", async () => {
    const image = await acceptedImage();
    const before = await wallet();
    await pg`UPDATE "userSubscriptions" SET "currentPeriodEnd"=now()-interval '1 second'`;
    state.renderStatus = "COMPLETED";
    const result = await Promise.all([
      caller().imageStatus({ requestId: image.requestId }),
      caller().imageStatus({ requestId: image.requestId }),
    ]);
    expect(result.some(x => x.status === "completed")).toBe(true);
    const replay = await caller().imageStatus({ requestId: image.requestId });
    expect(replay).toMatchObject({
      status: "completed",
      creditCost: 210,
      modelId: `custom-trained:${image.modelId}`,
    });
    expect(await wallet()).toEqual(before);
    expect(state.submits).toBe(1);
    await expect(
      caller(2).imageStatus({ requestId: image.requestId })
    ).rejects.toThrow("not found");
  });
  it("refunds the original custom image once when its durable provider receipt reports failure", async () => {
    const image = await acceptedImage();
    const before = await wallet();
    state.renderStatus = "COMPLETED";
    state.providerError = true;
    await Promise.all([
      caller().imageStatus({ requestId: image.requestId }),
      caller().imageStatus({ requestId: image.requestId }),
    ]);
    expect(
      await caller().imageStatus({ requestId: image.requestId })
    ).toMatchObject({ status: "failed", refundedCredits: 210 });
    expect((await wallet()).balance).toBe(before.balance + 210);
    expect(
      (
        await pg`SELECT count(*) n FROM "creditTransactions" WHERE "txType"='refund'`
      )[0].n
    ).toBe("1");
  });
  it("background recovery saves actual model weights with the browser closed and expires unpaid drafts without a charge", async () => {
    const training = await queued(),
      draft = await caller().create(input());
    await pg`UPDATE "trainingJobs" SET "expiresAt"=now()-interval '1 second' WHERE id=${draft.id}`;
    state.providerStatus = "COMPLETED";
    const report = await sweepOwnedTrainingJobs();
    expect(report).toMatchObject({ expired: 1, polled: 1, errors: 0 });
    expect((await jobs.getTrainingJob(1, training.id))?.state).toBe(
      "succeeded"
    );
    expect((await jobs.getTrainingJob(1, draft.id))?.state).toBe("canceled");
    expect((await wallet()).balance).toBe(10000);
    expect(state.submits).toBe(1);
  });
  it("background recovery completes custom images without resubmitting and blocks model deletion while paid images are pending", async () => {
    const image = await acceptedImage();
    await expect(caller().delete({ id: image.modelId })).rejects.toThrow(
      "Finish"
    );
    await expect(jobs.deleteTrainingJob(1, image.modelId)).rejects.toThrow(
      "Finish"
    );
    expect((await jobs.getTrainingJob(1, image.modelId))?.state).toBe(
      "succeeded"
    );
    state.renderStatus = "COMPLETED";
    expect(await sweepOwnedTrainingJobs()).toMatchObject({
      polled: 1,
      errors: 0,
    });
    expect(
      await caller().imageStatus({ requestId: image.requestId })
    ).toMatchObject({ status: "completed", creditCost: 210 });
    expect(state.submits).toBe(1);
    expect((await wallet()).balance).toBe(9790);
    await caller().delete({ id: image.modelId });
  });
});
