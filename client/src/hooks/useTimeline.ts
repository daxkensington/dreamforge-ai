import { useCallback, useReducer, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────

export interface Track {
  id: string;
  type: "video" | "audio" | "text";
  name: string;
  isMuted: boolean;
  isSolo: boolean;
  isLocked: boolean;
  volume: number;
  color: string;
}

export interface Clip {
  id: string;
  trackId: string;
  type: "video" | "audio" | "text" | "transition";
  startTime: number;
  duration: number;
  sourceUrl?: string;
  thumbnailUrl?: string;
  text?: string;
  style?: Record<string, unknown>;
  trimStart?: number;
  trimEnd?: number;
  name?: string;
}

export interface TimelineState {
  tracks: Track[];
  clips: Clip[];
  playheadPosition: number;
  duration: number;
  zoom: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  snapToGrid: boolean;
  gridSize: number; // seconds
}

interface HistoryEntry {
  tracks: Track[];
  clips: Clip[];
}

// ─── Actions ──────────────────────────────────────────────────────

type TimelineAction =
  | { type: "ADD_TRACK"; payload: Omit<Track, "id"> }
  | { type: "REMOVE_TRACK"; payload: string }
  | { type: "UPDATE_TRACK"; payload: { id: string; updates: Partial<Track> } }
  | { type: "ADD_CLIP"; payload: Omit<Clip, "id"> }
  | { type: "REMOVE_CLIP"; payload: string }
  | { type: "MOVE_CLIP"; payload: { id: string; trackId?: string; startTime: number } }
  | { type: "RESIZE_CLIP"; payload: { id: string; startTime?: number; duration: number; trimStart?: number; trimEnd?: number } }
  | { type: "SPLIT_CLIP"; payload: { id: string; splitTime: number } }
  | { type: "DUPLICATE_CLIP"; payload: string }
  | { type: "UPDATE_CLIP"; payload: { id: string; updates: Partial<Clip> } }
  | { type: "SELECT_CLIP"; payload: string | null }
  | { type: "SET_PLAYHEAD"; payload: number }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_PLAYING"; payload: boolean }
  | { type: "TOGGLE_SNAP"; payload?: undefined }
  | { type: "SET_GRID_SIZE"; payload: number }
  | { type: "SET_DURATION"; payload: number }
  | { type: "RESTORE"; payload: { tracks: Track[]; clips: Clip[] } };

// ─── Helpers ──────────────────────────────────────────────────────

let clipIdCounter = 0;
let trackIdCounter = 0;

function generateClipId(): string {
  return `clip-${Date.now()}-${++clipIdCounter}`;
}

function generateTrackId(): string {
  return `track-${Date.now()}-${++trackIdCounter}`;
}

const TRACK_COLORS: Record<string, string> = {
  video: "#8b5cf6",
  audio: "#06b6d4",
  text: "#f59e0b",
};

function computeDuration(clips: Clip[]): number {
  if (clips.length === 0) return 30;
  const maxEnd = Math.max(...clips.map((c) => c.startTime + c.duration));
  return Math.max(30, maxEnd + 5);
}

function snapTime(time: number, gridSize: number, snap: boolean): number {
  if (!snap || gridSize <= 0) return Math.max(0, time);
  return Math.max(0, Math.round(time / gridSize) * gridSize);
}

// ─── Reducer ──────────────────────────────────────────────────────

function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "ADD_TRACK": {
      const newTrack: Track = {
        ...action.payload,
        id: generateTrackId(),
      };
      return { ...state, tracks: [...state.tracks, newTrack] };
    }

    case "REMOVE_TRACK": {
      return {
        ...state,
        tracks: state.tracks.filter((t) => t.id !== action.payload),
        clips: state.clips.filter((c) => c.trackId !== action.payload),
        selectedClipId: state.clips.find((c) => c.id === state.selectedClipId)?.trackId === action.payload
          ? null
          : state.selectedClipId,
      };
    }

    case "UPDATE_TRACK": {
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      };
    }

    case "ADD_CLIP": {
      const newClip: Clip = {
        ...action.payload,
        id: generateClipId(),
        startTime: snapTime(action.payload.startTime, state.gridSize, state.snapToGrid),
      };
      const newClips = [...state.clips, newClip];
      return {
        ...state,
        clips: newClips,
        duration: computeDuration(newClips),
        selectedClipId: newClip.id,
      };
    }

    case "REMOVE_CLIP": {
      const newClips = state.clips.filter((c) => c.id !== action.payload);
      return {
        ...state,
        clips: newClips,
        duration: computeDuration(newClips),
        selectedClipId: state.selectedClipId === action.payload ? null : state.selectedClipId,
      };
    }

    case "MOVE_CLIP": {
      const newClips = state.clips.map((c) => {
        if (c.id !== action.payload.id) return c;
        return {
          ...c,
          trackId: action.payload.trackId ?? c.trackId,
          startTime: snapTime(action.payload.startTime, state.gridSize, state.snapToGrid),
        };
      });
      return { ...state, clips: newClips, duration: computeDuration(newClips) };
    }

    case "RESIZE_CLIP": {
      const newClips = state.clips.map((c) => {
        if (c.id !== action.payload.id) return c;
        return {
          ...c,
          startTime: action.payload.startTime !== undefined
            ? snapTime(action.payload.startTime, state.gridSize, state.snapToGrid)
            : c.startTime,
          duration: Math.max(0.1, action.payload.duration),
          trimStart: action.payload.trimStart ?? c.trimStart,
          trimEnd: action.payload.trimEnd ?? c.trimEnd,
        };
      });
      return { ...state, clips: newClips, duration: computeDuration(newClips) };
    }

    case "SPLIT_CLIP": {
      const clip = state.clips.find((c) => c.id === action.payload.id);
      if (!clip) return state;

      const splitPoint = action.payload.splitTime;
      if (splitPoint <= clip.startTime || splitPoint >= clip.startTime + clip.duration) return state;

      const firstDuration = splitPoint - clip.startTime;
      const secondDuration = clip.duration - firstDuration;

      const firstClip: Clip = {
        ...clip,
        duration: firstDuration,
        trimEnd: (clip.trimEnd ?? 0) + secondDuration,
      };

      const secondClip: Clip = {
        ...clip,
        id: generateClipId(),
        startTime: splitPoint,
        duration: secondDuration,
        trimStart: (clip.trimStart ?? 0) + firstDuration,
        name: clip.name ? `${clip.name} (2)` : undefined,
      };

      const newClips = state.clips.map((c) => (c.id === clip.id ? firstClip : c));
      newClips.push(secondClip);

      return { ...state, clips: newClips, duration: computeDuration(newClips) };
    }

    case "DUPLICATE_CLIP": {
      const clip = state.clips.find((c) => c.id === action.payload);
      if (!clip) return state;

      const duplicate: Clip = {
        ...clip,
        id: generateClipId(),
        startTime: clip.startTime + clip.duration + 0.1,
        name: clip.name ? `${clip.name} (copy)` : undefined,
      };
      const newClips = [...state.clips, duplicate];
      return {
        ...state,
        clips: newClips,
        duration: computeDuration(newClips),
        selectedClipId: duplicate.id,
      };
    }

    case "UPDATE_CLIP": {
      return {
        ...state,
        clips: state.clips.map((c) =>
          c.id === action.payload.id ? { ...c, ...action.payload.updates } : c
        ),
      };
    }

    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.payload };

    case "SET_PLAYHEAD":
      return { ...state, playheadPosition: Math.max(0, Math.min(action.payload, state.duration)) };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.1, Math.min(10, action.payload)) };

    case "SET_PLAYING":
      return { ...state, isPlaying: action.payload };

    case "TOGGLE_SNAP":
      return { ...state, snapToGrid: !state.snapToGrid };

    case "SET_GRID_SIZE":
      return { ...state, gridSize: action.payload };

    case "SET_DURATION":
      return { ...state, duration: Math.max(1, action.payload) };

    case "RESTORE": {
      return {
        ...state,
        tracks: action.payload.tracks,
        clips: action.payload.clips,
        duration: computeDuration(action.payload.clips),
        selectedClipId: null,
      };
    }

    default:
      return state;
  }
}

// ─── Default State ────────────────────────────────────────────────

function createDefaultState(): TimelineState {
  const videoTrackId = generateTrackId();
  const audioTrackId = generateTrackId();
  const textTrackId = generateTrackId();

  return {
    tracks: [
      { id: videoTrackId, type: "video", name: "Video 1", isMuted: false, isSolo: false, isLocked: false, volume: 1, color: TRACK_COLORS.video },
      { id: audioTrackId, type: "audio", name: "Audio 1", isMuted: false, isSolo: false, isLocked: false, volume: 0.8, color: TRACK_COLORS.audio },
      { id: textTrackId, type: "text", name: "Text 1", isMuted: false, isSolo: false, isLocked: false, volume: 1, color: TRACK_COLORS.text },
    ],
    clips: [
      {
        id: generateClipId(),
        trackId: videoTrackId,
        type: "video",
        startTime: 0,
        duration: 5,
        name: "Intro Clip",
        thumbnailUrl: undefined,
      },
      {
        id: generateClipId(),
        trackId: videoTrackId,
        type: "video",
        startTime: 5.5,
        duration: 8,
        name: "Main Scene",
        thumbnailUrl: undefined,
      },
      {
        id: generateClipId(),
        trackId: audioTrackId,
        type: "audio",
        startTime: 0,
        duration: 14,
        name: "Background Music",
      },
      {
        id: generateClipId(),
        trackId: textTrackId,
        type: "text",
        startTime: 1,
        duration: 3,
        name: "Title Card",
        text: "DreamForge",
      },
    ],
    playheadPosition: 0,
    duration: 30,
    zoom: 1,
    isPlaying: false,
    selectedClipId: null,
    snapToGrid: true,
    gridSize: 0.5,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useTimeline() {
  const [state, dispatch] = useReducer(timelineReducer, undefined, createDefaultState);

  // Undo/redo history
  const historyRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const lastSnapshotRef = useRef<string>("");

  // Snapshot before mutating actions
  const pushHistory = useCallback(() => {
    const snapshot: HistoryEntry = {
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      clips: JSON.parse(JSON.stringify(state.clips)),
    };
    const key = JSON.stringify(snapshot);
    if (key !== lastSnapshotRef.current) {
      historyRef.current.push(snapshot);
      if (historyRef.current.length > 50) historyRef.current.shift();
      futureRef.current = [];
      lastSnapshotRef.current = key;
    }
  }, [state.tracks, state.clips]);

  // Playback timer
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.isPlaying) {
      playIntervalRef.current = setInterval(() => {
        dispatch({ type: "SET_PLAYHEAD", payload: state.playheadPosition + 1 / 30 });
      }, 1000 / 30);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [state.isPlaying, state.playheadPosition]);

  // Stop at end
  useEffect(() => {
    if (state.isPlaying && state.playheadPosition >= state.duration) {
      dispatch({ type: "SET_PLAYING", payload: false });
      dispatch({ type: "SET_PLAYHEAD", payload: 0 });
    }
  }, [state.isPlaying, state.playheadPosition, state.duration]);

  // Wrapped actions that push history
  const addTrack = useCallback(
    (track: Omit<Track, "id">) => {
      pushHistory();
      dispatch({ type: "ADD_TRACK", payload: track });
    },
    [pushHistory]
  );

  const removeTrack = useCallback(
    (id: string) => {
      pushHistory();
      dispatch({ type: "REMOVE_TRACK", payload: id });
    },
    [pushHistory]
  );

  const updateTrack = useCallback(
    (id: string, updates: Partial<Track>) => {
      dispatch({ type: "UPDATE_TRACK", payload: { id, updates } });
    },
    []
  );

  const addClip = useCallback(
    (clip: Omit<Clip, "id">) => {
      pushHistory();
      dispatch({ type: "ADD_CLIP", payload: clip });
    },
    [pushHistory]
  );

  const removeClip = useCallback(
    (id: string) => {
      pushHistory();
      dispatch({ type: "REMOVE_CLIP", payload: id });
    },
    [pushHistory]
  );

  const moveClip = useCallback(
    (id: string, startTime: number, trackId?: string) => {
      pushHistory();
      dispatch({ type: "MOVE_CLIP", payload: { id, startTime, trackId } });
    },
    [pushHistory]
  );

  const resizeClip = useCallback(
    (id: string, duration: number, startTime?: number, trimStart?: number, trimEnd?: number) => {
      pushHistory();
      dispatch({ type: "RESIZE_CLIP", payload: { id, duration, startTime, trimStart, trimEnd } });
    },
    [pushHistory]
  );

  const splitClip = useCallback(
    (id: string, splitTime: number) => {
      pushHistory();
      dispatch({ type: "SPLIT_CLIP", payload: { id, splitTime } });
    },
    [pushHistory]
  );

  const duplicateClip = useCallback(
    (id: string) => {
      pushHistory();
      dispatch({ type: "DUPLICATE_CLIP", payload: id });
    },
    [pushHistory]
  );

  const updateClip = useCallback(
    (id: string, updates: Partial<Clip>) => {
      dispatch({ type: "UPDATE_CLIP", payload: { id, updates } });
    },
    []
  );

  const selectClip = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_CLIP", payload: id });
  }, []);

  const setPlayhead = useCallback((position: number) => {
    dispatch({ type: "SET_PLAYHEAD", payload: position });
  }, []);

  const setZoom = useCallback((zoom: number) => {
    dispatch({ type: "SET_ZOOM", payload: zoom });
  }, []);

  const togglePlay = useCallback(() => {
    dispatch({ type: "SET_PLAYING", payload: !state.isPlaying });
  }, [state.isPlaying]);

  const setPlaying = useCallback((playing: boolean) => {
    dispatch({ type: "SET_PLAYING", payload: playing });
  }, []);

  const toggleSnap = useCallback(() => {
    dispatch({ type: "TOGGLE_SNAP" });
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push({
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      clips: JSON.parse(JSON.stringify(state.clips)),
    });
    lastSnapshotRef.current = JSON.stringify(prev);
    dispatch({ type: "RESTORE", payload: prev });
  }, [state.tracks, state.clips]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push({
      tracks: JSON.parse(JSON.stringify(state.tracks)),
      clips: JSON.parse(JSON.stringify(state.clips)),
    });
    lastSnapshotRef.current = JSON.stringify(next);
    dispatch({ type: "RESTORE", payload: next });
  }, [state.tracks, state.clips]);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const selectedClip = state.clips.find((c) => c.id === state.selectedClipId) ?? null;
  const selectedTrack = selectedClip ? state.tracks.find((t) => t.id === selectedClip.trackId) ?? null : null;

  return {
    state,
    selectedClip,
    selectedTrack,
    canUndo,
    canRedo,
    // Actions
    addTrack,
    removeTrack,
    updateTrack,
    addClip,
    removeClip,
    moveClip,
    resizeClip,
    splitClip,
    duplicateClip,
    updateClip,
    selectClip,
    setPlayhead,
    setZoom,
    togglePlay,
    setPlaying,
    toggleSnap,
    undo,
    redo,
    dispatch,
  };
}

export type UseTimelineReturn = ReturnType<typeof useTimeline>;
