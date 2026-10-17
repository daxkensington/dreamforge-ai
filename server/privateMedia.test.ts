import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  context: vi.fn(),
  asset: vi.fn(),
  object: vi.fn(),
  sharing: vi.fn(),
}));
vi.mock("./_core/context", () => ({ createContext: mock.context }));
vi.mock("./storage", () => ({ storageGetObjectBounded: mock.object }));
vi.mock("./dbTimeline", () => ({ canReadTimelineMedia: mock.sharing }));
vi.mock("./_core/mediaLifecycle", async original => ({
  ...(await original<any>()),
  getMediaAsset: mock.asset,
}));
import { GET } from "../app/api/media/[...key]/route";
const request = (key = "uploads/1/file.mp4", range?: string) =>
  GET(
    new Request(`https://dreamforgex.ai/api/media/${key}`, {
      headers: range ? { Range: range } : {},
    }),
    { params: Promise.resolve({ key: key.split("/") }) }
  );
describe("private media authorization and seeking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.context.mockResolvedValue({ user: { id: 1 } });
    mock.asset.mockResolvedValue({
      ownerUserId: 1,
      isPrivate: true,
      revokedAt: null,
      ownerDeleted: false,
    });
    mock.object.mockResolvedValue({
      bytes: Uint8Array.from([10, 20, 30, 40, 50]),
      contentType: "video/mp4",
    });
    mock.sharing.mockResolvedValue(false);
  });
  it("never reads objects for anonymous, foreign or revoked assets", async () => {
    mock.context.mockResolvedValueOnce({ user: null });
    expect((await request()).status).toBe(401);
    mock.asset.mockResolvedValueOnce({ ownerUserId: 2 });
    expect((await request()).status).toBe(404);
    mock.asset.mockResolvedValueOnce({ ownerUserId: 1, revokedAt: new Date() });
    expect((await request()).status).toBe(404);
    mock.asset.mockResolvedValueOnce({ ownerUserId: 1, ownerDeleted: true });
    expect((await request()).status).toBe(404);
    expect(mock.object).not.toHaveBeenCalled();
  });
  it("allows saved timeline references but never shares private models", async () => {
    mock.asset.mockResolvedValue({ ownerUserId: 2 });
    mock.sharing.mockResolvedValue(true);
    expect((await request()).status).toBe(200);
    expect((await request("training/2/model.safetensors")).status).toBe(404);
    expect(mock.sharing).toHaveBeenCalledTimes(1);
  });
  it("serves exact byte ranges with private cache controls", async () => {
    const response = await request(undefined, "bytes=1-3");
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 1-3/5");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      20, 30, 40,
    ]);
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
    const suffix = await request(undefined, "bytes=-2");
    expect([...new Uint8Array(await suffix.arrayBuffer())]).toEqual([40, 50]);
    for (const invalid of [
      "bytes=9-",
      "bytes=3-1",
      "bytes=-0",
      "bytes=0-1,3-4",
      "bytes=-",
      "bytes=999999999999999999-",
    ])
      expect((await request(undefined, invalid)).status).toBe(416);
  });
  it("forces arbitrary content types to attachment and rejects traversal", async () => {
    mock.object.mockResolvedValue({
      bytes: new Uint8Array([1]),
      contentType: "text/html",
    });
    const response = await request();
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream"
    );
    expect(response.headers.get("Content-Disposition")).toBe("attachment");
    expect((await request("../secret")).status).toBe(404);
  });
});
