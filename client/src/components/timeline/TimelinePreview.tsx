import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Pause, Maximize, Minimize, Monitor, Film } from "lucide-react";
import type { UseTimelineReturn } from "@/hooks/useTimeline";

interface TimelinePreviewProps {
  timeline: UseTimelineReturn;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export default function TimelinePreview({ timeline }: TimelinePreviewProps) {
  const { state, togglePlay, selectedClip } = timeline;
  const [resolution, setResolution] = useState("720p");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Find current clip at playhead for preview
  const currentVideoClip = state.clips.find(
    (c) =>
      c.type === "video" &&
      c.startTime <= state.playheadPosition &&
      c.startTime + c.duration > state.playheadPosition
  );

  const currentTextClip = state.clips.find(
    (c) =>
      c.type === "text" &&
      c.startTime <= state.playheadPosition &&
      c.startTime + c.duration > state.playheadPosition
  );

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Preview header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger className="h-6 w-20 text-[10px] border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="360p">360p</SelectItem>
              <SelectItem value="480p">480p</SelectItem>
              <SelectItem value="720p">720p</SelectItem>
              <SelectItem value="1080p">1080p</SelectItem>
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleFullscreen}>
                {isFullscreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fullscreen</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center bg-black/40 relative overflow-hidden min-h-[200px]">
        <div className="relative w-full max-w-[480px] aspect-video bg-black/80 rounded-sm overflow-hidden">
          {/* Video preview placeholder */}
          {currentVideoClip ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {currentVideoClip.thumbnailUrl ? (
                <img
                  src={currentVideoClip.thumbnailUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Film className="h-10 w-10 opacity-30" />
                  <span className="text-xs opacity-50">{currentVideoClip.name || "Video Clip"}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Film className="h-12 w-12 opacity-20" />
              <span className="text-xs opacity-30 mt-2">No clip at playhead</span>
            </div>
          )}

          {/* Text overlay */}
          {currentTextClip && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span
                className="text-white text-2xl font-bold drop-shadow-lg px-4 py-2"
                style={currentTextClip.style as React.CSSProperties}
              >
                {currentTextClip.text}
              </span>
            </motion.div>
          )}

          {/* Playing indicator */}
          {state.isPlaying && (
            <motion.div
              className="absolute top-2 left-2 flex items-center gap-1 bg-red-500/80 px-1.5 py-0.5 rounded text-[10px] font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              PLAYING
            </motion.div>
          )}

          {/* Timecode overlay */}
          <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono text-white/70">
            {formatTime(state.playheadPosition)}
          </div>
        </div>

        {/* Play button overlay */}
        <button
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          onClick={togglePlay}
        >
          <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
            {state.isPlaying ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-1" />
            )}
          </div>
        </button>
      </div>
    </div>
  );
}
