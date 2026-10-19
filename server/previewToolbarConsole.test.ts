import { describe, expect, it } from "vitest";
import { isPreviewToolbarCspCollision, smokeTarget } from "../shared/smoke-target.mjs";

const preview = "https://dreamforgex-example-englandsfinest.vercel.app";
const target = smokeTarget(preview);
const chromium = `Loading the script 'https://vercel.live/_next-live/feedback/feedback.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://connect.facebook.net". Note that 'script-src-elem' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.`;
const webkit = "Refused to load https://vercel.live/_next-live/feedback/feedback.js because it does not appear in the script-src directive of the Content Security Policy.";

describe("exact preview-platform toolbar CSP classification", () => {
  it.each([chromium, webkit])("recognizes only the observed engine grammar on the same protected preview", message => {
    expect(isPreviewToolbarCspCollision(message, target, preview + "/")).toBe(true);
  });

  it.each(["https://dreamforgex.ai", "https://www.dreamforgex.ai", "https://genesis-synth-lab.vercel.app"])("retains the same error as a failure for public production %s", origin => {
    for (const message of [chromium, webkit]) expect(isPreviewToolbarCspCollision(message, smokeTarget(origin), origin + "/")).toBe(false);
  });

  it.each([
    "https://dreamforgex.ai/",
    "https://dreamforgex-other-englandsfinest.vercel.app/",
    "https://dreamforgex-example-englandsfinest.vercel.app.attacker.example/",
    "https://user:pass@dreamforgex-example-englandsfinest.vercel.app/",
    preview + ":8443/",
    "not-a-url",
  ])("rejects final document origin or authority drift %s", documentUrl => {
    expect(isPreviewToolbarCspCollision(chromium, target, documentUrl)).toBe(false);
  });

  it.each([
    "https://vercel.live/_next-live/feedback/feedback.js?query=synthetic",
    "https://vercel.live/_next-live/feedback/feedback.js/",
    "https://vercel.live/_next-live/feedback/other.js",
    "https://vercel.live.attacker.example/_next-live/feedback/feedback.js",
    "https://user:pass@vercel.live/_next-live/feedback/feedback.js",
    "http://vercel.live/_next-live/feedback/feedback.js",
    "https://vercel.live:8443/_next-live/feedback/feedback.js",
  ])("rejects blocked-script query/path/host/authority lookalikes %s", url => {
    for (const message of [chromium, webkit]) {
      expect(isPreviewToolbarCspCollision(message.replace("https://vercel.live/_next-live/feedback/feedback.js", url), target, preview)).toBe(false);
    }
  });

  it.each([
    "TypeError: application handler failed",
    "Failed to load https://vercel.live/_next-live/feedback/feedback.js",
    webkit.replace("script-src directive", "connect-src directive"),
    chromium.replace("https://connect.facebook.net", "https://other.example"),
    chromium.replace("feedback.js", "application.js"),
    chromium + "\nTypeError: application handler failed",
    webkit + " ",
  ])("does not hide other scripts, CSP policies, app errors or unknown grammar %s", message => {
    expect(isPreviewToolbarCspCollision(message, target, preview)).toBe(false);
  });

  it("cannot derive preview status from an untrusted target object or malformed origin", () => {
    for (const unsafe of [{ origin: "https://attacker.example", protectedTarget: true }, { origin: preview + "/path", protectedTarget: true }, { origin: preview + "?mode=preview", protectedTarget: true }, { origin: "https://dreamforgex.ai", protectedTarget: true }]) {
      expect(isPreviewToolbarCspCollision(chromium, unsafe, unsafe.origin)).toBe(false);
    }
  });
});
