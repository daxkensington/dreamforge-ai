import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  llm: vi.fn(),
  run: vi.fn(),
  status: vi.fn(),
  active: vi.fn(),
  rate: vi.fn(),
  configured: true,
}));
vi.mock("./_core/env", () => ({
  ENV: {
    get groqApiKey() {
      return mocks.configured ? "mock-only" : "";
    },
    openaiApiKey: "",
    grokApiKey: "",
    geminiApiKey: "",
    anthropicApiKey: "",
  },
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("./_core/toolStatus", () => ({ requireToolActive: mocks.active }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("./_core/paidToolOperation", () => ({
  KnownPaidToolFailure: class KnownPaidToolFailure extends Error {},
  runPaidToolOperation: mocks.run,
  getPaidToolOperation: mocks.status,
}));
import { KnownPaidToolFailure } from "./_core/paidToolOperation";
import { presentationRouter } from "./routers/presentation";
const input = {
  requestId: "11111111-1111-4111-8111-111111111111",
  topic: "Clean energy for cities",
  slideCount: 3,
  style: "modern" as const,
  audience: "City planners",
};
const deck = {
  title: "Clean energy",
  slides: Array.from({ length: 3 }, (_, i) => ({
    title: `Slide ${i + 1}`,
    content: "Real content\nAnother useful point",
    notes: "Actual speaker notes for the audience.",
    imagePrompt: "A clean energy diagram",
  })),
};
const caller = (user: unknown = { id: 7, role: "user" }) =>
  presentationRouter.createCaller({
    user,
    session: null,
    ip: "127.0.0.1",
  } as never);

describe("presentation-specific draft route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.configured = true;
    mocks.llm.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(deck) } }],
    });
    mocks.active.mockResolvedValue(undefined);
    mocks.rate.mockResolvedValue(undefined);
    mocks.run.mockImplementation(async (operation, execute) => ({
      status: "completed",
      requestId: operation.requestId,
      creditCost: operation.credits,
      result: await execute(),
    }));
  });
  it("uses a validated proper deck schema and an exact durable five-credit operation", async () => {
    const result = await caller().draft(input);
    expect(result).toMatchObject({
      status: "completed",
      creditCost: 5,
      result: deck,
    });
    expect(mocks.run).toHaveBeenCalledWith(
      {
        userId: 7,
        requestId: input.requestId,
        kind: "presentation-draft",
        payload: {
          topic: input.topic,
          slideCount: 3,
          style: "modern",
          audience: input.audience,
        },
        credits: 5,
        description: "Presentation draft (3 slides)",
      },
      expect.any(Function)
    );
    const call = mocks.llm.mock.calls[0][0];
    expect(
      call.response_format.json_schema.schema.properties.slides
    ).toMatchObject({ minItems: 3, maxItems: 3 });
    expect(
      call.response_format.json_schema.schema.properties.slides.items.required
    ).toEqual(["title", "content", "notes", "imagePrompt"]);
    expect(call.messages[0].content).toContain("real speaker notes");
    expect(call.messages[1].content).toBe(
      JSON.stringify({ topic: input.topic, audience: input.audience })
    );
  });
  it("returns a durable replay without invoking LLM again", async () => {
    mocks.run.mockResolvedValue({
      status: "completed",
      requestId: input.requestId,
      creditCost: 5,
      result: deck,
    });
    expect((await caller().draft(input)).result).toEqual(deck);
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it.each([
    "invalid JSON",
    JSON.stringify({ title: "Wrong shape", scenes: [] }),
    JSON.stringify({ ...deck, slides: deck.slides.slice(0, 2) }),
  ])(
    "classifies a received unusable response as a confirmed refundable failure",
    async content => {
      mocks.llm.mockResolvedValue({ choices: [{ message: { content } }] });
      await expect(caller().draft(input)).rejects.toMatchObject({
        cause: expect.any(KnownPaidToolFailure),
      });
    }
  );
  it("keeps upstream transport errors ambiguous instead of labeling them refundable", async () => {
    const error = new Error("Upstream timeout");
    mocks.llm.mockRejectedValue(error);
    await expect(caller().draft(input)).rejects.toMatchObject({ cause: error });
    expect(error).not.toBeInstanceOf(KnownPaidToolFailure);
  });
  it("treats a disabled tool as a confirmed non-execution without an LLM call", async () => {
    mocks.active.mockRejectedValue(new Error("Offline"));
    await expect(caller().draft(input)).rejects.toMatchObject({
      cause: expect.any(KnownPaidToolFailure),
    });
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it("does not invoke or hold credits as ambiguous when no text provider is configured", async () => {
    mocks.configured = false;
    await expect(caller().draft(input)).rejects.toMatchObject({
      cause: expect.any(KnownPaidToolFailure),
    });
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, slideCount: 3.5 },
    { ...input, slideCount: 21 },
    { ...input, requestId: "unsafe" },
    { ...input, topic: " " },
  ])("rejects invalid input before a paid claim", async value => {
    await expect(caller().draft(value)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("requires an active signed-in account", async () => {
    await expect(caller(null).draft(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller({ id: 7, loginMethod: "deleted" }).draft(input)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("scopes saved status by the current account and fixed operation kind", async () => {
    mocks.status.mockResolvedValue({
      status: "pending",
      requestId: input.requestId,
      creditCost: 5,
    });
    await caller().status({ requestId: input.requestId });
    expect(mocks.status).toHaveBeenCalledExactlyOnceWith(
      7,
      "presentation-draft",
      input.requestId
    );
  });
});
