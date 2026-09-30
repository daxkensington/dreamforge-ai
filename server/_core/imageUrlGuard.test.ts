import { describe, it, expect, vi, afterEach } from "vitest";
import { assertSafeImageUrl, fetchGuardedImage } from "./imageUrlGuard";

describe("assertSafeImageUrl", () => {
  it("accepts ordinary public https image URLs", () => {
    expect(assertSafeImageUrl("https://example.com/photo.png")).toContain("example.com");
    expect(assertSafeImageUrl("https://cdn.some-site.co.uk/a/b.jpg?x=1")).toContain("some-site.co.uk");
  });

  it("rejects non-https schemes", () => {
    expect(() => assertSafeImageUrl("http://example.com/photo.png")).toThrow(/https/);
    expect(() => assertSafeImageUrl("ftp://example.com/photo.png")).toThrow();
    expect(() => assertSafeImageUrl("file:///etc/passwd")).toThrow();
  });

  it("rejects loopback, private, link-local and metadata IPv4 literals", () => {
    expect(() => assertSafeImageUrl("https://127.0.0.1/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://127.44.0.1/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://10.0.0.8/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://172.16.0.1/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://172.31.255.255/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://172.32.0.1/x.png")).not.toThrow(); // outside 172.16/12
    expect(() => assertSafeImageUrl("https://192.168.1.1/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://169.254.169.254/latest/meta-data")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://0.0.0.0/x.png")).toThrow(/not allowed/);
  });

  it("rejects non-canonical IPv4 spellings (WHATWG normalizes them)", () => {
    expect(() => assertSafeImageUrl("https://2130706433/x.png")).toThrow(/not allowed/); // 127.0.0.1 as int
    expect(() => assertSafeImageUrl("https://0x7f000001/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://0177.0.0.1/x.png")).toThrow(/not allowed/);
  });

  it("rejects IPv6 loopback / ULA / link-local and IPv4-mapped forms", () => {
    expect(() => assertSafeImageUrl("https://[::1]/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://[fd00::1]/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://[fe80::1]/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://[::ffff:127.0.0.1]/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://[::ffff:10.0.0.1]/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://[2001:db8::1]/x.png")).not.toThrow(); // public documentation range
  });

  it("rejects localhost and dotless short names", () => {
    expect(() => assertSafeImageUrl("https://localhost/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://localhost./x.png")).toThrow(/not allowed/); // trailing root dot
    expect(() => assertSafeImageUrl("https://metadata/x.png")).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://internal-service/x.png")).toThrow(/not allowed/);
  });

  it("rejects non-URL garbage", () => {
    expect(() => assertSafeImageUrl("not-a-url")).toThrow();
  });
});

describe("fetchGuardedImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(body: BodyInit | ReadableStream, headers: Record<string, string> = {}, status = 200) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status, headers })));
  }

  it("returns buffer + content type for a valid image response", async () => {
    stubFetch(Buffer.from("PNGDATA"), { "content-type": "image/png", "content-length": "7" });
    const { buffer, contentType } = await fetchGuardedImage("https://example.com/a.png");
    expect(buffer.toString()).toBe("PNGDATA");
    expect(contentType).toBe("image/png");
  });

  it("rejects a non-image content type", async () => {
    stubFetch("<html></html>", { "content-type": "text/html" });
    await expect(fetchGuardedImage("https://example.com/a.png")).rejects.toThrow(/did not return an image/);
  });

  it("rejects a declared Content-Length over 20MB", async () => {
    stubFetch(Buffer.from("x"), {
      "content-type": "image/png",
      "content-length": String(21 * 1024 * 1024),
    });
    await expect(fetchGuardedImage("https://example.com/a.png")).rejects.toThrow(/too large|maximum/i);
  });

  it("caps actual bytes read even when Content-Length lies", async () => {
    // 26 one-megabyte chunks, no content-length: must abort over 25MB.
    const stream = new ReadableStream({
      start(controller) {
        const chunk = new Uint8Array(1024 * 1024).fill(1);
        for (let i = 0; i < 26; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    stubFetch(stream, { "content-type": "image/png" });
    await expect(fetchGuardedImage("https://example.com/a.png")).rejects.toThrow(/maximum/i);
  });

  it("rejects non-2xx responses", async () => {
    stubFetch("nope", { "content-type": "image/png" }, 404);
    await expect(fetchGuardedImage("https://example.com/a.png")).rejects.toThrow(/HTTP 404/);
  });

  it("validates the URL before fetching at all", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await expect(fetchGuardedImage("https://169.254.169.254/latest/meta-data")).rejects.toThrow(/not allowed/);
    expect(spy).not.toHaveBeenCalled();
  });
});
