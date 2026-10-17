import { describe, expect, it } from "vitest";
import { activeClips, emptyTimeline, resizeTimelineClip, selectRecordingFormat, timelineDocumentSchema, timelineDuration, type Clip } from "./timeline";
const video = (): Clip => ({ id: "clip", trackId: "video-1", type: "video", mediaKind: "video", startTime: 2, duration: 6, trimStart: 3, sourceDuration: 12, sourceUrl: "/api/media/timeline/fixture.mp4" });
describe("timeline document and playback contract", () => {
  it("starts blank and uses actual content duration without a fabricated tail", () => {
    expect(emptyTimeline().clips).toEqual([]); expect(timelineDuration([video()])).toBe(8);
    expect(timelineDuration([{ ...video(), startTime: 0, duration: .8 }])).toBe(.8);
  });
  it("validates persistent media, track identity, finite timing and source trim", () => {
    const doc = { ...emptyTimeline(), clips: [video()] };
    expect(timelineDocumentSchema.safeParse(doc).success).toBe(true);
    for (const bad of [{ sourceUrl: "blob:local-only" }, { sourceUrl: "data:video/mp4;base64,AA==" }, { trackId: "audio-1" }, { duration: Infinity }, { duration: 11 }, { startTime: 1799 }]) {
      expect(timelineDocumentSchema.safeParse({ ...doc, clips: [{ ...video(), ...bad }] }).success).toBe(false);
    }
    expect(timelineDocumentSchema.safeParse({ ...doc, clips: [video(), video()] }).success).toBe(false);
  });
  it("trims source time consistently when dragging the left edge, including extension limits", () => {
    expect(resizeTimelineClip(video(), 4, 4)).toMatchObject({ startTime: 4, trimStart: 5, duration: 4 });
    expect(resizeTimelineClip(video(), 20)).toMatchObject({ startTime: 2, trimStart: 3, duration: 9 });
    expect(resizeTimelineClip(video(), 10, -5)).toMatchObject({ startTime: 0, trimStart: 0 });
  });
  it("uses start-inclusive/end-exclusive clips, source in-points, mute, volume and solo", () => {
    const doc = emptyTimeline(); doc.clips = [video(), { id: "audio", trackId: "audio-1", type: "audio", mediaKind: "audio", sourceUrl: "/img/audio/test.mp3", startTime: 0, duration: 8, style: { volume: 50 } }];
    doc.tracks[1].volume = .6;
    expect(activeClips(doc, 1).map(({ clip }) => clip.id)).toEqual(["audio"]);
    expect(activeClips(doc, 4)[0].sourceTime).toBe(5);
    expect(activeClips(doc, 4)[1].volume).toBeCloseTo(.3);
    doc.tracks[1].isMuted = true; expect(activeClips(doc, 4)[1].volume).toBe(0);
    doc.tracks[0].isSolo = true; expect(activeClips(doc, 4).map(({ clip }) => clip.id)).toEqual(["clip"]);
    expect(activeClips(doc, 8)).toEqual([]);
  });
  it("feature detects actual codecs and never labels a WebM file MP4", () => {
    expect(selectRecordingFormat(mime => mime === "video/webm;codecs=vp8,opus")).toEqual({ mime: "video/webm;codecs=vp8,opus", extension: "webm" });
    expect(selectRecordingFormat(mime => mime === "video/mp4")).toEqual({ mime: "video/mp4", extension: "mp4" });
    expect(selectRecordingFormat(() => false)).toBeNull();
  });
});
