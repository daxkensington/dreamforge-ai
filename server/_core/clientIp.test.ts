import { describe, expect, it } from "vitest";
import { getClientIp } from "./clientIp";
describe("Edge-compatible trusted client IP selection", () => {
  it.each([
    [{ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "spoofed, 198.51.100.1" }, "203.0.113.9"],
    [{ "x-forwarded-for": "spoofed, 198.51.100.1" }, "198.51.100.1"],
    [{ "x-forwarded-for": "spoofed, , 198.51.100.2, " }, "198.51.100.2"],
    [{ "x-vercel-forwarded-for": " ", "x-forwarded-for": " , ", "x-real-ip": "198.51.100.3" }, "198.51.100.3"],
    [{}, null],
  ])("chooses the trusted closest header value from %j", (headers, expected) => {
    expect(getClientIp(new Headers(headers as Record<string, string>))).toBe(expected);
  });
});
