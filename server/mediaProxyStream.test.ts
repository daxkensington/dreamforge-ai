import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), revoked: vi.fn() }));
vi.mock("./storage", () => ({ storageGetObject: mocks.get }));
vi.mock("./_core/mediaLifecycle", async original => ({ ...(await original<any>()), isMediaRevoked: mocks.revoked, isMediaPrivate: async () => false }));
import { GET } from "../app/img/[...key]/route";

describe("revocation-aware large media delivery", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.revoked.mockResolvedValue(false); });
  it("streams a clip larger than the buffered function limit without a shared cache", async () => {
    const clip = new Uint8Array(6 * 1024 * 1024).fill(173);
    mocks.get.mockResolvedValue({ bytes: clip, contentType: "video/mp4" });
    const response = await GET(new Request("https://dreamforgex.ai/img/video/clip.mp4") as any, { params: Promise.resolve({ key: ["video", "clip.mp4"] }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
    const reader = response.body!.getReader();
    let total = 0, chunks = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      expect(value.byteLength).toBeLessThanOrEqual(64 * 1024);
      expect(value[0]).toBe(173);
      total += value.byteLength; chunks++;
    }
    expect(total).toBe(clip.byteLength);
    expect(chunks).toBeGreaterThan(1);
  });
  it("does not fetch object bytes when a clip has been revoked", async () => {
    mocks.revoked.mockResolvedValue(true);
    const response = await GET(new Request("https://dreamforgex.ai/img/video/clip.mp4") as any, { params: Promise.resolve({ key: ["video", "clip.mp4"] }) });
    expect(response.status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
