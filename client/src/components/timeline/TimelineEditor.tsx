import { useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Layers } from "lucide-react";
import type { UseTimelineReturn } from "@/hooks/useTimeline";
import TimelineTrack from "./TimelineTrack";

interface TimelineEditorProps {
  timeline: UseTimelineReturn;
}

const BASE_PIXELS_PER_SECOND = 60;

export default function TimelineEditor({ timeline }: TimelineEditorProps) {
  const { state, selectClip, moveClip, resizeClip, splitClip, removeClip, duplicateClip, updateTrack, setPlayhead } = timeline;
  const scrollRef = useRef<HTMLDivElement>(null);

  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * state.zoom;
  const totalWidth = state.duration * pixelsPerSecond;
  const playheadLeft = state.playheadPosition * pixelsPerSecond;

  // Time ruler ticks
  const ticks = useMemo(() => {
    const result: { time: number; major: boolean }[] = [];
    // Determine tick spacing based on zoom
    let tickInterval = 1; // seconds
    if (state.zoom < 0.3) tickInterval = 5;
    else if (state.zoom < 0.6) tickInterval = 2;
    else if (state.zoom > 2) tickInterval = 0.5;
    else if (state.zoom > 4) tickInterval = 0.25;

    for (let t = 0; t <= state.duration; t += tickInterval) {
      result.push({ time: t, major: t % (tickInterval * 4) === 0 || tickInterval >= 1 && t % 5 === 0 });
    }
    return result;
  }, [state.duration, state.zoom]);

  const formatRulerTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0) return `${m}:${String(s).padStart(2, "0")}`;
    return `${s}s`;
  };

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      const time = x / pixelsPerSecond;
      setPlayhead(Math.max(0, Math.min(time, state.duration)));
    },
    [pixelsPerSecond, setPlayhead, state.duration]
  );

  const handleTrackClick = useCallback(
    (_trackId: string, time: number) => {
      selectClip(null);
      setPlayhead(Math.max(0, Math.min(time, state.duration)));
    },
    [selectClip, setPlayhead, state.duration]
  );

  return (
    <div className="flex flex-col h-full bg-background/40 select-none">
      {/* Timeline header with info */}
      <div className="flex items-center gap-3 px-3 py-1 border-b border-border/20 bg-background/60">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Layers className="h-3 w-3" />
          <span>{state.tracks.length} tracks</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{state.clips.length} clips</span>
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          Duration: {state.duration.toFixed(1)}s
        </span>
      </div>

      {/* Scrollable timeline area */}
      <div className="flex-1 overflow-hidden flex flex-col" ref={scrollRef}>
        {/* Time ruler */}
        <div
          className="flex border-b border-border/30 bg-background/80 cursor-pointer shrink-0"
          onClick={handleRulerClick}
        >
          {/* Track label spacer */}
          <div className="w-48 shrink-0 border-r border-border/30 flex items-end px-2 pb-0.5">
            <span className="text-[9px] text-muted-foreground/50">TIME</span>
          </div>
          {/* Ruler */}
          <div className="flex-1 overflow-x-auto relative" style={{ minHeight: "28px" }}>
            <div className="relative h-full" style={{ width: `${totalWidth}px` }}>
              {ticks.map(({ time, major }) => (
                <div
                  key={time}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: `${time * pixelsPerSecond}px` }}
                >
                  <div
                    className={`w-px ${major ? "h-full bg-border/40" : "h-2/3 bg-border/20"} mt-auto`}
                  />
                  {major && (
                    <span className="absolute top-0.5 text-[9px] text-muted-foreground/60 -translate-x-1/2 whitespace-nowrap">
                      {formatRulerTime(time)}
                    </span>
                  )}
                </div>
              ))}

              {/* Playhead on ruler */}
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{ left: `${playheadLeft}px` }}
              >
                <div className="relative">
                  <div className="absolute -left-1.5 top-0 w-3 h-3 bg-red-500 clip-triangle" />
                  <div className="absolute left-0 top-0 w-px h-7 bg-red-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-auto relative">
          <div className="relative">
            {state.tracks.map((track) => {
              const trackClips = state.clips.filter((c) => c.trackId === track.id);
              return (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  clips={trackClips}
                  zoom={state.zoom}
                  pixelsPerSecond={pixelsPerSecond}
                  selectedClipId={state.selectedClipId}
                  duration={state.duration}
                  onUpdateTrack={updateTrack}
                  onSelectClip={selectClip}
                  onMoveClip={moveClip}
                  onResizeClip={resizeClip}
                  onSplitClip={splitClip}
                  onDeleteClip={removeClip}
                  onDuplicateClip={duplicateClip}
                  onClickTrack={handleTrackClick}
                />
              );
            })}

            {/* Playhead line across all tracks */}
            <motion.div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: `${playheadLeft + 192}px` }} // 192px = track label width
              initial={false}
              animate={{ left: `${playheadLeft + 192}px` }}
              transition={{ duration: state.isPlaying ? 1 / 30 : 0.1, ease: "linear" }}
            >
              <div className="w-px h-full bg-red-500/80" />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Custom CSS for playhead triangle */}
      <style>{`
        .clip-triangle {
          clip-path: polygon(50% 100%, 0 0, 100% 0);
        }
      `}</style>
    </div>
  );
}
