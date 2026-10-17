import { useMemo } from "react";
import type { UseTimelineReturn } from "@/hooks/useTimeline";
import TimelineTrack from "./TimelineTrack";

export default function TimelineEditor({ timeline }: { timeline: UseTimelineReturn }) {
  const { state } = timeline, pixelsPerSecond = 60 * state.zoom;
  const width = Math.max(600, state.duration * pixelsPerSecond + 80);
  const ticks = useMemo(() => {
    const interval = state.zoom < .3 ? 5 : state.zoom < .6 ? 2 : state.zoom > 2 ? .5 : 1;
    return Array.from({ length: Math.floor(state.duration / interval) + 1 }, (_, i) => i * interval);
  }, [state.duration, state.zoom]);
  return <div className="flex flex-col h-full bg-background/40 select-none">
    <div className="px-3 py-1 text-xs text-muted-foreground border-b">{state.tracks.length} tracks · {state.clips.length} clips · {state.duration.toFixed(2)} seconds. Drag a clip to move it; drag an edge to trim it. Space plays; B splits the selected clip.</div>
    <div className="flex-1 overflow-auto">
      <div className="relative" style={{ width: width + 192 }}>
        <div className="flex border-b border-border/30 h-8 bg-background sticky top-0 z-40">
          <div className="w-48 shrink-0 sticky left-0 bg-background border-r px-2 text-[10px] flex items-center z-40">TIME · track controls</div>
          <div role="slider" aria-label="Timeline playhead" aria-valuemin={0} aria-valuemax={state.duration} aria-valuenow={state.playheadPosition} tabIndex={0} className="relative cursor-pointer flex-1" onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); timeline.setPlayhead((event.clientX - rect.left) / pixelsPerSecond); }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); timeline.setPlayhead(state.playheadPosition + (event.key === "ArrowLeft" ? -1 : 1) / 30); } }}>
            {ticks.map(time => <span key={time} className="absolute top-0 bottom-0 border-l border-border/30 text-[9px] text-muted-foreground pl-1" style={{ left: time * pixelsPerSecond }}>{time.toFixed(time % 1 ? 1 : 0)}s</span>)}
            <span className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: state.playheadPosition * pixelsPerSecond }} />
          </div>
        </div>
        {state.tracks.map(track => <TimelineTrack key={track.id} track={track} readOnly={!timeline.editable} clips={state.clips.filter(clip => clip.trackId === track.id)} zoom={state.zoom} pixelsPerSecond={pixelsPerSecond} selectedClipId={state.selectedClipId} duration={width / pixelsPerSecond}
          onUpdateTrack={timeline.updateTrack} onSelectClip={timeline.selectClip} onMoveClip={timeline.moveClip} onResizeClip={timeline.resizeClip} onSplitClip={timeline.splitClip} onDeleteClip={timeline.removeClip} onDuplicateClip={timeline.duplicateClip}
          onClickTrack={(_track, time) => { timeline.selectClip(null); timeline.setPlayhead(time); }} />)}
        <span className="absolute top-8 bottom-0 w-px bg-red-500 pointer-events-none z-20" style={{ left: 192 + state.playheadPosition * pixelsPerSecond }} />
      </div>
    </div>
  </div>;
}
