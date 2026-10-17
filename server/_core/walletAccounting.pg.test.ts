import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ db: null as any, images: 0 }));
vi.mock("stripe", () => ({default:class StripeFixture {
  checkout={sessions:{retrieve:async(id:string)=>({id,mode:"payment",status:"complete",payment_status:"paid",currency:"usd",amount_subtotal:499,amount_total:499,total_details:{amount_discount:0},payment_intent:"pi_retry",metadata:{user_id:"1",package_id:"starter",credits:"100"},line_items:{has_more:false,data:[{quantity:1,price:{unit_amount:499,currency:"usd"}}]}})}};
}}));
vi.mock("../db", async original => {
  const schema = await import("../../drizzle/schema");
  const {eq} = await import("drizzle-orm");
  return { ...(await original<Record<string, unknown>>()), getDb: async () => state.db,
    findGenerationsByRequestId: async()=>[],
    createGeneration: async(data:any)=>Number((await state.db.insert(schema.generations).values(data).returning({id:schema.generations.id}))[0].id),
    updateGeneration: async(id:number,data:any)=>state.db.update(schema.generations).set(data).where(eq(schema.generations.id,id)),
  };
});
vi.mock("../routersPhase15", () => ({ createNotification: vi.fn(async () => {}) }));
vi.mock("../_core/toolStatus", () => ({ requireToolActive: vi.fn(async () => {}), logToolFailure: vi.fn(async () => {}) }));
vi.mock("../rate-limit", () => ({ enforceRateLimit: vi.fn(async () => {}) }));
vi.mock("../_core/imageGeneration", () => ({ generateImage: vi.fn(async () => { state.images++; await Promise.resolve(); return { url: "https://assets.example/image.png" }; }), refineUnfiltered: vi.fn() }));
vi.mock("../_core/imageGenerationUncensored", () => ({ canSubmitUnfilteredImageJob: () => false }));
vi.mock("../_core/btcpay", () => ({ verifyBTCPayWebhook: () => true, getUncensoredPlanById: () => ({ durationDays: 7, bonusCredits: 60 }) }));
vi.mock("../_core/uncensoredEmail", () => ({ sendPassActivatedEmail: vi.fn(async () => true) }));
import { addCredits, deductCredits, getOrCreateBalance } from "../stripe";
import { allocatePaidSubscriptionInvoice, refreshPaidSubscriptionAllowance } from "./subscriptionBilling";
import { failLegacyJobAndRefund } from "./walletAccounting";
import { claimGenerationBatch, beginGenerationBatch, sweepGenerationBatches } from "./generationBatchBilling";
import { processStripeEvent } from "../../app/api/webhooks/stripe/handler";
import { POST as btcpay } from "../../app/api/webhooks/btcpay/route";
import { uncensoredRouter } from "../routers/uncensored";

const url = process.env.DREAMFORGE_BILLING_TEST_DATABASE_URL;
if (url) {
  const t = new URL(url);
  if (t.hostname !== "127.0.0.1" || t.port !== "55439" || t.pathname !== "/dreamforge_billing_qa" || t.username !== "dreamforge_qa") throw new Error("Owned loopback fixture required.");
}
const suite = url ? describe : describe.skip;
suite("wallet and payment regression on isolated PostgreSQL", () => {
  const schema = "wallet_fixes_qa";
  const admin = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
  const pg = postgres(url!, { max: 12, prepare: false, connection: { options: `-c search_path=${schema}` }, onnotice: () => {} });
  const dialect = new PgDialect();
  const execute = async (query: SQL) => { const q = dialect.sqlToQuery(query); return pg.unsafe(q.sql, q.params.map(p => p instanceof Date ? p.toISOString() : p) as any[]); };
  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY="sk_test_mocked_fixture_only";
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    for (const migration of ["0000_old_stardust", "0003_naive_jack_flag", "0007_uncensored_tier", "0011_webhook_idempotency_clawback", "0014_generation_requests", "0015_wallet_periods_batch_requests"]) {
      const body = (await readFile(new URL(`../../drizzle/${migration}.sql`, import.meta.url), "utf8")).replaceAll('"public".', `"${schema}".`);
      for (const query of body.split("--> statement-breakpoint")) if (query.trim()) await pg.unsafe(query).simple();
    }
    const orm = drizzle(pg);
    state.db = {
      select: orm.select.bind(orm), update: orm.update.bind(orm), insert: orm.insert.bind(orm), delete: orm.delete.bind(orm),
      execute: (query: SQL) => ({ query, then: (resolve: any, reject: any) => execute(query).then(resolve, reject) }),
      batch: async (queries: { query: SQL }[]) => pg.begin(async tx => {
        const results = [];
        for (const query of queries) { const q = dialect.sqlToQuery(query.query); results.push(await tx.unsafe(q.sql, q.params.map(p => p instanceof Date ? p.toISOString() : p) as any[])); }
        return results;
      }),
    };
    await pg.unsafe(`CREATE FUNCTION reject_test_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.description = 'fixture failure' THEN RAISE EXCEPTION 'fixture ledger failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_test_ledger BEFORE INSERT ON "creditTransactions" FOR EACH ROW EXECUTE FUNCTION reject_test_ledger();`).simple();
  }, 30000);
  beforeEach(async () => {
    state.images = 0;
    await pg.unsafe(`TRUNCATE "generationRequests", "generationBatchRequests", generations, "creditTransactions", "webhookEvents", "subscriptionCreditPeriods", "userSubscriptions", "subscriptionPlans", "cryptoInvoices", "creditBalances", users RESTART IDENTITY CASCADE`).simple();
    await pg`INSERT INTO users (id, "openId", email, "uncensoredUntil", "ageConfirmedAt") VALUES (1, 'qa-user', 'qa@example.invalid', now()+interval '7 days', now())`;
    await pg`INSERT INTO "creditBalances" ("userId", balance, "bonusCredits", "walletAccountingVersion", "lastResetAt") VALUES (1, 0, 0, 1, now())`;
    await pg`INSERT INTO "subscriptionPlans" (id,name,"displayName","monthlyCredits") VALUES (1,'pro','Pro',10000)`;
  });
  afterAll(async () => { await pg.end(); await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
  const start = new Date(Math.floor(Date.now()/1000)*1000-60000);
  const end = new Date(start.getTime()+365*86400000);
  const mapping = { invoiceId: "in_fixture", subscriptionId: "sub_fixture", subscriptionItemId: "si_fixture", priceId: "price_fixture", periodStart: start, periodEnd: end };
  async function paid(periodStart = start, periodEnd = end) {
    await pg`INSERT INTO "userSubscriptions" ("userId","planId","stripeSubscriptionId","subStatus","currentPeriodStart","currentPeriodEnd") VALUES (1,1,'sub_fixture','active',${periodStart.toISOString()},${periodEnd.toISOString()})`;
  }
  async function wallet() { return (await pg`SELECT balance,"bonusCredits","lifetimeSpent","walletAccountingVersion" FROM "creditBalances" WHERE "userId"=1`)[0]; }
  it("concurrent duplicate credit pack grants commit one wallet/ledger/receipt", async () => {
    await paid();
    const results = await Promise.all(Array.from({length:8}, () => addCredits(1,100,"pack", "cs_same", "pi_same")));
    expect(results.filter(x => x === "granted")).toHaveLength(1);
    expect(await wallet()).toMatchObject({balance:100,bonusCredits:100});
    expect(Number((await pg`SELECT count(*) AS n FROM "creditTransactions"`)[0].n)).toBe(1);
  });
  it("spent packs cannot resurrect, and unspent purchased credits survive successive allowances", async () => {
    await paid();
    await addCredits(1,100,"pack", "cs_spent", "pi_spent");
    const debit = await deductCredits(1,100,"spend");
    expect(debit).toMatchObject({success:true,purchasedCreditsDebited:100});
    expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
    await allocatePaidSubscriptionInvoice(mapping);
    expect(await wallet()).toMatchObject({balance:10000,bonusCredits:0});
    await addCredits(1,100,"pack", "cs_keep", "pi_keep");
    const old = new Date(start); old.setUTCMonth(old.getUTCMonth()-2);
    await pg`UPDATE "subscriptionCreditPeriods" SET "periodStart"=${old.toISOString()},"lastAllowanceIndex"=0`;
    await pg`UPDATE "userSubscriptions" SET "currentPeriodStart"=${old.toISOString()}`;
    await Promise.all(Array.from({length:6},()=>refreshPaidSubscriptionAllowance(1)));
    expect(await wallet()).toMatchObject({balance:10100,bonusCredits:100});
    await refreshPaidSubscriptionAllowance(1);
    expect(await wallet()).toMatchObject({balance:10100,bonusCredits:100});
  });
  it("ledger failure rolls back failed-job claim, wallet, and purchased refund; retry succeeds once", async () => {
    await paid(); await pg`UPDATE "creditBalances" SET balance=10,"bonusCredits"=10,"lifetimeSpent"=5`;
    const [g] = await pg`INSERT INTO generations ("userId",prompt,"mediaType",status,metadata) VALUES (1,'qa','image','generating','{}') RETURNING id`;
    const input = {table:"generations" as const,id:Number(g.id),userId:1,amount:5,purchasedCredits:5,reason:"fixture failure"};
    await expect(failLegacyJobAndRefund(input)).rejects.toThrow("fixture ledger failure");
    expect((await pg`SELECT status FROM generations WHERE id=${g.id}`)[0].status).toBe("generating");
    expect(await wallet()).toMatchObject({balance:10,bonusCredits:10});
    expect(await failLegacyJobAndRefund({...input,reason:"confirmed failure"})).toBe(true);
    expect(await failLegacyJobAndRefund({...input,reason:"confirmed failure"})).toBe(false);
    expect(await wallet()).toMatchObject({balance:15,bonusCredits:15,lifetimeSpent:0});
  });
  it("failed credit-pack event is automatically recoverable without duplicate grants", async () => {
    await paid();
    const event = {id:"evt_retry",type:"checkout.session.completed",data:{object:{id:"cs_retry",mode:"payment",payment_status:"paid",currency:"usd",amount_total:499,payment_intent:"pi_retry",metadata:{user_id:"1",credits:"100",package_id:"starter"}}}} as any;
    await pg`INSERT INTO "webhookEvents" ("eventId","eventType","webhookStatus") VALUES ('evt_retry','checkout.session.completed','failed')`;
    await processStripeEvent(event,state.db); await processStripeEvent(event,state.db);
    expect(await wallet()).toMatchObject({balance:100,bonusCredits:100});
    expect(Number((await pg`SELECT count(*) AS n FROM "creditTransactions" WHERE "stripeSessionId"='cs_retry'`)[0].n)).toBe(1);
  });
  it("Bitcoin invalidation is terminal under stale settlement and expiration replay", async () => {
    await pg`INSERT INTO "cryptoInvoices" ("userId","invoiceId",plan,"amountUsdCents") VALUES (1,'btc_fixture','uncensored-7d',499)`;
    const send = (type:string) => btcpay({text:async()=>JSON.stringify({type,invoiceId:"btc_fixture"}),headers:new Headers({"btcpay-sig":"fixture"})} as any);
    await send("InvoiceSettled"); expect(await wallet()).toMatchObject({balance:60,bonusCredits:60});
    await send("InvoiceInvalid"); expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
    await send("InvoiceExpired"); await send("InvoiceSettled");
    expect((await pg`SELECT status FROM "cryptoInvoices"`)[0].status).toBe("invalid");
    expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
  });
  it("concurrent actual uncensored router retries render and charge one batch", async () => {
    await paid(); await pg`UPDATE "creditBalances" SET balance=100`;
    const caller = uncensoredRouter.createCaller({user:{id:1,email:"qa@example.invalid"},session:null} as any);
    const input = {requestId:"same_batch_request",prompt:"A fictional adult character walking in a forest"};
    const result = await Promise.allSettled([caller.generate(input),caller.generate(input)]);
    if (!result.some(r=>r.status==="fulfilled")) throw (result[0] as PromiseRejectedResult).reason;
    expect(result.filter(r=>r.status==="fulfilled").length).toBeGreaterThanOrEqual(1);
    expect(state.images).toBe(1);
    expect(await wallet()).toMatchObject({balance:95,lifetimeSpent:5});
    const replay = await caller.generate(input); expect(replay.generationIds).toHaveLength(1); expect(state.images).toBe(1);
    await expect(caller.generate({...input,prompt:"A different fictional adult character"})).rejects.toMatchObject({code:"CONFLICT"});
  });
  it("legacy wallets retain their balance and require approved opening provenance before paid reset", async () => {
    await paid(); await pg`UPDATE "creditBalances" SET balance=77,"bonusCredits"=100,"walletAccountingVersion"=0`;
    await expect(allocatePaidSubscriptionInvoice(mapping)).rejects.toThrow("wallet_accounting_review_required");
    expect(await wallet()).toMatchObject({balance:77,bonusCredits:100,walletAccountingVersion:0});
    expect((await deductCredits(1,5,"legacy spend")).success).toBe(true);
    expect(await wallet()).toMatchObject({balance:72});
  });
  it("actual staged and duplicate refunds revoke the purchased bucket once before renewal", async()=>{
    await paid(); await addCredits(1,100,"pack","cs_refunded","pi_refunded");
    const refund = (id:string,amount:number)=>processStripeEvent({id,type:"charge.refunded",data:{object:{id:"ch_refunded",amount:499,amount_refunded:amount,payment_intent:"pi_refunded"}}} as any,state.db);
    await refund("evt_half",249);
    expect(await wallet()).toMatchObject({balance:50,bonusCredits:50});
    await Promise.all([refund("evt_full_a",499),refund("evt_full_b",499)]);
    expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
    await refund("evt_half",249);
    expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
    await allocatePaidSubscriptionInvoice(mapping);
    expect(await wallet()).toMatchObject({balance:10000,bonusCredits:0});
  });
  it("won disputes restore only their actual purchased debit and survive replay", async()=>{
    await paid(); await addCredits(1,100,"pack","cs_disputed","pi_disputed");
    const created = {id:"evt_dispute",type:"charge.dispute.created",data:{object:{id:"dp_fixture",amount:499,reason:"fraudulent",payment_intent:"pi_disputed",charge:{id:"ch_disputed",amount:499}}}} as any;
    await processStripeEvent(created,state.db); expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
    await processStripeEvent(created,state.db); expect(await wallet()).toMatchObject({balance:0,bonusCredits:0});
    const closed = {id:"evt_won",type:"charge.dispute.closed",data:{object:{id:"dp_fixture",status:"won",payment_intent:"pi_disputed",charge:{id:"ch_disputed"}}}} as any;
    await processStripeEvent(closed,state.db); expect(await wallet()).toMatchObject({balance:100,bonusCredits:100});
    await processStripeEvent(closed,state.db); expect(await wallet()).toMatchObject({balance:100,bonusCredits:100});
  });

  it("lost batch claim and begin acknowledgments never authorize another provider submission", async()=>{
    await paid(); await pg`UPDATE "creditBalances" SET balance=100,"bonusCredits"=100`;
    const execute = state.db.execute;
    let loseClaim = true;
    state.db.execute = (query:SQL) => ({then:async(resolve:any,reject:any)=>{
      try { const value=await execute(query); const text=dialect.sqlToQuery(query).sql;
        if(loseClaim && text.includes('INSERT INTO "generationBatchRequests"')) {loseClaim=false;throw new Error("lost acknowledgment");}
        return resolve(value);
      } catch(error) {return reject(error);}
    }});
    const identity={userId:1,requestId:"lost_claim_fixture",payloadHash:"a".repeat(64),credits:5};
    try {
      expect((await claimGenerationBatch(identity)).kind).toBe("pending");
      expect((await claimGenerationBatch(identity)).kind).toBe("pending");
      expect(await wallet()).toMatchObject({balance:95,bonusCredits:95});
    } finally {state.db.execute=execute;}
    await pg`UPDATE "generationBatchRequests" SET "updatedAt"=now()-interval '20 minutes'`;
    await sweepGenerationBatches(); expect(await wallet()).toMatchObject({balance:100,bonusCredits:100});
    const owned=await claimGenerationBatch({...identity,requestId:"lost_begin_fixture"});
    if(owned.kind!=="owned") throw new Error("Expected a new owned reservation");
    let loseBegin=true;
    state.db.execute=(query:SQL)=>({then:async(resolve:any,reject:any)=>{
      try {const value=await execute(query);if(loseBegin && dialect.sqlToQuery(query).sql.includes("state = 'submitting'")){loseBegin=false;throw new Error("lost begin acknowledgment");}return resolve(value);}catch(error){return reject(error);}
    }});
    try {await expect(beginGenerationBatch(owned.id,owned.token)).rejects.toThrow("lost begin");}
    finally {state.db.execute=execute;}
    expect(await beginGenerationBatch(owned.id,owned.token)).toBe(false);
    await pg`UPDATE "generationBatchRequests" SET "updatedAt"=now()-interval '20 minutes' WHERE id=${owned.id}`;
    await sweepGenerationBatches();
    expect((await pg`SELECT state FROM "generationBatchRequests" WHERE id=${owned.id}`)[0].state).toBe("reconciliation");
    expect(await wallet()).toMatchObject({balance:95,bonusCredits:95});expect(state.images).toBe(0);
  });

});
