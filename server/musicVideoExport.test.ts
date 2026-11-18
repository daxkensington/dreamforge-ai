import { afterEach, describe, expect, it, vi } from "vitest";
import { isOwnedAnimationUrl, musicVideoSupportError } from "../client/src/lib/musicVideoExport";

afterEach(() => vi.unstubAllGlobals());

describe("music-video recording capability", () => {
  function supportedBrowser() {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => true });
    vi.stubGlobal("AudioContext", function AudioContext() {});
    vi.stubGlobal("HTMLCanvasElement", function Canvas() {});
    vi.stubGlobal("HTMLVideoElement", function Video() {});
    (globalThis.HTMLCanvasElement.prototype as any).captureStream = () => {};
    (globalThis.HTMLVideoElement.prototype as any).captureStream = () => {};
  }
  it("allows generation when required recording APIs and a codec exist", () => {
    supportedBrowser();
    expect(musicVideoSupportError()).toBeNull();
  });
  it("explains no charge when recording or codec support is missing", () => {
    supportedBrowser();
    vi.stubGlobal("MediaRecorder", undefined);
    expect(musicVideoSupportError()).toMatch(/no credits were charged/i);
    supportedBrowser();
    vi.stubGlobal("MediaRecorder", { isTypeSupported: () => false });
    expect(musicVideoSupportError()).toMatch(/no credits were charged/i);
    supportedBrowser();
    delete (globalThis.HTMLVideoElement.prototype as any).captureStream;
    expect(musicVideoSupportError()).toMatch(/no credits were charged/i);
  });
});

describe("music-video animation ownership boundary", () => {
  const uuid = "12345678-1234-4234-9234-123456789abc";
  it("accepts only the current owner's private animation result path", () => {
    expect(isOwnedAnimationUrl(`/api/media/animation/17/${uuid}.mp4`, 17)).toBe(true);
    expect(isOwnedAnimationUrl(`/api/media/animation/18/${uuid}.mp4`, 17)).toBe(false);
  });
  it("rejects external, malformed, credentialed and traversal-like URLs", () => {
    for (const url of [
      `https://evil.example/api/media/animation/17/${uuid}.mp4`,
      `/api/media/animation/17/${uuid}.mp4?x=1`,
      `/api/media/animation/17/%2e%2e/${uuid}.mp4`,
      `/api/media/animation/17/${uuid}.webm`,
      `/api/media/animation/17/${uuid}.mp4/extra`,
    ]) expect(isOwnedAnimationUrl(url, 17)).toBe(false);
  });
});
