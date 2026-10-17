import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ batches: [] as unknown[][], update: vi.fn(), refund: vi.fn(), sweep: vi.fn(),trainingSweep:vi.fn(),animationSweep:vi.fn() }));
vi.mock('./_core/modelTraining',()=>({sweepOwnedTrainingJobs:(...args:unknown[])=>mocks.trainingSweep(...args)}));
vi.mock('./_core/imageAnimation',()=>({sweepImageAnimations:(...args:unknown[])=>mocks.animationSweep(...args)}));
vi.mock("./db", () => ({ getDb: vi.fn(async () => {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "from", "where", "orderBy"]) chain[name] = () => chain;
  chain.limit = async () => mocks.batches.shift() ?? [];
  chain.update = mocks.update;
  return chain;
}) }));
vi.mock("./stripe", () => ({ refundCredits: (...args: unknown[]) => mocks.refund(...args) }));
vi.mock("./_core/generationBilling", () => ({ sweepStaleGenerationRequests: (...args: unknown[]) => mocks.sweep(...args) }));
vi.mock("./_core/generationBatchBilling", () => ({ sweepGenerationBatches: vi.fn(async () => {}) }));
import { GET } from "../app/api/cron/stale-generations/route";

describe("stale generation request ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CRON_SECRET", "local-test-only");
    mocks.batches = [[], []];
    mocks.sweep.mockResolvedValue({ kind: "swept", refunded: 2, reconciliation: 1 });
    mocks.refund.mockResolvedValue({ success: true });
    mocks.trainingSweep.mockResolvedValue({expired:0,polled:1,errors:0});
    mocks.animationSweep.mockResolvedValue({checked:2,completed:1,failed:0,pending:1,errors:0});
  });
  it("does not let the legacy reaper independently mark or refund an owned request", async () => {
    mocks.batches[0] = [{ id: 8, userId: 2, mediaType: "image", status: "generating", metadata: { billingRequestId: "114bdd89-cd2b-4b77-8ad3-857220ed45ed", quotedCredits: 15 } }];
    const response = await GET(new Request("http://localhost/api/cron/stale-generations", { headers: { Authorization: "Bearer local-test-only" } }));
    expect(await response.json()).toMatchObject({ refunded: 2, requestReconciliation: 1, requestSweepUncertain: false });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(mocks.sweep).toHaveBeenCalledWith({ olderThanMinutes: 15, limit: 200 });
  });
  it("reports uncertain request settlement without claiming a refund", async () => {
    mocks.sweep.mockResolvedValue({ kind: "uncertain" });
    const response = await GET(new Request("http://localhost/api/cron/stale-generations", { headers: { Authorization: "Bearer local-test-only" } }));
    expect(await response.json()).toMatchObject({ refunded: 0, errors: 1, requestSweepUncertain: true });
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("does not refund a scrubbed deleted generation after its billing metadata is erased", async () => {
    mocks.batches[0] = [{ id: 8, userId: 2, mediaType: "image", status: "generating", metadata: { deleted: true } }];
    await GET(new Request("http://localhost/api/cron/stale-generations", { headers: { Authorization: "Bearer local-test-only" } }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("does not begin reconciliation for an unauthorized request", async () => {
    expect((await GET(new Request("http://localhost/api/cron/stale-generations"))).status).toBe(403);
    expect(mocks.sweep).not.toHaveBeenCalled();
    expect(mocks.trainingSweep).not.toHaveBeenCalled();
    expect(mocks.animationSweep).not.toHaveBeenCalled();
  });
  it('runs bounded receipt recovery and continues legacy maintenance if one recovery group fails',async()=>{
    mocks.trainingSweep.mockRejectedValueOnce(new Error('fixture unavailable'));
    const response=await GET(new Request('http://localhost/api/cron/stale-generations',{headers:{Authorization:'Bearer local-test-only'}}));
    expect(await response.json()).toMatchObject({trainingRecovery:{errors:1},animationRecovery:{checked:2,completed:1},requestRefunded:2});
    expect(mocks.animationSweep).toHaveBeenCalledWith(2);expect(mocks.sweep).toHaveBeenCalledTimes(1);
  });
});
