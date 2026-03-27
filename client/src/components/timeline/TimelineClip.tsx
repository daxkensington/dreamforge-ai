import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Scissors, Trash2, Copy, Sparkles, GripVertical, Type, Music, Film } from "lucide-react";
import type { Clip, Track } from "@/hooks/useTimeline";

interface TimelineClipProps {
  clip: Clip;
  track: Track;
  zoom: number;
  isSelected: boolean;
  pixelsPerSecond: number;
  onSelect: () => void;
  onMove: (startTime: number) => void;
  onResize: (duration: number, startTime?: number) => void;
  onSplit: (splitTime: number) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const CLIP_TYPE_COLORS: Record<string, { bg: string; border: string; handle: string }> = {
  video: { bg: "bg-violet-500/30", border: "border-violet-500/60", handle: "bg-violet-400" },
  audio: { bg: "bg-cyan-500/30", border: "border-cyan-500/60", handle: "bg-cyan-400" },
  text: { bg: "bg-cyan-500/30", border: "border-cyan-500/60", handle: "bg-cyan-400" },
  transition: { bg: "bg-pink-500/30", border: "border-pink-500/60", handle: "bg-pink-400" },
};

const CLIP_TYPE_ICONS: Record<string, React.ElementType> = {
  video: Film,
  audio: Music,
  text: Type,
  transition: Sparkles,
};

export default function TimelineClip({
  clip,
  track,
  zoom,
  isSelected,
  pixelsPerSecond,
  onSelect,
  onMove,
  onResize,
  onSplit,
  onDelete,
  onDuplicate,
}: TimelineClipProps) {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const dragStartRef = useRef({ x: 0, startTime: 0 });
  const resizeStartRef = useRef({ x: 0, startTime: 0, duration: 0 });

  const left = clip.startTime * pixelsPerSecond;
  const width = Math.max(clip.duration * pixelsPerSecond, 20);

  const colors = CLIP_TYPE_COLORS[clip.type] ?? CLIP_TYPE_COLORS.video;
  const Icon = CLIP_TYPE_ICONS[clip.type] ?? Film;

  // Drag handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (track.isLocked) return;
      if ((e.target as HTMLElement).dataset.handle) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, startTime: clip.startTime };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - dragStartRef.current.x;
        const dt = dx / pixelsPerSecond;
        const newStart = Math.max(0, dragStartRef.current.startTime + dt);
        onMove(newStart);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [clip.startTime, pixelsPerSecond, onMove, onSelect, track.isLocked]
  );

  // Left resize
  const handleResizeLeft = useCallback(
    (e: React.MouseEvent) => {
      if (track.isLocked) return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizingLeft(true);
      resizeStartRef.current = { x: e.clientX, startTime: clip.startTime, duration: clip.duration };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - resizeStartRef.current.x;
        const dt = dx / pixelsPerSecond;
        const newStart = Math.max(0, resizeStartRef.current.startTime + dt);
        const newDuration = resizeStartRef.current.duration - (newStart - resizeStartRef.current.startTime);
        if (newDuration > 0.1) {
          onResize(newDuration, newStart);
        }
      };

      const handleMouseUp = () => {
        setIsResizingLeft(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [clip.startTime, clip.duration, pixelsPerSecond, onResize, track.isLocked]
  );

  // Right resize
  const handleResizeRight = useCallback(
    (e: React.MouseEvent) => {
      if (track.isLocked) return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizingRight(true);
      resizeStartRef.current = { x: e.clientX, startTime: clip.startTime, duration: clip.duration };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - resizeStartRef.current.x;
        const dt = dx / pixelsPerSecond;
        const newDuration = Math.max(0.1, resizeStartRef.current.duration + dt);
        onResize(newDuration);
      };

      const handleMouseUp = () => {
        setIsResizingRight(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [clip.duration, pixelsPerSecond, onResize, track.isLocked]
  );

  const displayName = clip.name || clip.text || clip.type;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          ref={clipRef}
          className={`absolute top-1 bottom-1 rounded-md border cursor-grab select-none flex items-center overflow-hidden group
            ${colors.bg} ${colors.border}
            ${isSelected ? "ring-2 ring-white/50 shadow-lg shadow-white/10" : ""}
            ${isDragging ? "cursor-grabbing opacity-80 z-30" : "z-10"}
            ${isResizingLeft || isResizingRight ? "z-30" : ""}
            ${track.isLocked ? "opacity-50 cursor-not-allowed" : ""}
          `}
          style={{
            left: `${left}px`,
            width: `${width}px`,
          }}
          onMouseDown={handleMouseDown}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          initial={false}
          animate={{
            scale: isSelected ? 1 : 1,
            y: isDragging ? -2 : 0,
          }}
          transition={{ duration: 0.1 }}
        >
          {/* Left resize handle */}
          <div
            data-handle="left"
            className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:${colors.handle} opacity-0 group-hover:opacity-100 transition-opacity rounded-l-md z-20`}
            onMouseDown={handleResizeLeft}
          />

          {/* Clip content */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 w-full min-w-0">
            <Icon className="h-3 w-3 shrink-0 opacity-70" />
            <span className="text-[10px] font-medium truncate opacity-90">
              {displayName}
            </span>
            {clip.type === "audio" && (
              <div className="flex-1 flex items-center gap-0.5 opacity-40 ml-1">
                {Array.from({ length: Math.min(Math.floor(width / 6), 40) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-current rounded-full"
                    style={{ height: `${4 + Math.random() * 14}px` }}
                  />
                ))}
              </div>
            )}
            {clip.type === "video" && clip.thumbnailUrl && (
              <div className="absolute inset-0 opacity-20">
                <img
                  src={clip.thumbnailUrl}
                  alt="AI generated content"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Right resize handle */}
          <div
            data-handle="right"
            className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:${colors.handle} opacity-0 group-hover:opacity-100 transition-opacity rounded-r-md z-20`}
            onMouseDown={handleResizeRight}
          />

          {/* Drag indicator on hover */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
            <GripVertical className="h-3 w-3" />
          </div>
        </motion.div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onSplit(clip.startTime + clip.duration / 2)}>
          <Scissors className="mr-2 h-4 w-4" />
          Split at Playhead
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>
          <Sparkles className="mr-2 h-4 w-4" />
          Replace with AI
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
