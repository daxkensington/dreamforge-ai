import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const mocks = vi.hoisted(() => ({
  env: { runpodApiKey: "fixture-only", runpodFluxEndpointId: "fixture-only", falApiKey: "fixture-only", runwayApiKey: "fixture-only", klingAccessKey: "fixture-only", klingSecretKey: "fixture-only" },
  runpodAvailable: true, runpod: vi.fn(), fal: vi.fn(), download: vi.fn(), store: vi.fn(),
}));
vi.mock("./env", () => ({ ENV: mocks.env }));
vi.mock("./runpod", () => ({ isRunPodAvailable: () => mocks.runpodAvailable, runpodCogVideo: mocks.runpod }));
vi.mock("./fal", () => ({ falRun: mocks.fal }));
vi.mock("./imageUrlGuard", () => ({ fetchGuardedMedia: mocks.download }));
vi.mock("../storage", () => ({ storagePut: mocks.store, generateStorageKey: (prefix: string, extension: string) => prefix + "/fixture." + extension }));
import { executeVideoCreation, listVideoCreationModels, prepareVideoCreation, videoContainerType } from "./videoGateway";
import { workspaceVideoSelectionError } from "../../shared/workspaceVideoSelection";
const mp4 = readFileSync(fileURLToPath(new URL("../../public/video/hero-bg.mp4", import.meta.url)));
const box = (type: string, data: Buffer) => { const head = Buffer.alloc(8); head.writeUInt32BE(data.length + 8); head.write(type, 4, "ascii"); return Buffer.concat([head, data]); };
const imageContainer = (brand: string) => box("ftyp", Buffer.from(brand + "0000" + brand, "ascii"));
// EBML document type and a video TrackEntry, for container recognition only.
const webm = Buffer.from([0x1a,0x45,0xdf,0xa3,0x87,0x42,0x82,0x84,0x77,0x65,0x62,0x6d,0x18,0x53,0x80,0x67,0xff,0x16,0x54,0xae,0x6b,0x8c,0xae,0x8a,0x83,0x81,0x01,0x86,0x85,0x56,0x5f,0x56,0x50,0x38]);
const input = { modelId: "cogvideo", userTier: "creator", width: 768, height: 768, duration: 6 };
describe("Workspace video gateway boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.runpodAvailable = true; mocks.env.runpodApiKey = "fixture-only"; mocks.env.falApiKey = "fixture-only"; mocks.runpod.mockResolvedValue(mp4); mocks.fal.mockResolvedValue({ video: { url: "https://fixture.example/video.mp4" } }); mocks.download.mockResolvedValue({ buffer: mp4, contentType: "video/mp4" }); mocks.store.mockResolvedValue({ url: "/img/video/fixture.mp4" }); });
  it("only advertises executable text-to-video models and quotes the same eligibility as the UI", () => {
    const catalog = listVideoCreationModels();
    for (const id of ["veo-3", "runway-gen4-turbo", "animatediff-v2", "built-in-v1"]) expect(catalog.map(model => model.id)).not.toContain(id);
    const model = catalog.find(item => item.id === "cogvideo")!;
    const plan = prepareVideoCreation(input);
    expect(plan.creditCost).toBe(model.creditCost);
    expect(workspaceVideoSelectionError({ catalog, catalogReady: true, planReady: true, userTier: "creator", modelId: model.id, duration: plan.duration })).toBeNull();
  });
  it.each([{ duration: 4 }, { duration: 6.5 }, { userTier: "free" }, { modelId: "built-in-v1" }, { modelId: "veo-3" }, { width: 256.5 }])("rejects invalid preflight without provider/storage work: %j", change => {
    expect(() => prepareVideoCreation({ ...input, ...change })).toThrow();
    expect(mocks.runpod).not.toHaveBeenCalled(); expect(mocks.fal).not.toHaveBeenCalled(); expect(mocks.store).not.toHaveBeenCalled();
  });
  it("rejects an unavailable configured choice before provider/storage work", () => {
    mocks.runpodAvailable = false; mocks.env.runpodApiKey = "";
    expect(() => prepareVideoCreation(input)).toThrow(/unavailable/);
    expect(mocks.runpod).not.toHaveBeenCalled();
  });
  it("stores real RunPod MP4 bytes and reports actual video provenance", async () => {
    const result = await executeVideoCreation(prepareVideoCreation(input), { prompt: "A fictional landscape" });
    expect(result).toMatchObject({ url: "/img/video/fixture.mp4", provenance: { modelId: "cogvideo", duration: 6, requestedAspectRatio: "1:1", contentType: "video/mp4" } });
    expect(mocks.store).toHaveBeenCalledTimes(1);
    expect(mocks.store.mock.calls[0][0]).toBe("video/fixture.mp4");
    expect(mocks.store.mock.calls[0][1] === mp4).toBe(true);
    expect(mocks.store.mock.calls[0][2]).toBe("video/mp4");
    expect(mocks.fal).not.toHaveBeenCalled();
  });
  it("downloads MiniMax through the bounded video guard before storage", async () => {
    await executeVideoCreation(prepareVideoCreation({ ...input, modelId: "minimax-video" }), { prompt: "A fictional landscape" });
    expect(mocks.fal).toHaveBeenCalledWith("fal-ai/minimax/hailuo-02/standard/text-to-video", expect.objectContaining({ duration: "6", enable_safety_checker: true }), expect.anything());
    expect(mocks.download).toHaveBeenCalledWith("https://fixture.example/video.mp4", { kind: "video", maxBytes: 100 * 1024 * 1024 });
  });
  it.each([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from([255,216,255,224,0,16]), imageContainer("avif"), imageContainer("heic"), imageContainer("isom")])("refuses image or incomplete containers", buffer => { expect(() => videoContainerType(buffer)).toThrow(); });
  it("recognizes a real repository MP4 and refuses unsupported WebM instead of guessing from metadata", () => { expect(videoContainerType(mp4)).toBe("video/mp4"); expect(() => videoContainerType(webm)).toThrow(); });
  it("does not store a PNG mislabeled as a remote video", async () => {
    mocks.download.mockResolvedValueOnce({ buffer: Buffer.from([137,80,78,71,13,10,26,10]), contentType: "video/mp4" });
    await expect(executeVideoCreation(prepareVideoCreation({ ...input, modelId: "minimax-video" }), { prompt: "A fictional landscape" })).rejects.toThrow(/video/);
    expect(mocks.store).not.toHaveBeenCalled();
  });
});
