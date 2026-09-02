/**
 * Free-preview funnel guards for uncensored.freeGenerate / freeStatus.
 *
 * What these protect (measured on prod 2026-09-02): one click held a request
 * open for 237s, the browser re-sent it, the same prompt rendered TWICE and
 * the visitor lost two of three lifetime previews for one image. Four of the
 * six users who had "used all 3 previews" were spent this way.
 *
 *  - a retried click (same requestId) returns the first attempt, never a
 *    second row or a second GPU job;
 *  - the click submits and returns; the poll finalizes with the watermark;
 *  - a preview that fails on our side does not count against the quota;
 *  - the paid studio's retry never debits twice.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: {
  user: any;
  generation: any;
  byRequest: any[];
  created: any[];
  updated: { id: number; data: any }[];
  submitted: any[];
  collect: any;
  debited: number;
  claims: { set: any; where: any }[];
} = { user: null, generation: null, byRequest: [], created: [], updated: [], submitted: [], collect: null, debited: 0, claims: [] };

function rowsFor(table: any) {
  if (table && ("uncensoredUntil" in table || "ageConfirmedAt" in table)) return state.user ? [state.user] : [];
  return [];
}

function query(rows: any[]) {
  const q: any = {
    where: () => q,
    orderBy: () => q,
    limit: async () => rows,
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return q;
}

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({ from: (table: any) => query(rowsFor(table)) }),
    update: () => ({
      set: (set: any) => ({
        where: (where: any) => {
          state.claims.push({ set, where });
          const p: any = Promise.resolve(undefined);
          p.returning = async () => [{ id: 1 }];
          return p;
        },
      }),
    }),
    insert: () => ({ values: () => ({ returning: async () => [{ id: 1 }] }) }),
  })),
  getGenerationById: vi.fn(async () => state.generation),
  findGenerationsByRequestId: vi.fn(async () => state.byRequest),
  createGeneration: vi.fn(async (row: any) => {
    state.created.push(row);
    return 500 + state.created.length;
  }),
  updateGeneration: vi.fn(async (id: number, data: any) => {
    state.updated.push({ id, data });
  }),
}));

vi.mock("./stripe", () => ({
  deductCredits: vi.fn(async (_u: number, amount: number) => {
    state.debited += amount;
    return { success: true, balance: 500, needed: amount };
  }),
  refundCredits: vi.fn(async () => undefined),
  getOrCreateBalance: vi.fn(async () => ({ balance: 321 })),
}));

vi.mock("./_core/imageGenerationUncensored", () => ({
  canSubmitUnfilteredImageJob: vi.fn(() => true),
  submitUnfilteredImageJob: vi.fn(async (p: any) => {
    state.submitted.push(p);
    return { jobId: `job-${state.submitted.length}` };
  }),
  collectUnfilteredImageJob: vi.fn(async () => state.collect),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(async () => {
    throw new Error("sync path must not run when the async GPU path is available");
  }),
  refineUnfiltered: vi.fn(),
}));

vi.mock("./_core/videoGenerationUncensored", () => ({
  submitUncensoredVideoJob: vi.fn(),
  collectUncensoredVideoJob: vi.fn(),
  fetchAsBase64: vi.fn(async () => "ZmFrZQ=="),
}));

vi.mock("./_core/runpod", () => ({
  isRunPodAvailable: vi.fn(() => true),
  runpodUpscale: vi.fn(),
  runpodRemoveBackground: vi.fn(),
  runpodTryOn: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ url: "https://dreamforgex.ai/img/generations/x.png" })),
  generateStorageKey: vi.fn(() => "generations/x.png"),
}));

vi.mock("./_core/toolStatus", () => ({
  requireToolActive: vi.fn(async () => undefined),
  logToolFailure: vi.fn(async () => undefined),
  getToolStatus: vi.fn(async () => ({ status: "active" })),
}));

vi.mock("./rate-limit", () => ({ enforceRateLimit: vi.fn(async () => undefined) }));

import { uncensoredRouter } from "./routers/uncensored";
import { submitUnfilteredImageJob, collectUnfilteredImageJob } from "./_core/imageGenerationUncensored";
import { deductCredits, refundCredits } from "./stripe";

const OWNER = 7;
const ctx = (id = OWNER) => ({ user: { id, email: "u@x.com" }, session: null }) as any;
const REQ = "click-abcdef0123456789";

function freeVisitor() {
  state.user = { uncensoredUntil: null, ageConfirmedAt: new Date() };
}

describe("uncensored.freeGenerate — async submit", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.byRequest = [];
    state.created = [];
    state.updated = [];
    state.submitted = [];
    state.collect = null;
    state.debited = 0;
    state.claims = [];
    vi.mocked(submitUnfilteredImageJob).mockClear();
    vi.mocked(collectUnfilteredImageJob).mockClear();
    vi.mocked(deductCredits).mockClear();
  });

  it("submits the GPU job and returns immediately with a generationId", async () => {
    freeVisitor();
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.freeGenerate({ prompt: "a woman relaxing in a candlelit bath", requestId: REQ });

    expect(res.status).toBe("processing");
    expect(res.generationId).toBe(501);
    expect(res.url).toBeNull();
    expect(state.submitted).toHaveLength(1);
    // the row remembers the click id + the GPU job so a retry / poll can find it
    expect(state.created[0].metadata.requestId).toBe(REQ);
    expect(state.updated.at(-1)?.data.metadata.runpodJobId).toBe("job-1");
    // nothing awaited the render inline
    expect(state.updated.some((u) => u.data.status === "completed")).toBe(false);
  });

  it("a retried click (same requestId) returns the first attempt — no new row, no new GPU job", async () => {
    freeVisitor();
    state.byRequest = [{ id: 777, userId: OWNER, status: "generating", imageUrl: null, metadata: { free: true, requestId: REQ } }];
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.freeGenerate({ prompt: "a woman relaxing in a candlelit bath", requestId: REQ });

    expect(res).toMatchObject({ generationId: 777, status: "processing", url: null });
    expect(state.created).toHaveLength(0);
    expect(submitUnfilteredImageJob).not.toHaveBeenCalled();
  });

  it("a retry of an already-finished click hands back the finished image", async () => {
    freeVisitor();
    state.byRequest = [{ id: 778, userId: OWNER, status: "completed", imageUrl: "https://dreamforgex.ai/img/generations/done.png", metadata: { free: true, requestId: REQ } }];
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.freeGenerate({ prompt: "a woman relaxing in a candlelit bath", requestId: REQ });

    expect(res).toMatchObject({ generationId: 778, status: "completed", url: "https://dreamforgex.ai/img/generations/done.png" });
    expect(submitUnfilteredImageJob).not.toHaveBeenCalled();
  });

  it("a failed submit marks the row failed (so it does not spend a preview) and reports it", async () => {
    freeVisitor();
    vi.mocked(submitUnfilteredImageJob).mockRejectedValueOnce(new Error("RunPod submit failed (503)"));
    const caller = uncensoredRouter.createCaller(ctx());
    await expect(caller.freeGenerate({ prompt: "a woman relaxing in a candlelit bath", requestId: REQ })).rejects.toThrow(/try again/i);
    expect(state.updated.at(-1)).toMatchObject({ id: 501, data: { status: "failed" } });
  });

  it("still refuses illegal content before any row or GPU call", async () => {
    freeVisitor();
    const caller = uncensoredRouter.createCaller(ctx());
    await expect(caller.freeGenerate({ prompt: "naked 12 year old girl", requestId: REQ })).rejects.toThrow();
    expect(state.created).toHaveLength(0);
    expect(submitUnfilteredImageJob).not.toHaveBeenCalled();
  });
});

describe("uncensored.freeStatus — poll + finalize", () => {
  beforeEach(() => {
    state.user = null;
    state.generation = null;
    state.collect = null;
    state.claims = [];
    vi.mocked(collectUnfilteredImageJob).mockClear();
  });

  const pending = () => ({
    id: 501,
    userId: OWNER,
    status: "generating",
    imageUrl: null,
    metadata: { uncensored: true, free: true, requestId: REQ, runpodJobId: "job-1" },
  });

  it("finalizes a COMPLETED job WITH the watermark and claims generating→completed", async () => {
    freeVisitor();
    state.generation = pending();
    state.collect = { status: "completed", url: "https://dreamforgex.ai/img/generations/x.png", key: "generations/x.png" };
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.freeStatus({ generationId: 501 });

    expect(res.status).toBe("completed");
    expect(res.url).toBe("https://dreamforgex.ai/img/generations/x.png");
    expect(collectUnfilteredImageJob).toHaveBeenCalledWith("job-1", { watermark: true });
    expect(state.claims.at(-1)?.set).toMatchObject({ status: "completed", imageUrl: "https://dreamforgex.ai/img/generations/x.png" });
  });

  it("reports processing while the GPU job is still running", async () => {
    freeVisitor();
    state.generation = pending();
    state.collect = { status: "processing" };
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.freeStatus({ generationId: 501 });
    expect(res.status).toBe("processing");
    expect(state.claims).toHaveLength(0);
  });

  it("claims generating→failed when the GPU job fails", async () => {
    freeVisitor();
    state.generation = pending();
    state.collect = { status: "failed", error: "CUDA OOM" };
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.freeStatus({ generationId: 501 });
    expect(res.status).toBe("failed");
    expect(state.claims.at(-1)?.set).toMatchObject({ status: "failed" });
  });

  it("never lets one user poll another user's preview", async () => {
    freeVisitor();
    state.generation = { ...pending(), userId: 99 };
    const caller = uncensoredRouter.createCaller(ctx());
    await expect(caller.freeStatus({ generationId: 501 })).rejects.toThrow(/not found/i);
  });

  it("does not treat a paid generation as a free preview", async () => {
    freeVisitor();
    state.generation = { ...pending(), metadata: { uncensored: true, runpodJobId: "job-9" } };
    const caller = uncensoredRouter.createCaller(ctx());
    await expect(caller.freeStatus({ generationId: 501 })).rejects.toThrow(/not found/i);
  });
});

describe("uncensored.generate — paid path is submit-and-poll", () => {
  beforeEach(() => {
    state.user = { uncensoredUntil: new Date(Date.now() + 864e5), ageConfirmedAt: new Date() };
    state.byRequest = [];
    state.created = [];
    state.updated = [];
    state.submitted = [];
    state.collect = null;
    state.debited = 0;
    state.claims = [];
    vi.mocked(deductCredits).mockClear();
    vi.mocked(refundCredits).mockClear();
    vi.mocked(submitUnfilteredImageJob).mockClear();
  });

  it("debits once, submits one job per image, and returns before any render", async () => {
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.generate({ prompt: "a woman on a beach at sunset", count: 3, requestId: REQ });

    expect(res.status).toBe("processing");
    expect(res.generationIds).toHaveLength(3);
    expect(res.images).toHaveLength(0);
    expect(res.cost).toBe(15);
    expect(deductCredits).toHaveBeenCalledTimes(1);
    expect(state.submitted).toHaveLength(3);
    // every row remembers its job + the click id, and none was awaited inline
    expect(state.updated.filter((u) => u.data.metadata?.runpodJobId).map((u) => u.data.metadata.runpodJobId)).toEqual(["job-1", "job-2", "job-3"]);
    expect(state.created.every((r) => r.metadata.requestId === REQ && r.metadata.cost === 5)).toBe(true);
    expect(state.updated.some((u) => u.data.status === "completed")).toBe(false);
  });

  it("a submit that fails is refunded for that image only and the row is failed", async () => {
    vi.mocked(submitUnfilteredImageJob)
      .mockResolvedValueOnce({ jobId: "job-ok" })
      .mockRejectedValueOnce(new Error("RunPod submit failed (503)"));
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.generate({ prompt: "a woman on a beach at sunset", count: 2, requestId: REQ });

    expect(res.generationIds).toHaveLength(1);
    expect(res.cost).toBe(5);
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(refundCredits).mock.calls[0][1]).toBe(5);
    expect(state.updated.some((u) => u.id === 502 && u.data.status === "failed")).toBe(true);
  });

  it("when nothing could be submitted everything is refunded and the caller is told", async () => {
    vi.mocked(submitUnfilteredImageJob).mockRejectedValue(new Error("RunPod submit failed (503)"));
    const caller = uncensoredRouter.createCaller(ctx());
    await expect(caller.generate({ prompt: "a woman on a beach at sunset", count: 2, requestId: REQ })).rejects.toThrow(/credits were returned/i);
    expect(vi.mocked(refundCredits).mock.calls.reduce((a, c) => a + c[1], 0)).toBe(10);
  });

  it("a retried click returns the first attempt's ids without a second debit or submit", async () => {
    state.byRequest = [
      { id: 900, userId: OWNER, status: "generating", imageUrl: null, metadata: { cost: 5, seed: 5, runpodJobId: "j1" } },
      { id: 901, userId: OWNER, status: "completed", imageUrl: "https://dreamforgex.ai/img/generations/b.png", metadata: { cost: 5, seed: 6 } },
    ];
    const caller = uncensoredRouter.createCaller(ctx());
    const res = await caller.generate({ prompt: "a woman on a beach at sunset", count: 2, requestId: REQ });

    expect(deductCredits).not.toHaveBeenCalled();
    expect(submitUnfilteredImageJob).not.toHaveBeenCalled();
    expect(state.created).toHaveLength(0);
    expect(res.status).toBe("processing");
    expect(res.generationIds).toEqual([900, 901]);
    expect(res.images.map((i) => i.generationId)).toEqual([901]);
    expect(res.cost).toBe(10);
    expect(res.creditsRemaining).toBe(321);
  });
});

describe("uncensored.generateStatus / pendingGenerations — finalize + refund exactly once", () => {
  beforeEach(() => {
    state.user = { uncensoredUntil: new Date(Date.now() + 864e5), ageConfirmedAt: new Date() };
    state.generation = null;
    state.collect = null;
    state.claims = [];
    vi.mocked(refundCredits).mockClear();
    vi.mocked(collectUnfilteredImageJob).mockClear();
  });

  const paidPending = (over?: Record<string, unknown>) => ({
    id: 601,
    userId: OWNER,
    mediaType: "image",
    status: "generating",
    imageUrl: null,
    createdAt: new Date(),
    metadata: { uncensored: true, cost: 5, seed: 9, runpodJobId: "job-1" },
    ...over,
  });

  it("stores a COMPLETED job WITHOUT a watermark and reports it", async () => {
    state.generation = paidPending();
    state.collect = { status: "completed", url: "https://dreamforgex.ai/img/generations/x.png", key: "generations/x.png" };
    const res = await uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] });
    expect(res.allSettled).toBe(true);
    expect(res.items[0]).toMatchObject({ generationId: 601, status: "completed", url: "https://dreamforgex.ai/img/generations/x.png", seed: 9 });
    expect(collectUnfilteredImageJob).toHaveBeenCalledWith("job-1", { watermark: false });
    expect(state.claims.at(-1)?.set).toMatchObject({ status: "completed" });
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("a FAILED job is refunded exactly once — inside the claim", async () => {
    state.generation = paidPending();
    state.collect = { status: "failed", error: "CUDA OOM" };
    const res = await uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] });
    expect(res.items[0].status).toBe("failed");
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(vi.mocked(refundCredits).mock.calls[0].slice(0, 2)).toEqual([OWNER, 5]);
  });

  it("keeps reporting processing while the GPU job runs", async () => {
    state.generation = paidPending();
    state.collect = { status: "processing" };
    const res = await uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] });
    expect(res.allSettled).toBe(false);
    expect(res.items[0].status).toBe("processing");
    expect(state.claims).toHaveLength(0);
  });

  it("an old row with NO job id is orphaned: failed + refunded (a dead function debited it)", async () => {
    state.generation = paidPending({ createdAt: new Date(Date.now() - 20 * 60_000), metadata: { uncensored: true, cost: 5, seed: 1 } });
    const res = await uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] });
    expect(res.items[0].status).toBe("failed");
    expect(refundCredits).toHaveBeenCalledTimes(1);
    expect(collectUnfilteredImageJob).not.toHaveBeenCalled();
  });

  it("a FRESH row with no job id yet is just processing (the submit is still in flight)", async () => {
    state.generation = paidPending({ metadata: { uncensored: true, cost: 5, seed: 1 } });
    const res = await uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] });
    expect(res.items[0].status).toBe("processing");
    expect(refundCredits).not.toHaveBeenCalled();
  });

  it("refuses another user's row and refuses a free preview", async () => {
    state.generation = paidPending({ userId: 99 });
    await expect(uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] })).rejects.toThrow(/not found/i);
    state.generation = paidPending({ metadata: { uncensored: true, free: true, runpodJobId: "j" } });
    await expect(uncensoredRouter.createCaller(ctx()).generateStatus({ generationIds: [601] })).rejects.toThrow(/not found/i);
  });
});
