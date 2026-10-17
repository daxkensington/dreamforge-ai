import { describe, expect, it } from "vitest";
import {
  emptyPresentationSession,
  generatedPresentation,
  isUnresolvedPresentationJob,
  parsePresentationSession,
  preparePresentationImageJob,
  presentationFilename,
  presentationRequestErrorState,
  savedPresentation,
  settlePresentationImageJob,
} from "./presentation";

const requestId = "11111111-1111-4111-8111-111111111111";
const input = {
  userId: 7,
  prompt: "A useful diagram",
  modelId: "named-model",
  creditCost: 155,
};
const slide = {
  id: "slide-1",
  title: "A title",
  content: "Actual content",
  notes: "Actual notes",
  imagePrompt: "Diagram",
};

describe("presentation image request lifecycle", () => {
  it("unlocks confirmed pre-reservation refusals but preserves ambiguous errors and conflicts", () => {
    for (const code of [
      "BAD_REQUEST",
      "FORBIDDEN",
      "PRECONDITION_FAILED",
      "UNAUTHORIZED",
      "TOO_MANY_REQUESTS",
    ])
      expect(presentationRequestErrorState({ data: { code } })).toBe("failed");
    for (const error of [
      new Error("Network lost"),
      { data: { code: "INTERNAL_SERVER_ERROR" } },
      { data: { code: "SERVICE_UNAVAILABLE" } },
      { data: { code: "CONFLICT" } },
    ])
      expect(presentationRequestErrorState(error)).toBe("uncertain");
  });
  it("freezes exact catalog quote, dimensions and payload before submission", () => {
    expect(
      preparePresentationImageJob(undefined, input, () => requestId)
    ).toEqual({
      userId: 7,
      requestId,
      creditCost: 155,
      state: "pending",
      input: {
        prompt: "A useful diagram",
        modelVersion: "named-model",
        width: 768,
        height: 432,
        mediaType: "image",
        uncensored: false,
      },
    });
  });
  it.each(["pending", "uncertain"] as const)(
    "reuses %s request after an ambiguous response, edited input and catalog repricing",
    state => {
      const previous = {
        ...preparePresentationImageJob(undefined, input, () => requestId),
        state,
      };
      const retry = preparePresentationImageJob(
        previous,
        { ...input, prompt: "Changed", modelId: "other", creditCost: 210 },
        () => {
          throw new Error("Must not allocate another request");
        }
      );
      expect(retry).toBe(previous);
      expect(retry.creditCost).toBe(155);
      expect(retry.input.prompt).toBe("A useful diagram");
    }
  );
  it("never retries a different account's request", () => {
    expect(() =>
      preparePresentationImageJob(
        preparePresentationImageJob(undefined, input, () => requestId),
        { ...input, userId: 8 }
      )
    ).toThrow("another account");
  });
  it("permits an explicit new request after a terminal result", () => {
    const previous = {
      ...preparePresentationImageJob(undefined, input, () => requestId),
      state: "failed" as const,
    };
    expect(
      preparePresentationImageJob(
        previous,
        input,
        () => "22222222-2222-4222-8222-222222222222"
      ).requestId
    ).not.toBe(requestId);
  });
  it("rejects a missing prompt, account or exact quote before requesting", () => {
    for (const value of [
      { ...input, prompt: " " },
      { ...input, userId: 0 },
      { ...input, creditCost: 0 },
      { ...input, creditCost: 1.5 },
    ]) {
      expect(() => preparePresentationImageJob(undefined, value)).toThrow();
    }
  });
  it("keeps pending and malformed completed results unresolved", () => {
    const job = preparePresentationImageJob(undefined, input, () => requestId);
    expect(
      isUnresolvedPresentationJob(
        settlePresentationImageJob(job, { status: "generating" })
      )
    ).toBe(true);
    expect(
      isUnresolvedPresentationJob(
        settlePresentationImageJob(job, { status: "completed" })
      )
    ).toBe(true);
    expect(
      settlePresentationImageJob(job, {
        status: "generating",
        reconciliationRequired: true,
      }).error
    ).toContain("will not render again");
    expect(
      settlePresentationImageJob(job, { status: "failed", error: "Refunded" })
    ).toMatchObject({ state: "failed", error: "Refunded", requestId });
    expect(
      settlePresentationImageJob(job, {
        status: "completed",
        imageUrl: "https://example.test/actual.png",
      }).state
    ).toBe("completed");
  });
});

describe("editable deck and saved retry validation", () => {
  it("retains full Unicode title, content, notes and actual images on JSON roundtrip", () => {
    const deck = {
      version: 1,
      title: "Résumé / 日本語",
      slides: [
        {
          ...slide,
          notes: "Speaker notes: café Ελληνικά العربية 😀",
          imageUrl: "/img/actual.png",
        },
      ],
    };
    expect(savedPresentation.parse(JSON.parse(JSON.stringify(deck)))).toEqual(
      deck
    );
  });
  it("rejects duplicate slide identities and executable/non-image application URLs", () => {
    expect(() =>
      savedPresentation.parse({
        version: 1,
        title: "Deck",
        slides: [slide, slide],
      })
    ).toThrow();
    for (const imageUrl of [
      "javascript:alert(1)",
      "/api/delete",
      "https://user:password@example.test/image.png",
    ]) {
      expect(() =>
        savedPresentation.parse({
          version: 1,
          title: "Deck",
          slides: [{ ...slide, imageUrl }],
        })
      ).toThrow();
    }
  });
  it("restores frozen pending requests only for their own account", () => {
    const session = {
      ...emptyPresentationSession(7),
      deck: { version: 1, title: "Deck", slides: [slide] },
      jobs: {
        "slide-1": preparePresentationImageJob(
          undefined,
          input,
          () => requestId
        ),
      },
    };
    const raw = JSON.stringify(session);
    expect(parsePresentationSession(raw, 7)).toEqual(session);
    expect(() => parsePresentationSession(raw, 8)).toThrow("another account");
    expect(() =>
      parsePresentationSession(JSON.stringify({ ...session, userId: 8 }), 8)
    ).toThrow("another account");
  });
  it("requires real presentation fields instead of accepting storyboard camera directions", () => {
    expect(() =>
      generatedPresentation.parse({
        title: "Storyboard",
        scenes: [{ cameraAngle: "Wide" }],
      })
    ).toThrow();
  });
  it("produces safe useful download filenames", () => {
    expect(presentationFilename("Q4: growth / review?.", "pdf")).toBe(
      "Q4 growth  review.pdf"
    );
    expect(presentationFilename("...", "json")).toBe("presentation.json");
  });
});
