import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), complete: vi.fn() }));
vi.mock("@trpc/client", () => ({ createTRPCClient: () => ({ media: { createUpload: { mutate: mocks.create }, completeUpload: { mutate: mocks.complete } } }), httpBatchLink: vi.fn() }));
import { uploadOwnedMedia } from "../client/src/lib/mediaUpload";
describe("browser owned media upload transport", () => {
  beforeEach(() => { mocks.create.mockReset().mockResolvedValue({ uploadId: "fixture-upload", chunkSize: 3 * 1024 * 1024, partCount: 3 }); mocks.complete.mockReset().mockResolvedValue({ key: "uploads/1/fixture.mp4", url: "/api/media/uploads/1/fixture.mp4", contentType: "video/mp4", size: 7 * 1024 * 1024 }); });
  afterEach(() => vi.unstubAllGlobals());
  it("sends bounded same-origin chunks and reports success only after the verified completion receipt", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    const progress = vi.fn(), file = new File([new Uint8Array(7 * 1024 * 1024)], "clip.mp4", { type: "video/mp4" });
    expect(await uploadOwnedMedia(file,"timeline",progress)).toHaveProperty("url","/api/media/uploads/1/fixture.mp4");
    expect(fetch.mock.calls.map(call => call[0])).toEqual(["/api/media/upload/fixture-upload/0","/api/media/upload/fixture-upload/1","/api/media/upload/fixture-upload/2"]);
    expect(fetch.mock.calls.map(call => call[1].body.size)).toEqual([3145728,3145728,1048576]);
    expect(fetch.mock.calls.every(call => call[1].credentials === "same-origin")).toBe(true);
    expect(mocks.complete).toHaveBeenCalledWith({ uploadId: "fixture-upload" }); expect(progress).toHaveBeenLastCalledWith(1);
  });
  it("retries an identical failed part without advancing to completion on a permanent failure", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Fixture upload denied" }) }); vi.stubGlobal("fetch",fetch);
    await expect(uploadOwnedMedia(new File(["fixture"],"clip.mp4",{type:"video/mp4"}),"timeline")).rejects.toThrow("Fixture upload denied");
    expect(fetch).toHaveBeenCalledTimes(3); expect(new Set(fetch.mock.calls.map(call => call[0])).size).toBe(1); expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("normalizes WAV MIME and leaves progress incomplete when final validation fails", async () => {
    mocks.create.mockResolvedValue({ uploadId: "fixture-upload", chunkSize:3145728,partCount:1 }); mocks.complete.mockRejectedValue(new Error("Integrity check failed"));
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true})); const progress=vi.fn();
    await expect(uploadOwnedMedia(new File(["wave"],"fixture.wav",{type:"audio/x-wav"}),"timeline",progress)).rejects.toThrow("Integrity check failed");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({contentType:"audio/wav"})); expect(progress).not.toHaveBeenCalledWith(1);
  });
});
