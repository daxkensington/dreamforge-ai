import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage } from "./errorSanitizer";

describe("sanitizeErrorMessage", () => {
  it("scrubs provider hostnames", () => {
    expect(
      sanitizeErrorMessage("fetch https://api.openai.com/v1/images/generations returned 429"),
    ).toBe("fetch [provider] returned 429");
  });

  it("scrubs fal.ai and fal.run endpoints", () => {
    expect(sanitizeErrorMessage("fal.ai/catvton/v1 failed")).toContain("[provider]");
    expect(sanitizeErrorMessage("POST fal.run/flux failed 500")).toContain("[provider]");
  });

  it("redacts API keys in error bodies", () => {
    const msg = 'Bearer sk-proj-abc1234567890defghijklmnop failed';
    const out = sanitizeErrorMessage(msg);
    expect(out).not.toContain("sk-proj-abc");
    expect(out).toContain("[auth]");
  });

  it("redacts xai and replicate keys", () => {
    expect(sanitizeErrorMessage("key=xai-abcdef1234567890abcdef leaked")).toContain("[redacted]");
    expect(sanitizeErrorMessage("key=r8_abcdef1234567890abc leaked")).toContain("[redacted]");
  });

  it("replaces HTML error pages wholesale", () => {
    const html = "<html><head><title>502 Bad Gateway</title></head><body>error</body></html>";
    expect(sanitizeErrorMessage(html)).toMatch(/HTML error page/);
  });

  it("replaces stack trace snippets wholesale", () => {
    expect(sanitizeErrorMessage("at /app/server/routers.ts:100 in handler")).toMatch(
      /Internal error/,
    );
  });

  it("caps message length at 300 chars", () => {
    const long = "x".repeat(500);
    expect(sanitizeErrorMessage(long).length).toBeLessThanOrEqual(300);
  });

  it("returns a safe fallback for null/undefined/empty input", () => {
    expect(sanitizeErrorMessage(null)).toContain("unexpected error");
    expect(sanitizeErrorMessage(undefined)).toContain("unexpected error");
    expect(sanitizeErrorMessage("")).toContain("unexpected error");
  });

  it("leaves safe user-facing content untouched", () => {
    const msg = "Rate limit exceeded. Try again in 30 seconds.";
    expect(sanitizeErrorMessage(msg)).toBe(msg);
  });
});
