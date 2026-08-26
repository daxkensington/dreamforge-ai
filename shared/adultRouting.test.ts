import { describe, it, expect } from "vitest";
import {
  ADULT_REDIRECT_MESSAGE,
  buildAdultRedirectUrl,
  isAdultRedirect,
} from "./adultRouting";
import { isSexualPrompt, checkPrompt } from "../server/_core/promptModeration";

describe("isSexualPrompt", () => {
  it("flags the explicit prompts real users actually sent", () => {
    // Drawn from prompts that generated free on the standard chain.
    expect(isSexualPrompt("White woman with big tits")).toBe(true);
    expect(isSexualPrompt("Naked white girl with big boobs and small nipples")).toBe(true);
    expect(isSexualPrompt("A completely naked beauty by the seaside.")).toBe(true);
    expect(isSexualPrompt("Porn")).toBe(true);
    expect(isSexualPrompt("wet nude anime girl spreading her legs")).toBe(true);
  });

  it("leaves merely SUGGESTIVE prompts on the standard chain — deliberately", () => {
    // The vocabulary is shared with the safety gate, so widening it to catch
    // these would over-block innocuous prompts there ("kids at the beach").
    // A false positive here pushes a SFW user at an adult paywall, which is a
    // worse failure than letting a suggestive prompt through.
    expect(isSexualPrompt("anime girl in a bikini sitting on the sand")).toBe(false);
    expect(isSexualPrompt("a woman in a swimsuit at the beach")).toBe(false);
  });

  it("catches light leetspeak evasion", () => {
    expect(isSexualPrompt("n4ked woman")).toBe(true);
  });

  it("checks the negative prompt too", () => {
    expect(isSexualPrompt("a portrait", "nude")).toBe(true);
  });

  it("leaves ordinary SFW prompts alone", () => {
    expect(isSexualPrompt("a mountain lake at sunset, cinematic")).toBe(false);
    expect(isSexualPrompt("a synthwave vaporwave mountain landscape at sunrise")).toBe(false);
    expect(isSexualPrompt("an intricate clockwork mechanical hummingbird")).toBe(false);
    expect(isSexualPrompt("a majestic snow leopard portrait, falling snow")).toBe(false);
    expect(isSexualPrompt("create image of lord ganesha, warm divine look")).toBe(false);
    expect(isSexualPrompt("")).toBe(false);
  });

  it("is only a routing signal — the safety gate still refuses illegal prompts", () => {
    // Routing must never become the thing that decides legality: these are
    // adult-flagged AND must be refused outright by checkPrompt.
    const csam = "naked child";
    expect(isSexualPrompt(csam)).toBe(true);
    expect(checkPrompt(csam).allowed).toBe(false);

    const deepfake = "nude taylor swift";
    expect(isSexualPrompt(deepfake)).toBe(true);
    expect(checkPrompt(deepfake).allowed).toBe(false);
  });
});

describe("buildAdultRedirectUrl", () => {
  it("opens the free-preview card and carries the prompt", () => {
    const url = buildAdultRedirectUrl("naked woman on a beach");
    const params = new URLSearchParams(url.split("?")[1]);
    expect(url.startsWith("/uncensored?")).toBe(true);
    expect(params.get("start")).toBe("1");
    expect(params.get("prompt")).toBe("naked woman on a beach");
  });

  it("omits an empty prompt but still opens the card", () => {
    expect(buildAdultRedirectUrl("")).toBe("/uncensored?start=1");
    expect(buildAdultRedirectUrl(null)).toBe("/uncensored?start=1");
    expect(buildAdultRedirectUrl("   ")).toBe("/uncensored?start=1");
  });

  it("caps a very long prompt so the URL stays usable", () => {
    const params = new URLSearchParams(buildAdultRedirectUrl("x".repeat(5000)).split("?")[1]);
    expect(params.get("prompt")!.length).toBe(1000);
  });

  it("encodes characters that would otherwise break the query string", () => {
    const params = new URLSearchParams(buildAdultRedirectUrl("a&b=c?d #e").split("?")[1]);
    expect(params.get("prompt")).toBe("a&b=c?d #e");
  });
});

describe("isAdultRedirect", () => {
  it("recognises the server's signal", () => {
    expect(isAdultRedirect(ADULT_REDIRECT_MESSAGE)).toBe(true);
  });

  it("does not swallow unrelated errors", () => {
    expect(isAdultRedirect("Generation rate limit exceeded")).toBe(false);
    expect(isAdultRedirect("Insufficient credits")).toBe(false);
    expect(isAdultRedirect("")).toBe(false);
    expect(isAdultRedirect(null)).toBe(false);
    expect(isAdultRedirect(undefined)).toBe(false);
  });
});
