import { describe, it, expect } from "vitest";
import {
  DEFAULT_POST_LOGIN,
  buildSignInUrl,
  resolvePostLogin,
  sanitizeReturnTo,
} from "./returnTo";

describe("sanitizeReturnTo", () => {
  it("accepts same-origin paths, with query and fragment", () => {
    expect(sanitizeReturnTo("/uncensored")).toBe("/uncensored");
    expect(sanitizeReturnTo("/uncensored?start=1")).toBe("/uncensored?start=1");
    expect(sanitizeReturnTo("/tools/upscaler#faq")).toBe("/tools/upscaler#faq");
    expect(sanitizeReturnTo("  /workspace  ")).toBe("/workspace");
  });

  it("rejects anything that could leave the origin", () => {
    // Scheme-relative — the classic open-redirect that passes a startsWith("/") test.
    expect(sanitizeReturnTo("//evil.com")).toBeNull();
    expect(sanitizeReturnTo("//evil.com/uncensored")).toBeNull();
    // Backslash variants browsers normalise to "//".
    expect(sanitizeReturnTo("/\\evil.com")).toBeNull();
    // Absolute URLs, including our own origin — only paths are allowed.
    expect(sanitizeReturnTo("https://evil.com")).toBeNull();
    expect(sanitizeReturnTo("https://dreamforgex.ai/uncensored")).toBeNull();
    expect(sanitizeReturnTo("javascript:alert(1)")).toBeNull();
    expect(sanitizeReturnTo("data:text/html,<script>")).toBeNull();
    // Not rooted.
    expect(sanitizeReturnTo("uncensored")).toBeNull();
    expect(sanitizeReturnTo("../admin")).toBeNull();
  });

  it("rejects control characters used to smuggle a scheme", () => {
    // A browser strips the newline and is left with "javascript:alert(1)".
    expect(sanitizeReturnTo("/\njavascript:alert(1)")).toBeNull();
    expect(sanitizeReturnTo("/\tfoo")).toBeNull();
    expect(sanitizeReturnTo("/\u0000foo")).toBeNull();
    expect(sanitizeReturnTo("/\u007ffoo")).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(sanitizeReturnTo("")).toBeNull();
    expect(sanitizeReturnTo("   ")).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo(undefined)).toBeNull();
    expect(sanitizeReturnTo(42 as unknown as string)).toBeNull();
  });
});

describe("buildSignInUrl", () => {
  it("carries a safe path as an encoded next param", () => {
    expect(buildSignInUrl("/uncensored?start=1")).toBe(
      "/auth/signin?next=%2Funcensored%3Fstart%3D1",
    );
  });

  it("omits the param entirely for unsafe or missing input", () => {
    expect(buildSignInUrl("//evil.com")).toBe("/auth/signin");
    expect(buildSignInUrl(null)).toBe("/auth/signin");
    expect(buildSignInUrl()).toBe("/auth/signin");
  });

  it("round-trips through the param back to the same path", () => {
    const target = "/uncensored?plan=uncensored-30d";
    const url = buildSignInUrl(target);
    const next = new URLSearchParams(url.split("?")[1]).get("next");
    expect(resolvePostLogin(next)).toBe(target);
  });
});

describe("resolvePostLogin", () => {
  it("falls back to the studio when there is no usable intent", () => {
    expect(resolvePostLogin(null)).toBe(DEFAULT_POST_LOGIN);
    expect(resolvePostLogin("//evil.com")).toBe(DEFAULT_POST_LOGIN);
    expect(resolvePostLogin("https://evil.com")).toBe(DEFAULT_POST_LOGIN);
  });

  it("honours a real intent path", () => {
    expect(resolvePostLogin("/uncensored?start=1")).toBe("/uncensored?start=1");
  });
});
