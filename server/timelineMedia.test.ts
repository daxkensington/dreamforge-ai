import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimelineRenderer, exportTimeline } from "../client/src/components/timeline/timelineMedia";
import { emptyTimeline } from "../shared/timeline";

describe("timeline renderer and recording lifecycle with a mocked browser platform", () => {
  let canvas: any, browserDocument: any, context: any, clock: number, stopped: ReturnType<typeof vi.fn>, closed: ReturnType<typeof vi.fn>, startDelay: number;
  beforeEach(() => {
    clock = 0; startDelay = 0; stopped = vi.fn(); closed = vi.fn().mockResolvedValue(undefined);
    context = { fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), fillText: vi.fn(), drawImage: vi.fn() };
    const track = () => ({ stop: stopped });
    class Canvas { width = 0; height = 0; getContext() { return context; } captureStream() { return { addTrack: vi.fn(), getTracks: () => [track()] }; } }
    class Audio { resume = vi.fn().mockResolvedValue(undefined); close = closed; createConstantSource() { return { offset: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: stopped, disconnect: vi.fn() }; } createMediaStreamDestination() { return { stream: { getAudioTracks: () => [track()], getTracks: () => [track()] } }; } }
    class Recording {
      static isTypeSupported(mime: string) { return mime === "video/webm;codecs=vp8,opus"; }
      // The platform's actual result wins over the requested format.
      mimeType = "video/webm;codecs=vp8,opus"; state = "inactive";
      ondataavailable?: (event: any) => void; onstop?: () => void;
      onstart?: () => void; encoderStarted = false;
      start() { this.state = "recording"; setTimeout(() => { clock += startDelay ? 2000 : 0; this.encoderStarted = true; this.onstart?.(); }, startDelay); }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(this.encoderStarted ? ["fixture-platform-recording-bytes"] : []) }); this.onstop?.(); }
    }
    canvas = new Canvas(); browserDocument = Object.assign(new EventTarget(), { hidden: false, createElement: vi.fn(() => canvas) });
    vi.stubGlobal("window", { document: browserDocument, setTimeout, clearTimeout });
    vi.stubGlobal("HTMLCanvasElement", Canvas); vi.stubGlobal("HTMLMediaElement", class {}); vi.stubGlobal("HTMLVideoElement", class {}); vi.stubGlobal("HTMLImageElement", class {});
    vi.stubGlobal("AudioContext", Audio); vi.stubGlobal("MediaRecorder", Recording);
    const startedAt = Date.now(); vi.spyOn(performance, "now").mockImplementation(() => clock + Date.now() - startedAt);
    vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => setTimeout(() => { clock += 100; callback(clock); }, 0));
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  const textDocument = () => ({ ...emptyTimeline(), clips: [{ id: "text", trackId: "text-1", type: "text" as const, startTime: 0, duration: .2, text: "Actual title", style: { color: "#ff0000", fontSize: 48 } }] });
  it("draws actual text frames, returns only recorder bytes with the actual MIME, and releases resources", async () => {
    const progress = vi.fn();
    const result = await exportTimeline(textDocument(), { signal: new AbortController().signal, onProgress: progress });
    expect(await result.blob.text()).toBe("fixture-platform-recording-bytes");
    expect(result).toMatchObject({ mime: "video/webm;codecs=vp8,opus", extension: "webm" });
    expect(context.fillText).toHaveBeenCalledWith("Actual title", 640, 360, 1152);
    expect(canvas).toMatchObject({ width: 1280, height: 720 });
    expect(progress).toHaveBeenCalledWith(expect.any(Number), expect.stringContaining("real time"));
    expect(stopped).toHaveBeenCalled(); expect(closed).toHaveBeenCalledOnce();
  });
  it("cancels a recording without returning a partial download and closes audio/tracks", async () => {
    const abort = new AbortController();
    await expect(exportTimeline(textDocument(), { signal: abort.signal, onProgress: fraction => { if (fraction > .1) abort.abort(); } })).rejects.toMatchObject({ name: "AbortError" });
    expect(stopped).toHaveBeenCalled(); expect(closed).toHaveBeenCalledOnce();
  });
  it("waits for asynchronous encoder startup before timing a short clip", async () => {
    startDelay = 25;
    const diagnostics = vi.fn();
    const result = await exportTimeline(textDocument(), { signal: new AbortController().signal, onProgress: vi.fn(), onDiagnostic: diagnostics });
    expect(await result.blob.text()).toBe("fixture-platform-recording-bytes");
    expect(diagnostics).toHaveBeenCalledWith("start", expect.objectContaining({ state: "recording" }));
    const stop = diagnostics.mock.calls.find(call => call[0] === "stop")![1];
    expect(stop.recordedSeconds).toBeGreaterThanOrEqual(.18); expect(stop.recordedSeconds).toBeLessThan(.4); expect(stop.frames).toBeGreaterThan(1);
  });
  it("reports background-tab interruption instead of silently exporting throttled footage", async () => {
    await expect(exportTimeline(textDocument(), { signal: new AbortController().signal, onProgress: fraction => { if (fraction > .1) { browserDocument.hidden = true; browserDocument.dispatchEvent(new Event("visibilitychange")); } } })).rejects.toThrow("tab was hidden");
    expect(stopped).toHaveBeenCalled(); expect(closed).toHaveBeenCalledOnce();
  });
  it("rejects unsupported recording and empty timelines before returning bytes", async () => {
    await expect(exportTimeline(emptyTimeline(), { signal: new AbortController().signal, onProgress: vi.fn() })).rejects.toThrow("Add at least one clip");
    vi.stubGlobal("MediaRecorder", undefined);
    await expect(exportTimeline(textDocument(), { signal: new AbortController().signal, onProgress: vi.fn() })).rejects.toThrow("does not support");
  });
  it("reports CORS/access failure and enforces a streamed body cap", async () => {
    const doc = { ...emptyTimeline(), clips: [{ id: "image", trackId: "video-1", type: "video" as const, mediaKind: "image" as const, sourceUrl: "/img/fixture.png", startTime: 0, duration: 1 }] };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(createTimelineRenderer(doc, canvas, { signal: new AbortController().signal })).rejects.toThrow("must allow CORS");
    const cancelled = vi.fn(), release = vi.fn(), read = vi.fn().mockResolvedValue({ done: false, value: new Uint8Array(16 * 1024 * 1024) });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, body: { getReader: () => ({ read, cancel: cancelled, releaseLock: release }) } }));
    await expect(createTimelineRenderer(doc, canvas, { signal: new AbortController().signal })).rejects.toThrow("25 MiB");
    expect(cancelled).toHaveBeenCalledOnce(); expect(release).toHaveBeenCalledOnce();
  });
  it("seeks real media to source in-points and mixes track/clip gain, mute and solo into the recording destination", async () => {
    canvas.width = 1280; canvas.height = 720;
    const elements: any[] = [], gains: any[] = [], sources: any[] = [], revoked = vi.spyOn(URL, "revokeObjectURL");
    class Media extends EventTarget {
      duration = 12; paused = true; volume = 1; preload = ""; src = ""; time = 0;
      constructor() { super(); elements.push(this); }
      get currentTime() { return this.time; }
      set currentTime(value: number) { this.time = value; queueMicrotask(() => this.dispatchEvent(new Event("seeked"))); }
      load() { queueMicrotask(() => this.dispatchEvent(new Event("canplay"))); }
      pause = vi.fn(() => { this.paused = true; });
      play = vi.fn(async () => { this.paused = false; });
      removeAttribute = vi.fn();
    }
    class Video extends Media { videoWidth = 640; videoHeight = 360; }
    vi.stubGlobal("HTMLMediaElement", Media); vi.stubGlobal("HTMLVideoElement", Video);
    browserDocument.createElement.mockImplementation((kind: string) => kind === "video" ? new Video() : new Media());
    vi.stubGlobal("document", browserDocument);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0, 1, 2]), { headers: { "content-type": "video/mp4" } })));
    const destination = {} as AudioNode;
    const audio = { createMediaElementSource: () => { const source = { connect: vi.fn(), disconnect: vi.fn() }; sources.push(source); return source; },
      createGain: () => { const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; } } as unknown as AudioContext;
    const doc = emptyTimeline(); doc.clips = [
      { id: "video", trackId: "video-1", type: "video", mediaKind: "video", sourceUrl: "/img/v.mp4", startTime: 2, duration: 6, trimStart: 3 },
      { id: "audio", trackId: "audio-1", type: "audio", mediaKind: "audio", sourceUrl: "/img/a.wav", startTime: 0, duration: 10, style: { volume: 50 } },
    ]; doc.tracks[1].volume = .6;
    const abort = new AbortController(), renderer = await createTimelineRenderer(doc, canvas, { signal: abort.signal, audioContext: audio, destination });
    renderer.draw(doc, 4, true);
    expect(elements.map(element => element.currentTime)).toEqual([5, 4]);
    expect(elements[0].play).toHaveBeenCalled(); expect(gains[1].gain.value).toBeCloseTo(.3);
    expect(gains.every(gain => gain.connect.mock.calls[0][0] === destination)).toBe(true);
    expect(context.drawImage).toHaveBeenCalledWith(elements[0], 0, 0, 1280, 720);
    doc.tracks[1].isMuted = true; renderer.draw(doc, 4, true); expect(gains[1].gain.value).toBe(0);
    doc.tracks[0].isSolo = true; renderer.draw(doc, 4, true); expect(elements[1].pause).toHaveBeenCalled();
    abort.abort(); expect(sources.every(source => source.disconnect.mock.calls.length === 1)).toBe(true);
    expect(revoked).toHaveBeenCalledTimes(2); expect(elements.every(element => element.removeAttribute.mock.calls.length === 1)).toBe(true);
    renderer.dispose(); expect(revoked).toHaveBeenCalledTimes(2);
  });
});
