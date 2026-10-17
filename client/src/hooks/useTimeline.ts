import { useReducer, useEffect, useCallback, useState } from "react";
import { emptyTimeline, resizeTimelineClip, timelineDuration, TIMELINE_MAX_SECONDS, type Clip, type Track, type TimelineDocument } from "@shared/timeline";
export type { Clip, Track } from "@shared/timeline";
export interface TimelineState extends TimelineDocument {
  playheadPosition: number; duration: number; zoom: number; isPlaying: boolean;
  selectedClipId: string | null; snapToGrid: boolean; gridSize: number;
}
type Store = { state: TimelineState; past: TimelineDocument[]; future: TimelineDocument[] };
const documentOf = (s: TimelineState): TimelineDocument => ({ schemaVersion: 1, tracks: s.tracks, clips: s.clips });
const initial = (): Store => ({ state: { ...emptyTimeline(), playheadPosition: 0, duration: 1, zoom: 1,
  isPlaying: false, selectedClipId: null, snapToGrid: true, gridSize: .1 }, past: [], future: [] });
type Action = { type: "edit"; edit: (doc: TimelineDocument, state: TimelineState) => TimelineDocument; select?: string }
  | { type: "view"; patch: Partial<TimelineState> } | { type: "load"; doc: TimelineDocument } | { type: "undo" } | { type: "redo" };
function reducer(store: Store, action: Action): Store {
  if (action.type === "view") return { ...store, state: { ...store.state, ...action.patch } };
  if (action.type === "load") return { state: { ...initial().state, ...action.doc, duration: timelineDuration(action.doc.clips) }, past: [], future: [] };
  if (action.type === "undo" || action.type === "redo") {
    const from = action.type === "undo" ? store.past : store.future;
    const doc = from.at(-1); if (!doc) return store;
    const current = documentOf(store.state);
    return { state: { ...store.state, ...doc, duration: timelineDuration(doc.clips), selectedClipId: null, isPlaying: false },
      past: action.type === "undo" ? store.past.slice(0, -1) : [...store.past, current],
      future: action.type === "redo" ? store.future.slice(0, -1) : [...store.future, current] };
  }
  const before = documentOf(store.state), doc = action.edit(before, store.state);
  if (JSON.stringify(doc) === JSON.stringify(before)) return store;
  return { state: { ...store.state, ...doc, duration: timelineDuration(doc.clips), selectedClipId: action.select ?? store.state.selectedClipId },
    past: [...store.past.slice(-49), before], future: [] };
}
const id = () => crypto.randomUUID();
const snap = (value: number, state: TimelineState) => Math.max(0, Math.min(TIMELINE_MAX_SECONDS - .1,
  state.snapToGrid ? Math.round(value / state.gridSize) * state.gridSize : value));
export function useTimeline(editable = true) {
  const [{ state, past, future }, dispatch] = useReducer(reducer, undefined, initial);
  const [seekVersion, setSeekVersion] = useState(0);
  const edit = useCallback((fn: (doc: TimelineDocument, state: TimelineState) => TimelineDocument, select?: string) => {
    if (editable) dispatch({ type: "edit", edit: fn, select });
  }, [editable]);
  const modifyClip = useCallback((clipId: string, fn: (clip: Clip, state: TimelineState) => Clip | null) => edit((doc, state) => ({ ...doc,
    clips: doc.clips.flatMap(clip => clip.id !== clipId || doc.tracks.find(t => t.id === clip.trackId)?.isLocked ? [clip] : [fn(clip, state)].filter((c): c is Clip => c !== null)) })), [edit]);
  const setPlayhead = useCallback((time: number) => { dispatch({ type: "view", patch: { playheadPosition: Math.max(0, Math.min(state.duration, time)) } }); setSeekVersion(value => value + 1); }, [state.duration]);
  useEffect(() => {
    if (!state.isPlaying) return;
    const start = performance.now(), from = state.playheadPosition, duration = state.duration;
    let frame = 0;
    const tick = () => {
      const position = Math.min(duration, from + (performance.now() - start) / 1000);
      dispatch({ type: "view", patch: { playheadPosition: position, isPlaying: position < duration } });
      if (position < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
    // Elapsed-time clock: rendering the playhead must not restart playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, state.duration, seekVersion]);
  return {
    editable,
    state, document: documentOf(state), selectedClip: state.clips.find(c => c.id === state.selectedClipId) ?? null,
    selectedTrack: state.tracks.find(t => t.id === state.clips.find(c => c.id === state.selectedClipId)?.trackId) ?? null,
    canUndo: editable && past.length > 0, canRedo: editable && future.length > 0,
    load: useCallback((doc: TimelineDocument) => dispatch({ type: "load", doc }), []),
    addTrack: (track: Omit<Track, "id">) => edit(doc => doc.tracks.length < 32 ? { ...doc, tracks: [...doc.tracks, { ...track, id: id() }] } : doc),
    removeTrack: (trackId: string) => edit(doc => doc.tracks.length > 1 ? { ...doc, tracks: doc.tracks.filter(t => t.id !== trackId), clips: doc.clips.filter(c => c.trackId !== trackId) } : doc),
    updateTrack: (trackId: string, updates: Partial<Track>) => edit(doc => ({ ...doc, tracks: doc.tracks.map(t => t.id === trackId ? { ...t, ...updates, id: t.id, type: t.type } : t) })),
    addClip: (clip: Omit<Clip, "id">) => {
      const clipId = id(); edit((doc, state) => {
        if (doc.clips.length >= 300 || doc.tracks.find(t => t.id === clip.trackId)?.isLocked) return doc;
        const startTime = snap(clip.startTime, state);
        return { ...doc, clips: [...doc.clips, { ...clip, id: clipId, startTime, duration: Math.min(clip.duration, TIMELINE_MAX_SECONDS - startTime) }] };
      }, clipId);
    },
    removeClip: (clipId: string) => modifyClip(clipId, () => null),
    moveClip: (clipId: string, startTime: number) => modifyClip(clipId, (clip, state) => ({ ...clip, startTime: Math.min(snap(startTime, state), TIMELINE_MAX_SECONDS - clip.duration) })),
    resizeClip: (clipId: string, duration: number, startTime?: number) => modifyClip(clipId, clip => resizeTimelineClip(clip, duration, startTime)),
    updateClip: (clipId: string, updates: Partial<Clip>) => modifyClip(clipId, clip => {
      const next = { ...clip, ...updates, id: clip.id, trackId: clip.trackId, type: clip.type };
      next.startTime = Math.max(0, Math.min(TIMELINE_MAX_SECONDS - .1, Number.isFinite(next.startTime) ? next.startTime : 0));
      next.trimStart = Math.max(0, Math.min(next.sourceDuration ? next.sourceDuration - .1 : TIMELINE_MAX_SECONDS, next.trimStart ?? 0));
      next.duration = Math.max(.1, Math.min(Number.isFinite(next.duration) ? next.duration : .1, TIMELINE_MAX_SECONDS - next.startTime,
        next.sourceDuration ? next.sourceDuration - next.trimStart : TIMELINE_MAX_SECONDS));
      return next;
    }),
    splitClip: (clipId: string, at: number) => edit(doc => {
      const clip = doc.clips.find(c => c.id === clipId);
      if (!clip || doc.clips.length >= 300 || doc.tracks.find(t => t.id === clip.trackId)?.isLocked || at - clip.startTime < .1 || clip.startTime + clip.duration - at < .1) return doc;
      const firstDuration = at - clip.startTime;
      return { ...doc, clips: [...doc.clips.map(c => c.id === clipId ? { ...c, duration: firstDuration } : c),
        { ...clip, id: id(), startTime: at, duration: clip.duration - firstDuration, trimStart: (clip.trimStart ?? 0) + firstDuration }] };
    }),
    duplicateClip: (clipId: string) => edit(doc => {
      const clip = doc.clips.find(c => c.id === clipId); if (!clip || doc.clips.length >= 300 || doc.tracks.find(t => t.id === clip.trackId)?.isLocked || clip.startTime + clip.duration * 2 > TIMELINE_MAX_SECONDS) return doc;
      return { ...doc, clips: [...doc.clips, { ...clip, id: id(), startTime: clip.startTime + clip.duration }] };
    }),
    selectClip: (selectedClipId: string | null) => dispatch({ type: "view", patch: { selectedClipId } }),
    setPlayhead, setZoom: (zoom: number) => dispatch({ type: "view", patch: { zoom: Math.max(.1, Math.min(5, zoom)) } }),
    togglePlay: () => dispatch({ type: "view", patch: { isPlaying: !state.isPlaying, playheadPosition: state.playheadPosition >= state.duration ? 0 : state.playheadPosition } }),
    setPlaying: (isPlaying: boolean) => dispatch({ type: "view", patch: { isPlaying } }),
    toggleSnap: () => dispatch({ type: "view", patch: { snapToGrid: !state.snapToGrid } }),
    undo: () => { if (editable) dispatch({ type: "undo" }); }, redo: () => { if (editable) dispatch({ type: "redo" }); },
  };
}
export type UseTimelineReturn = ReturnType<typeof useTimeline>;
