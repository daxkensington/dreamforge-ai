import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Volume2, VolumeX, Eye, EyeOff, Lock, Unlock, Headphones,
  Film, Music, Type,
} from "lucide-react";
import type { Track, Clip } from "@/hooks/useTimeline";
import TimelineClip from "./TimelineClip";

interface TimelineTrackProps {
  track: Track;
  clips: Clip[];
  zoom: number;
  pixelsPerSecond: number;
  selectedClipId: string | null;
  duration: number;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onSelectClip: (id: string | null) => void;
  onMoveClip: (id: string, startTime: number) => void;
  onResizeClip: (id: string, duration: number, startTime?: number) => void;
  onSplitClip: (id: string, splitTime: number) => void;
  onDeleteClip: (id: string) => void;
  onDuplicateClip: (id: string) => void;
  onClickTrack: (trackId: string, time: number) => void;
}

const TRACK_ICONS: Record<string, React.ElementType> = {
  video: Film,
  audio: Music,
  text: Type,
};

const TRACK_ACCENT: Record<string, string> = {
  video: "border-l-violet-500",
  audio: "border-l-cyan-500",
  text: "border-l-cyan-500",
};

export default function TimelineTrack({
  track,
  clips,
  zoom,
  pixelsPerSecond,
  selectedClipId,
  duration,
  onUpdateTrack,
  onSelectClip,
  onMoveClip,
  onResizeClip,
  onSplitClip,
  onDeleteClip,
  onDuplicateClip,
  onClickTrack,
}: TimelineTrackProps) {
  const Icon = TRACK_ICONS[track.type] ?? Film;
  const accent = TRACK_ACCENT[track.type] ?? "border-l-gray-500";
  const totalWidth = duration * pixelsPerSecond;

  return (
    <div className={`flex border-b border-border/30 hover:bg-white/[0.02] transition-colors ${track.isLocked ? "opacity-60" : ""}`}>
      {/* Track label */}
      <div className={`w-48 shrink-0 flex flex-col gap-1.5 p-2 border-r border-border/30 border-l-2 ${accent} bg-background/60`}>
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 opacity-60" />
          <span className="text-xs font-medium truncate flex-1">{track.name}</span>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Mute */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUpdateTrack(track.id, { isMuted: !track.isMuted })}
                className={`h-6 w-6 flex items-center justify-center rounded transition-colors
                  ${track.isMuted ? "bg-red-500/20 text-red-400" : "hover:bg-white/10 text-muted-foreground"}`}
              >
                {track.isMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{track.isMuted ? "Unmute" : "Mute"}</TooltipContent>
          </Tooltip>

          {/* Solo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUpdateTrack(track.id, { isSolo: !track.isSolo })}
                className={`h-6 w-6 flex items-center justify-center rounded transition-colors
                  ${track.isSolo ? "bg-yellow-500/20 text-yellow-400" : "hover:bg-white/10 text-muted-foreground"}`}
              >
                <Headphones className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{track.isSolo ? "Unsolo" : "Solo"}</TooltipContent>
          </Tooltip>

          {/* Lock */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUpdateTrack(track.id, { isLocked: !track.isLocked })}
                className={`h-6 w-6 flex items-center justify-center rounded transition-colors
                  ${track.isLocked ? "bg-blue-500/20 text-blue-400" : "hover:bg-white/10 text-muted-foreground"}`}
              >
                {track.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{track.isLocked ? "Unlock" : "Lock"}</TooltipContent>
          </Tooltip>

          {/* Visibility */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUpdateTrack(track.id, { isMuted: !track.isMuted })}
                className={`h-6 w-6 flex items-center justify-center rounded transition-colors hover:bg-white/10 text-muted-foreground`}
              >
                {track.isMuted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{track.isMuted ? "Show" : "Hide"}</TooltipContent>
          </Tooltip>
        </div>

        {/* Volume slider for audio tracks */}
        {track.type === "audio" && (
          <div className="flex items-center gap-2 px-0.5">
            <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <Slider
              value={[track.volume * 100]}
              onValueChange={([v]) => onUpdateTrack(track.id, { volume: v / 100 })}
              max={100}
              min={0}
              step={1}
              className="flex-1"
            />
            <span className="text-[9px] text-muted-foreground w-6 text-right">
              {Math.round(track.volume * 100)}
            </span>
          </div>
        )}
      </div>

      {/* Track timeline area */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{ minHeight: "56px" }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
          const time = x / pixelsPerSecond;
          onClickTrack(track.id, time);
        }}
      >
        <div className="relative h-full" style={{ width: `${totalWidth}px` }}>
          {/* Grid lines */}
          {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-border/10"
              style={{ left: `${i * pixelsPerSecond}px` }}
            />
          ))}

          {/* Clips */}
          {clips.map((clip) => (
            <TimelineClip
              key={clip.id}
              clip={clip}
              track={track}
              zoom={zoom}
              isSelected={clip.id === selectedClipId}
              pixelsPerSecond={pixelsPerSecond}
              onSelect={() => onSelectClip(clip.id)}
              onMove={(startTime) => onMoveClip(clip.id, startTime)}
              onResize={(duration, startTime) => onResizeClip(clip.id, duration, startTime)}
              onSplit={(splitTime) => onSplitClip(clip.id, splitTime)}
              onDelete={() => onDeleteClip(clip.id)}
              onDuplicate={() => onDuplicateClip(clip.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
