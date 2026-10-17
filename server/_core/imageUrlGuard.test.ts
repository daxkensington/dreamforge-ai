import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { Readable, PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
const network = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: network.lookup }));
vi.mock("node:https", () => ({ request: network.request }));
import {
  assertSafeImageUrl,
  fetchGuardedImage,
  fetchGuardedMedia,
} from "./imageUrlGuard";

describe("assertSafeImageUrl", () => {
  it("accepts ordinary public https image URLs", () => {
    expect(assertSafeImageUrl("https://example.com/photo.png")).toContain(
      "example.com"
    );
    expect(
      assertSafeImageUrl("https://cdn.some-site.co.uk/a/b.jpg?x=1")
    ).toContain("some-site.co.uk");
  });

  it("rejects non-https schemes", () => {
    expect(() => assertSafeImageUrl("http://example.com/photo.png")).toThrow(
      /https/
    );
    expect(() => assertSafeImageUrl("ftp://example.com/photo.png")).toThrow();
    expect(() => assertSafeImageUrl("file:///etc/passwd")).toThrow();
  });

  it("rejects loopback, private, link-local and metadata IPv4 literals", () => {
    expect(() => assertSafeImageUrl("https://127.0.0.1/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://127.44.0.1/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://10.0.0.8/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://172.16.0.1/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://172.31.255.255/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://172.32.0.1/x.png")).not.toThrow(); // outside 172.16/12
    expect(() => assertSafeImageUrl("https://192.168.1.1/x.png")).toThrow(
      /not allowed/
    );
    expect(() =>
      assertSafeImageUrl("https://169.254.169.254/latest/meta-data")
    ).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://0.0.0.0/x.png")).toThrow(
      /not allowed/
    );
  });

  it("rejects non-canonical IPv4 spellings (WHATWG normalizes them)", () => {
    expect(() => assertSafeImageUrl("https://2130706433/x.png")).toThrow(
      /not allowed/
    ); // 127.0.0.1 as int
    expect(() => assertSafeImageUrl("https://0x7f000001/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://0177.0.0.1/x.png")).toThrow(
      /not allowed/
    );
  });

  it("rejects IPv6 loopback / ULA / link-local and IPv4-mapped forms", () => {
    expect(() => assertSafeImageUrl("https://[::1]/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://[fd00::1]/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://[fe80::1]/x.png")).toThrow(
      /not allowed/
    );
    expect(() =>
      assertSafeImageUrl("https://[::ffff:127.0.0.1]/x.png")
    ).toThrow(/not allowed/);
    expect(() => assertSafeImageUrl("https://[::ffff:10.0.0.1]/x.png")).toThrow(
      /not allowed/
    );
    expect(() =>
      assertSafeImageUrl("https://[2606:4700:4700::1111]/x.png")
    ).not.toThrow();
    expect(() => assertSafeImageUrl("https://[2001:db8::1]/x.png")).toThrow();
  });

  it("rejects localhost and dotless short names", () => {
    expect(() => assertSafeImageUrl("https://localhost/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://localhost./x.png")).toThrow(
      /not allowed/
    ); // trailing root dot
    expect(() => assertSafeImageUrl("https://metadata/x.png")).toThrow(
      /not allowed/
    );
    expect(() => assertSafeImageUrl("https://internal-service/x.png")).toThrow(
      /not allowed/
    );
  });

  it("rejects non-URL garbage", () => {
    expect(() => assertSafeImageUrl("not-a-url")).toThrow();
  });
});

describe("fetchGuardedImage", () => {
  const replies: any[] = [];
  beforeEach(() => {
    replies.length = 0;
    network.lookup
      .mockReset()
      .mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
    network.request
      .mockReset()
      .mockImplementation((_url, options, callback) => {
        const response = replies.shift();
        if (!response)
          throw new Error(
            "Unexpected outbound request; real network is prohibited"
          );
        const req: any = new EventEmitter();
        req.end = () => queueMicrotask(() => callback(response));
        options.signal.addEventListener(
          "abort",
          () => response.destroy(options.signal.reason),
          { once: true }
        );
        return req;
      });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function response(
    body: string | Buffer | Buffer[],
    headers: Record<string, string> = {},
    status = 200
  ) {
    const res: any = Readable.from(
      Array.isArray(body) ? body : [Buffer.from(body)]
    );
    res.headers = headers;
    res.statusCode = status;
    replies.push(res);
    return res;
  }

  it("returns buffer + content type for a valid image response", async () => {
    response(Buffer.from("PNGDATA"), {
      "content-type": "image/png",
      "content-length": "7",
    });
    const { buffer, contentType } = await fetchGuardedImage(
      "https://example.com/a.png"
    );
    expect(buffer.toString()).toBe("PNGDATA");
    expect(contentType).toBe("image/png");
  });

  it("rejects a non-image content type", async () => {
    response("<html></html>", { "content-type": "text/html" });
    await expect(
      fetchGuardedImage("https://example.com/a.png")
    ).rejects.toThrow(/did not return an image/);
  });

  it("rejects a declared Content-Length over 20MB", async () => {
    response(Buffer.from("x"), {
      "content-type": "image/png",
      "content-length": String(21 * 1024 * 1024),
    });
    await expect(
      fetchGuardedImage("https://example.com/a.png")
    ).rejects.toThrow(/too large|maximum/i);
  });

  it("caps actual bytes read even when Content-Length lies", async () => {
    // 26 one-megabyte chunks, no content-length: must abort over 25MB.
    response(
      Array.from({ length: 26 }, () => Buffer.alloc(1024 * 1024)),
      { "content-type": "image/png" }
    );
    await expect(
      fetchGuardedImage("https://example.com/a.png")
    ).rejects.toThrow(/maximum/i);
  });

  it("rejects non-2xx responses", async () => {
    response("nope", { "content-type": "image/png" }, 404);
    await expect(
      fetchGuardedImage("https://example.com/a.png")
    ).rejects.toThrow(/HTTP 404/);
  });

  it("validates the URL before fetching at all", async () => {
    await expect(
      fetchGuardedImage("https://169.254.169.254/latest/meta-data")
    ).rejects.toThrow(/not allowed/);
    expect(network.request).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1/private",
    "https://127.0.0.1/private",
    "https://[::1]/private",
  ])(
    "rejects redirected private/insecure destination %s before requesting it",
    async location => {
      response("", { location }, 302);
      await expect(
        fetchGuardedImage("https://public.example/start")
      ).rejects.toThrow();
      expect(network.request).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    "127.0.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.2.3.4",
    "224.0.0.1",
    "10.0.0.8",
    "192.0.0.1",
  ])("blocks a public-looking DNS name resolving to %s", async address => {
    network.lookup.mockResolvedValue([{ address, family: 4 }]);
    await expect(
      fetchGuardedImage("https://public.example/a.png")
    ).rejects.toThrow(/not allowed/);
    expect(network.request).not.toHaveBeenCalled();
  });

  it("rejects a DNS answer containing even one private address and rechecks each redirect", async () => {
    response("", { location: "https://second.example/a.png" }, 302);
    network.lookup
      .mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }])
      .mockResolvedValueOnce([
        { address: "8.8.8.8", family: 4 },
        { address: "fd00::1", family: 6 },
      ]);
    await expect(
      fetchGuardedImage("https://first.example/start")
    ).rejects.toThrow(/not allowed/);
    expect(network.request).toHaveBeenCalledTimes(1);
    expect(network.lookup).toHaveBeenLastCalledWith("second.example", {
      all: true,
      verbatim: true,
    });
  });

  it("pins the resolved public address in the request lookup while retaining original TLS host", async () => {
    response("PNG", { "content-type": "image/png" });
    await fetchGuardedImage("https://public.example/a.png");
    const [url, options] = network.request.mock.calls[0];
    expect(url.hostname).toBe("public.example");
    expect(options.agent).toBe(false);
    const resolved = vi.fn();
    options.lookup("public.example", { all: false }, resolved);
    expect(resolved).toHaveBeenCalledWith(null, "1.1.1.1", 4);
    options.lookup("public.example", { all: true }, resolved);
    expect(resolved).toHaveBeenLastCalledWith(null, [
      { address: "1.1.1.1", family: 4 },
    ]);
    expect(network.lookup).toHaveBeenCalledTimes(1);
  });

  it("caps redirects and supports relative public redirects", async () => {
    for (let i = 0; i < 5; i++) response("", { location: "/again" }, 302);
    await expect(
      fetchGuardedImage("https://public.example/start")
    ).rejects.toThrow(/redirects/);
    expect(network.request).toHaveBeenCalledTimes(5);
  });

  it("applies an overall deadline while resolving DNS and never opens a socket after expiry", async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
    network.lookup.mockImplementation(() => new Promise(() => {}));
    const pending = fetchGuardedImage("https://public.example/a.png");
    deadline.abort(new Error("fixture deadline"));
    await expect(pending).rejects.toThrow("fixture deadline");
    expect(network.request).not.toHaveBeenCalled();
  });

  it("aborts a stalled response body and closes the stream", async () => {
    const res: any = new PassThrough();
    res.headers = { "content-type": "image/png" };
    res.statusCode = 200;
    replies.push(res);
    const abort = new AbortController();
    const pending = fetchGuardedImage("https://public.example/a.png", {
      signal: abort.signal,
    });
    await new Promise(resolve => setImmediate(resolve));
    abort.abort(new Error("fixture cancelled"));
    await expect(pending).rejects.toThrow("fixture cancelled");
    expect(res.destroyed).toBe(true);
  });

  it("video downloads reject images and enforce a hard video body limit", async () => {
    response("PNG", { "content-type": "image/png" });
    await expect(
      fetchGuardedMedia("https://public.example/a", { kind: "video" })
    ).rejects.toThrow(/video/);
    response("WEBMDATA", { "content-type": "video/webm" });
    const video = await fetchGuardedMedia("https://public.example/a", {
      kind: "video",
    });
    expect(video.contentType).toBe("video/webm");
    response("12345", { "content-type": "video/mp4" });
    await expect(
      fetchGuardedMedia("https://public.example/a", {
        kind: "video",
        maxBytes: 4,
      })
    ).rejects.toThrow(/maximum/);
    response("x", {
      "content-type": "video/mp4",
      "content-length": String(101 * 1024 * 1024),
    });
    await expect(
      fetchGuardedMedia("https://public.example/a", {
        kind: "video",
        maxBytes: 200 * 1024 * 1024,
      })
    ).rejects.toThrow(/maximum/);
  });
});
