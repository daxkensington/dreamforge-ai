import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import {
  Scissors, Plus, Type, Sparkles, Upload, Image, Undo2, Redo2,
  Download, Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Magnet, ZoomIn, ZoomOut, Film, Music, ArrowLeftToLine,
} from "lucide-react";
import type { UseTimelineReturn } from "@/hooks/useTimeline";

interface TimelineToolbarProps {
  timeline: UseTimelineReturn;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export default function TimelineToolbar({ timeline }: TimelineToolbarProps) {
  const { state, canUndo, canRedo, togglePlay, setPlayhead, setZoom, undo, redo, toggleSnap, addClip, addTrack, splitClip, setPlaying } = timeline;

  const handleSplitAtPlayhead = () => {
    // Find the clip under the playhead on the first matching track
    const clipUnderPlayhead = state.clips.find(
      (c) => c.startTime <= state.playheadPosition && c.startTime + c.duration > state.playheadPosition
    );
    if (clipUnderPlayhead) {
      splitClip(clipUnderPlayhead.id, state.playheadPosition);
    }
  };

  const handleAddVideoTrack = () => {
    const videoCount = state.tracks.filter((t) => t.type === "video").length;
    addTrack({
      type: "video",
      name: `Video ${videoCount + 1}`,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      volume: 1,
      color: "#8b5cf6",
    });
  };

  const handleAddAudioTrack = () => {
    const audioCount = state.tracks.filter((t) => t.type === "audio").length;
    addTrack({
      type: "audio",
      name: `Audio ${audioCount + 1}`,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      volume: 0.8,
      color: "#06b6d4",
    });
  };

  const handleAddTextOverlay = () => {
    const textTrack = state.tracks.find((t) => t.type === "text");
    if (!textTrack) return;
    addClip({
      trackId: textTrack.id,
      type: "text",
      startTime: state.playheadPosition,
      duration: 3,
      text: "New Text",
      name: "Text Overlay",
    });
  };

  const handleFrameBack = () => {
    setPlayhead(Math.max(0, state.playheadPosition - 1 / 30));
  };

  const handleFrameForward = () => {
    setPlayhead(Math.min(state.duration, state.playheadPosition + 1 / 30));
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-background/80 border-b border-border/30 backdrop-blur-sm">
      {/* Left: Edit tools */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSplitAtPlayhead}>
              <Scissors className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Split at Playhead (B)</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Add Clip</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Generate
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Image className="mr-2 h-4 w-4" />
              From Gallery
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleAddVideoTrack}>
              <Film className="mr-2 h-4 w-4" />
              Add Video Track
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddAudioTrack}>
              <Music className="mr-2 h-4 w-4" />
              Add Audio Track
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAddTextOverlay}>
              <Type className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Text Overlay</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border/40 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
      </div>

      {/* Center: Playback controls */}
      <div className="flex-1 flex items-center justify-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlayhead(0)}>
              <ArrowLeftToLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go to Start</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFrameBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Frame Back</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20"
              onClick={togglePlay}
            >
              {state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play/Pause (Space)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFrameForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Frame Forward</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlayhead(state.duration)}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go to End</TooltipContent>
        </Tooltip>

        <div className="ml-2 text-xs font-mono text-muted-foreground bg-background/60 px-2 py-1 rounded">
          {formatTime(state.playheadPosition)}
          <span className="text-foreground/30 mx-1">/</span>
          {formatTime(state.duration)}
        </div>
      </div>

      {/* Right: Zoom and export */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${state.snapToGrid ? "text-violet-400 bg-violet-500/10" : ""}`}
              onClick={toggleSnap}
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap to Grid</TooltipContent>
        </Tooltip>

        <div className="w-px h-5 bg-border/40 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(Math.max(0.1, state.zoom - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <div className="w-24">
          <Slider
            value={[state.zoom * 100]}
            onValueChange={([v]) => setZoom(v / 100)}
            min={10}
            max={500}
            step={5}
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoom(Math.min(5, state.zoom + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <span className="text-[10px] text-muted-foreground w-10 text-center">
          {Math.round(state.zoom * 100)}%
        </span>

        <div className="w-px h-5 bg-border/40 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="default" size="sm" className="h-8 gap-1.5 px-3">
              <Download className="h-3.5 w-3.5" />
              <span className="text-xs">Export</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export Video</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
