import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("./db", () => ({ getGenerationById: mock.get }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("../client/src/components/ShareGenerationView", () => ({ ShareGenerationView: () => null }));
import Page, { generateMetadata } from "../app/g/[id]/page";
describe("private creations stay outside public share pages and metadata", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    { imageUrl: "/api/media/generations/custom/fixture.jpg", metadata: { trainedModelId: 4 } },
    { imageUrl: "/api/media/animation/7/fixture.mp4", metadata: { tool: "image-animation" } },
    { imageUrl: "https://example.test/old.jpg", metadata: { trainedModelId: 4 } },
    { imageUrl: "https://dreamforgex.ai/api/media/animation/7/fixture.mp4", metadata: {} },
    { imageUrl: "https://example.test/old.mp4", metadata: { tool: "image-animation" } },
  ])("does not expose private output or its prompt: %j", async fields => {
    mock.get.mockResolvedValue({ id: 7, prompt: "Confidential product concept", status: "completed", mediaType: "image", createdAt: new Date(), ...fields });
    const props = { params: Promise.resolve({ id: "7" }) };
    const metadata = await generateMetadata(props);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(JSON.stringify(metadata)).not.toContain("Confidential");
    await expect(Page(props)).rejects.toThrow("NOT_FOUND");
  });
});
