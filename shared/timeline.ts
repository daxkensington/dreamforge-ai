import { z } from "zod";

export const TIMELINE_MAX_SECONDS = 1800;
const seconds = z.number().finite().min(0).max(TIMELINE_MAX_SECONDS);
const sourceUrl = z.string().max(4096).refine(value => {
  if (/^\/(?:img|api\/media)\/[A-Za-z0-9/_%.-]+$/.test(value) && !value.includes("..")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Use an uploaded or saved HTTPS media URL");
export const timelineTrackSchema = z.object({
  id: z.string().min(1).max(100), type: z.enum(["video", "audio", "text"]),
  name: z.string().min(1).max(100), isMuted: z.boolean(), isSolo: z.boolean(),
  isLocked: z.boolean(), volume: z.number().finite().min(0).max(2), color: z.string().regex(/^#[\da-f]{6}$/i),
}).strict();
export const timelineClipSchema = z.object({
  id: z.string().min(1).max(100), trackId: z.string().min(1).max(100),
  type: z.enum(["video", "audio", "text"]), mediaKind: z.enum(["video", "image", "audio"]).optional(),
  startTime: seconds, duration: z.number().finite().min(.1).max(TIMELINE_MAX_SECONDS),
  sourceUrl: sourceUrl.optional(), thumbnailUrl: sourceUrl.optional(),
  sourceDuration: z.number().finite().positive().max(86400).optional(),
  trimStart: z.number().finite().min(0).max(86400).optional(), trimEnd: z.number().finite().min(0).max(86400).optional(),
  name: z.string().max(256).optional(), text: z.string().max(2000).optional(),
  style: z.object({
    volume: z.number().finite().min(0).max(200).optional(),
    opacity: z.number().finite().min(0).max(100).optional(),
    fontSize: z.number().finite().min(8).max(128).optional(),
    color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
  }).strict().optional(),
}).strict();
export const timelineDocumentSchema = z.object({
  schemaVersion: z.literal(1), tracks: z.array(timelineTrackSchema).min(1).max(32),
  clips: z.array(timelineClipSchema).max(300),
}).strict().superRefine((doc, ctx) => {
  const tracks = new Map(doc.tracks.map(track => [track.id, track]));
  if (tracks.size !== doc.tracks.length) ctx.addIssue({ code: "custom", message: "Track IDs must be unique" });
  if (new Set(doc.clips.map(clip => clip.id)).size !== doc.clips.length) ctx.addIssue({ code: "custom", message: "Clip IDs must be unique" });
  for (const [i, clip] of doc.clips.entries()) {
    if (tracks.get(clip.trackId)?.type !== clip.type) ctx.addIssue({ code: "custom", path: ["clips", i], message: "Clip must belong to a matching track" });
    if (clip.startTime + clip.duration > TIMELINE_MAX_SECONDS) ctx.addIssue({ code: "custom", path: ["clips", i], message: "Timeline exceeds 30 minutes" });
    if (clip.type !== "text" && !clip.sourceUrl) ctx.addIssue({ code: "custom", path: ["clips", i], message: "Media clip requires a source" });
    if (clip.type === "audio" && clip.mediaKind !== "audio") ctx.addIssue({ code: "custom", path: ["clips", i], message: "Audio track requires audio media" });
    if (clip.type === "video" && clip.mediaKind === "audio") ctx.addIssue({ code: "custom", path: ["clips", i], message: "Video track requires video or image media" });
    if (clip.sourceDuration && (clip.trimStart ?? 0) + clip.duration > clip.sourceDuration + .05) ctx.addIssue({ code: "custom", path: ["clips", i], message: "Trim extends beyond the source" });
  }
});
export type Track = z.infer<typeof timelineTrackSchema>;
export type Clip = z.infer<typeof timelineClipSchema>;
export type TimelineDocument = z.infer<typeof timelineDocumentSchema>;
export function emptyTimeline(): TimelineDocument {
  return { schemaVersion: 1, tracks: [
    { id: "video-1", type: "video", name: "Video / images", isMuted: false, isSolo: false, isLocked: false, volume: 1, color: "#8b5cf6" },
    { id: "audio-1", type: "audio", name: "Audio", isMuted: false, isSolo: false, isLocked: false, volume: 1, color: "#06b6d4" },
    { id: "text-1", type: "text", name: "Text", isMuted: false, isSolo: false, isLocked: false, volume: 1, color: "#f59e0b" },
  ], clips: [] };
}
export function timelineDuration(clips: Clip[]) { return clips.length ? Math.max(.1, ...clips.map(clip => clip.startTime + clip.duration)) : 1; }
export function activeClips(doc: TimelineDocument, time: number) {
  const solo = doc.tracks.some(track => track.isSolo);
  return doc.tracks.filter(track => !solo || track.isSolo).flatMap(track => doc.clips
    .filter(clip => clip.trackId === track.id && time >= clip.startTime && time < clip.startTime + clip.duration)
    .map(clip => ({ clip, track, sourceTime: (clip.trimStart ?? 0) + time - clip.startTime,
      volume: track.isMuted ? 0 : Math.min(1, track.volume * (clip.style?.volume ?? 100) / 100) })));
}
export function selectRecordingFormat(supported: (mime: string) => boolean) {
  for (const mime of ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm", "video/mp4"]) {
    if (supported(mime)) return { mime, extension: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  }
  return null;
}
/** Left trimming advances source in lockstep; extending cannot read before frame zero. */
export function resizeTimelineClip(clip: Clip, duration: number, startTime = clip.startTime): Clip {
  const delta = startTime - clip.startTime;
  const trimStart = Math.max(0, (clip.trimStart ?? 0) + delta);
  const start = Math.max(0, clip.startTime + (trimStart - (clip.trimStart ?? 0)));
  const available = clip.sourceDuration ? clip.sourceDuration - trimStart : TIMELINE_MAX_SECONDS - start;
  return { ...clip, startTime: start, trimStart, duration: Math.max(.1, Math.min(duration, available, TIMELINE_MAX_SECONDS - start)) };
}
