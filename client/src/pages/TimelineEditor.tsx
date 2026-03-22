import { useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import PageLayout from "@/components/PageLayout";
import TimelineEditorComponent from "@/components/timeline/TimelineEditor";
import TimelineToolbar from "@/components/timeline/TimelineToolbar";
import TimelinePreview from "@/components/timeline/TimelinePreview";
import PropertiesPanel from "@/components/timeline/PropertiesPanel";
import { useTimeline } from "@/hooks/useTimeline";
import { ArrowLeft, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TimelineEditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const timeline = useTimeline();

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          timeline.togglePlay();
          break;
        case "KeyB":
          // Split clip at playhead
          const clipAtPlayhead = timeline.state.clips.find(
            (c) =>
              c.startTime < timeline.state.playheadPosition &&
              c.startTime + c.duration > timeline.state.playheadPosition
          );
          if (clipAtPlayhead) {
            timeline.splitClip(clipAtPlayhead.id, timeline.state.playheadPosition);
          }
          break;
        case "Delete":
        case "Backspace":
          if (timeline.state.selectedClipId) {
            e.preventDefault();
            timeline.removeClip(timeline.state.selectedClipId);
          }
          break;
        case "KeyZ":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              timeline.redo();
            } else {
              timeline.undo();
            }
          }
          break;
        case "KeyD":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (timeline.state.selectedClipId) {
              timeline.duplicateClip(timeline.state.selectedClipId);
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          timeline.setPlayhead(
            Math.max(0, timeline.state.playheadPosition - (e.shiftKey ? 1 : 1 / 30))
          );
          break;
        case "ArrowRight":
          e.preventDefault();
          timeline.setPlayhead(
            Math.min(timeline.state.duration, timeline.state.playheadPosition + (e.shiftKey ? 1 : 1 / 30))
          );
          break;
        case "Home":
          e.preventDefault();
          timeline.setPlayhead(0);
          break;
        case "End":
          e.preventDefault();
          timeline.setPlayhead(timeline.state.duration);
          break;
        case "Equal":
        case "NumpadAdd":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            timeline.setZoom(Math.min(5, timeline.state.zoom + 0.25));
          }
          break;
        case "Minus":
        case "NumpadSubtract":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            timeline.setZoom(Math.max(0.1, timeline.state.zoom - 0.25));
          }
          break;
        case "Escape":
          timeline.selectClip(null);
          break;
      }
    },
    [timeline]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <PageLayout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 bg-background/90 backdrop-blur-sm shrink-0">
          <Link href={projectId ? `/video-studio/project/${projectId}` : "/video-studio"}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-violet-400" />
            <h1 className="text-sm font-semibold">Timeline Editor</h1>
          </div>
          {projectId && (
            <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
              Project #{projectId}
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div className="shrink-0">
          <TimelineToolbar timeline={timeline} />
        </div>

        {/* Main area: Preview + Properties */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Preview */}
          <motion.div
            className="flex-1 min-w-0"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TimelinePreview timeline={timeline} />
          </motion.div>

          {/* Properties Panel */}
          <motion.div
            className="w-72 shrink-0"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PropertiesPanel
              clip={timeline.selectedClip}
              track={timeline.selectedTrack}
              onUpdateClip={timeline.updateClip}
              onClose={() => timeline.selectClip(null)}
            />
          </motion.div>
        </div>

        {/* Timeline tracks area */}
        <motion.div
          className="h-[280px] shrink-0 border-t border-border/30"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <TimelineEditorComponent timeline={timeline} />
        </motion.div>
      </div>
    </PageLayout>
  );
}
