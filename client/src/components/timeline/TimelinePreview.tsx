import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Maximize } from "lucide-react";
import type { UseTimelineReturn } from "@/hooks/useTimeline";
import { createTimelineRenderer } from "./timelineMedia";

export default function TimelinePreview({ timeline }: { timeline: UseTimelineReturn }) {
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const renderer = useRef<Awaited<ReturnType<typeof createTimelineRenderer>> | null>(null);
  const current = useRef(timeline); current.current = timeline;
  const [error, setError] = useState(""), [loading, setLoading] = useState(false), [ready, setReady] = useState(0);
  const mediaKey = JSON.stringify(timeline.state.clips.filter(c => c.sourceUrl).map(c => [c.id, c.sourceUrl, c.mediaKind]));
  useEffect(() => {
    if (!canvas.current) return;
    const abort = new AbortController(); setLoading(true); setError("");
    void createTimelineRenderer(current.current.document, canvas.current, { signal: abort.signal }).then(player => {
      if (abort.signal.aborted) { player.dispose(); return; }
      renderer.current = player; setLoading(false); setReady(value => value + 1);
    }).catch(error => { if (!abort.signal.aborted) { setLoading(false); setError(error instanceof Error ? error.message : "Media failed to load"); } });
    return () => { abort.abort(); renderer.current?.dispose(); renderer.current = null; };
  }, [mediaKey]);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const value = current.current;
      try { renderer.current?.draw(value.document, value.state.playheadPosition, value.state.isPlaying); }
      catch (error) { setError(error instanceof Error ? error.message : "Playback failed"); value.setPlaying(false); return; }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [ready]);
  return <div ref={container} className="flex flex-col h-full bg-black min-h-[240px]">
    <div className="flex justify-between items-center px-3 py-2 bg-background/80 text-xs">
      <span>Preview · 1280 × 720 · 30 fps</span>
      <Button size="icon" variant="ghost" aria-label="Fullscreen preview" onClick={() => void container.current?.requestFullscreen().catch(() => setError("Fullscreen is unavailable"))}><Maximize className="h-4 w-4" /></Button>
    </div>
    <div className="flex-1 relative flex items-center justify-center min-h-0">
      <canvas ref={canvas} width={1280} height={720} aria-label="Timeline video preview" className="w-full max-h-full object-contain aspect-video" />
      {loading && <p role="status" className="absolute bg-black/80 p-3 text-sm">Loading media…</p>}
      {error && <p role="alert" className="absolute bottom-2 inset-x-2 bg-red-950/95 p-3 text-sm">{error}</p>}
      {!timeline.state.clips.length && <p className="absolute text-sm text-white/60">Upload media, import a saved generation, or add text to begin.</p>}
    </div>
    <div className="flex items-center gap-3 px-3 py-2 bg-background/80">
      <Button aria-label={timeline.state.isPlaying ? "Pause preview" : "Play preview"} size="sm" variant="outline" disabled={loading || !!error} onClick={timeline.togglePlay}>{timeline.state.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
      <input className="flex-1" aria-label="Preview position" type="range" min={0} max={timeline.state.duration} step={1 / 30} value={timeline.state.playheadPosition} onChange={event => timeline.setPlayhead(Number(event.target.value))} />
      <span className="font-mono text-xs">{timeline.state.playheadPosition.toFixed(2)} / {timeline.state.duration.toFixed(2)} s</span>
    </div>
  </div>;
}
