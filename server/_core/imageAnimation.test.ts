import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  createImageAnimationService,
  hashAnimationInput,
  KnownAnimationFailure,
  pollImageAnimation,
  submitImageAnimation,
  validateAnimationReceipt,
  type AnimationDependencies,
  type AnimationStored,
} from "./imageAnimation";
import { IMAGE_ANIMATION_POLICY as POLICY } from "../../shared/imageAnimation";
vi.mock("./privateStorage", () => ({
  assertPrivateStorage: vi.fn(async () => ({})),
}));

const input = {
  requestId: "11111111-1111-4111-8111-111111111111",
  generationId: 41,
  prompt: "A gentle camera move across the landscape",
  expectedCreditCost: 1293,
};
const receipt = {
  providerRequestId: "fal-receipt-1",
  statusUrl:
    "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-receipt-1/status",
  responseUrl:
    "https://queue.fal.run/fal-ai/wan-25-preview/requests/fal-receipt-1",
};
function fixture() {
  let stored: AnimationStored | null = null;
  let leased = false;
  const owner = {
    id: 11,
    userId: 7,
    requestId: input.requestId,
    payloadHash: hashAnimationInput(input),
    executionToken: "22222222-2222-4222-8222-222222222222",
  };
  const deps = {
    configured: vi.fn(() => true),
    tier: vi.fn(async () => "creator"),
    active: vi.fn(async () => {}),
    source: vi.fn(async () => ({
      key: "owned.png",
      prompt: "A landscape",
      dataUri: "data:image/jpeg;base64,fixture",
      width: 768,
      height: 432,
    })),
    read: vi.fn(async (userId: number) => (userId === 7 ? stored : null)),
    claim: vi.fn(async () => {
      stored = {
        owner,
        metadata: null,
        request: {
          ...owner,
          quotedCredits: 1293,
          state: "reserved",
          generationId: null,
          result: null,
          errorCode: null,
          debitedAt: new Date(),
          refundedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
      return { kind: "owned", owner, request: stored.request };
    }),
    createOutput: vi.fn(async () => {
      stored!.metadata = {
        tool: "image-animation",
        billingRequestId: input.requestId,
        sourceGenerationId: 41,
      };
      return 91;
    }),
    begin: vi.fn(async () => {
      stored!.request = {
        ...stored!.request,
        generationId: 91,
        state: "rendering",
      };
      return { kind: "begun", request: stored!.request };
    }),
    receipt: vi.fn(async (_: unknown, value: unknown) => {
      stored!.metadata!.animationReceipt = value;
      return true;
    }),
    lease: vi.fn(async () => {
      if (leased) return false;
      leased = true;
      return true;
    }),
    release: vi.fn(async () => {
      leased = false;
    }),
    rememberFailure: vi.fn(async () => {
      stored!.request.errorCode = "animation-known-failure";
      stored!.request.result = { tool: "image-animation" };
    }),
    submit: vi.fn(async () => receipt),
    poll: vi.fn(async () => ({ state: "pending" })),
    materialize: vi.fn(async () => ({
      key: "animation/7/output.mp4",
      url: "/api/media/animation/7/output.mp4",
    })),
    complete: vi.fn(async (_: unknown, value: any) => {
      stored!.request = {
        ...stored!.request,
        state: "completed",
        result: value.result,
      };
      return { kind: "completed", request: stored!.request };
    }),
    fail: vi.fn(async (_: unknown, value: any) => {
      stored!.request = {
        ...stored!.request,
        state: "refunded",
        result: value.result,
        refundedAt: new Date(),
      };
      return { kind: "refunded", request: stored!.request };
    }),
    reconcile: vi.fn(async (_: unknown, value: any) => {
      stored!.request = {
        ...stored!.request,
        state: "reconciliation",
        errorCode: value.errorCode,
      };
      return { kind: "reconciliation", request: stored!.request };
    }),
  };
  return {
    deps,
    service: createImageAnimationService(
      deps as unknown as AnimationDependencies
    ),
    get stored() {
      return stored!;
    },
  };
}

describe("durable queued image animation orchestration", () => {
  it("quotes the verified margin floor and persists a real receipt after one debit/begin", async () => {
    expect(POLICY.creditCost).toBe(1293);
    expect(POLICY.creditCost).toBeGreaterThanOrEqual(0.25 * 5170);
    const f = fixture();
    expect(await f.service.start(7, input)).toMatchObject({
      status: "generating",
      id: 91,
      creditCost: 1293,
      reconciliationRequired: false,
    });
    expect(f.deps.submit).toHaveBeenCalledExactlyOnceWith(
      "data:image/jpeg;base64,fixture",
      input.prompt
    );
    expect(f.deps.claim).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, credits: 1293 })
    );
    expect(f.stored.metadata!.animationReceipt).toEqual(receipt);
    expect(f.deps.begin.mock.invocationCallOrder[0]).toBeLessThan(
      f.deps.submit.mock.invocationCallOrder[0]
    );
  });
  it.each(["configuration", "tier", "quote", "foreign source"])(
    "rejects %s before wallet/provider submission",
    async reason => {
      const f = fixture();
      let value = input;
      if (reason === "configuration") f.deps.configured.mockReturnValue(false);
      if (reason === "tier") f.deps.tier.mockResolvedValue("free");
      if (reason === "quote") value = { ...input, expectedCreditCost: 40 };
      if (reason === "foreign source")
        f.deps.source.mockRejectedValue(new TRPCError({ code: "NOT_FOUND" }));
      await expect(f.service.start(7, value)).rejects.toThrow();
      expect(f.deps.claim).not.toHaveBeenCalled();
      expect(f.deps.submit).not.toHaveBeenCalled();
    }
  );
  it("retries after a lost start response by polling the stored receipt, with no new debit/submit", async () => {
    const f = fixture();
    await f.service.start(7, input);
    f.deps.configured.mockReturnValue(false);
    f.deps.tier.mockResolvedValue("free");
    expect(
      await f.service.start(7, { ...input, expectedCreditCost: 9999 })
    ).toMatchObject({ status: "generating" });
    expect(f.deps.claim).toHaveBeenCalledTimes(1);
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
    expect(f.deps.poll).toHaveBeenCalledExactlyOnceWith(receipt);
  });
  it("recovers a receipt write whose database acknowledgment was lost", async () => {
    const f = fixture();
    f.deps.receipt.mockImplementation(async (_owner, value) => {
      f.stored.metadata!.animationReceipt = value;
      throw new Error("DB acknowledgment lost");
    });
    expect(await f.service.start(7, input)).toMatchObject({
      status: "generating",
      reconciliationRequired: false,
    });
    await f.service.start(7, input);
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
    expect(f.deps.poll).toHaveBeenCalledTimes(1);
  });
  it("does not submit again or blindly refund when submit times out without a receipt", async () => {
    const f = fixture();
    f.deps.submit.mockRejectedValue(new Error("Timeout after acceptance"));
    expect(await f.service.start(7, input)).toMatchObject({
      status: "generating",
      reconciliationRequired: true,
    });
    await f.service.start(7, input);
    await f.service.status(7, input.requestId);
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
    expect(f.deps.fail).not.toHaveBeenCalled();
    expect(f.deps.poll).not.toHaveBeenCalled();
  });
  it("preserves a known failure marker and retries a failed refund without invoking again", async () => {
    const f = fixture();
    f.deps.submit.mockRejectedValue(new KnownAnimationFailure("Rejected"));
    f.deps.fail.mockRejectedValueOnce(new Error("DB refund outage"));
    expect(await f.service.start(7, input)).toMatchObject({
      status: "generating",
      reconciliationRequired: true,
    });
    expect(f.stored.request.errorCode).toBe("animation-known-failure");
    expect(await f.service.status(7, input.requestId)).toMatchObject({
      status: "failed",
      refundedCredits: 1293,
    });
    expect(f.deps.fail).toHaveBeenCalledTimes(2);
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
    expect(f.deps.poll).not.toHaveBeenCalled();
  });
  it("returns a validated private video with provenance and replays completion without provider work", async () => {
    const f = fixture();
    await f.service.start(7, input);
    f.deps.poll.mockResolvedValue({
      state: "completed",
      videoUrl: "https://v3.fal.media/actual.mp4",
    } as never);
    expect(await f.service.status(7, input.requestId)).toMatchObject({
      status: "completed",
      mediaType: "video",
      imageUrl: "/api/media/animation/7/output.mp4",
      creditCost: 1293,
      provenance: {
        sourceGenerationId: 41,
        duration: 5,
        resolution: "480p",
        contentType: "video/mp4",
      },
    });
    expect(f.deps.materialize).toHaveBeenCalledExactlyOnceWith(
      7,
      input.requestId,
      "https://v3.fal.media/actual.mp4"
    );
    await f.service.start(7, input);
    await f.service.status(7, input.requestId);
    expect(f.deps.claim).toHaveBeenCalledTimes(1);
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
    expect(f.deps.poll).toHaveBeenCalledTimes(1);
  });
  it("serializes simultaneous status requests through a durable polling lease", async () => {
    const f = fixture();
    await f.service.start(7, input);
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    f.deps.poll.mockImplementationOnce(async () => {
      await gate;
      return { state: "pending" };
    });
    const first = f.service.status(7, input.requestId);
    await vi.waitFor(() => expect(f.deps.poll).toHaveBeenCalledTimes(1));
    expect(await f.service.status(7, input.requestId)).toMatchObject({
      status: "generating",
    });
    expect(f.deps.poll).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
  it("refunds a confirmed completed provider failure and never marks it as a video success", async () => {
    const f = fixture();
    await f.service.start(7, input);
    f.deps.poll.mockResolvedValue({ state: "failed" });
    expect(await f.service.status(7, input.requestId)).toMatchObject({
      status: "failed",
      refundedCredits: 1293,
    });
    expect(f.deps.complete).not.toHaveBeenCalled();
    expect(f.deps.materialize).not.toHaveBeenCalled();
  });
  it("refunds a received invalid video, but preserves recoverable download failures", async () => {
    const f = fixture();
    await f.service.start(7, input);
    f.deps.poll.mockResolvedValue({
      state: "completed",
      videoUrl: "https://v3.fal.media/actual.mp4",
    } as never);
    f.deps.materialize.mockRejectedValueOnce(new Error("Download timeout"));
    expect(await f.service.status(7, input.requestId)).toMatchObject({
      status: "generating",
      reconciliationRequired: false,
    });
    expect(f.deps.fail).not.toHaveBeenCalled();
    f.deps.materialize.mockRejectedValueOnce(
      new KnownAnimationFailure("PNG is not video")
    );
    expect(await f.service.status(7, input.requestId)).toMatchObject({
      status: "failed",
    });
    expect(f.deps.complete).not.toHaveBeenCalled();
  });
  it("rejects changed payloads and a different account's status", async () => {
    const f = fixture();
    await f.service.start(7, input);
    await expect(
      f.service.start(7, { ...input, generationId: 42 })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(f.service.status(8, input.requestId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(f.deps.submit).toHaveBeenCalledTimes(1);
  });
});

describe("Fal animation queue protocol boundaries", () => {
  beforeEach(() => vi.stubEnv("FAL_API_KEY", "mock-only-not-a-live-key"));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const wireReceipt = {
    request_id: receipt.providerRequestId,
    status_url: receipt.statusUrl,
    response_url: receipt.responseUrl,
  };
  it("submits one pinned five-second 480p safe request and follows only the saved queue URLs", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(wireReceipt))
      .mockResolvedValueOnce(
        Response.json({
          status: "COMPLETED",
          request_id: receipt.providerRequestId,
        })
      )
      .mockResolvedValueOnce(
        Response.json({ video: { url: "https://v3.fal.media/output.mp4" } })
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      await submitImageAnimation("data:image/jpeg;base64,owned", input.prompt)
    ).toEqual(receipt);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      duration: "5",
      resolution: "480p",
      enable_safety_checker: true,
      enable_prompt_expansion: false,
    });
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      redirect: "error",
    });
    expect(await pollImageAnimation(receipt)).toEqual({
      state: "completed",
      videoUrl: "https://v3.fal.media/output.mp4",
    });
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      "https://queue.fal.run/fal-ai/wan-25-preview/image-to-video",
      receipt.statusUrl,
      receipt.responseUrl,
    ]);
  });
  it.each([
    "https://evil.test/status",
    "https://queue.fal.run/other/status",
    receipt.statusUrl + "?redirect=https://evil.test",
    receipt.statusUrl.replace("fal-receipt-1", "other-receipt"),
  ])(
    "rejects an unsafe or mismatched stored receipt before sending credentials",
    async status_url => {
      expect(() =>
        validateAnimationReceipt({ ...wireReceipt, status_url })
      ).toThrow();
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      await expect(
        pollImageAnimation({ ...receipt, statusUrl: status_url })
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    }
  );
  it("distinguishes a confirmed POST rejection from ambiguous server failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 422 }))
        .mockResolvedValueOnce(new Response("", { status: 503 }))
    );
    await expect(
      submitImageAnimation("data:image/jpeg;base64,owned", input.prompt)
    ).rejects.toBeInstanceOf(KnownAnimationFailure);
    await expect(
      submitImageAnimation("data:image/jpeg;base64,owned", input.prompt)
    ).rejects.not.toBeInstanceOf(KnownAnimationFailure);
  });
  it("recognizes Fal's COMPLETED error envelope rather than delivering an empty success", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        status: "COMPLETED",
        error: "Model rejected",
        error_type: "content_policy_violation",
      })
    );
    vi.stubGlobal("fetch", fetch);
    expect(await pollImageAnimation(receipt)).toEqual({ state: "failed" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
