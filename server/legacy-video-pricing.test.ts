import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ debit: vi.fn(), video: vi.fn() }));
vi.mock("./stripe", async original => ({
  ...(await original<Record<string, unknown>>()),
  deductCredits: calls.debit,
}));
vi.mock("./_core/videoGeneration", () => ({ generateVeo3Video: calls.video }));

import { appRouter } from "./routers";

const caller = () => appRouter.createCaller({ user: { id: 42, openId: "fixture", role: "user" } as never, session: null, ip: "test" });

describe("legacy video quote boundary", () => {
  it.each(["auto", "veo-3", "runway-gen4.5", "runway-gen4-turbo", "kling-2.0", "kling-1.6", "minimax", "cogvideo"] as const)(
    "rejects %s before charging or invoking a provider",
    async model => {
      calls.debit.mockClear(); calls.video.mockClear();
      await expect(caller().video.textToVideo({ prompt: "a sunset", model })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED", message: expect.stringContaining("No credits charged"),
      });
      expect(calls.debit).not.toHaveBeenCalled();
      expect(calls.video).not.toHaveBeenCalled();
    },
  );

  it("rejects the unquoted Veo music-video wrapper before charging or invoking Veo", async () => {
    calls.debit.mockClear(); calls.video.mockClear();
    await expect(caller().song.generateMusicVideo({ songUrl: "https://example.com/song.mp3", concept: "a sunset" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED", message: expect.stringContaining("No credits charged"),
    });
    expect(calls.debit).not.toHaveBeenCalled();
    expect(calls.video).not.toHaveBeenCalled();
  });
});
