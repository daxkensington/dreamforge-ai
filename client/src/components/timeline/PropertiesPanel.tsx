import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Clip, Track } from "@/hooks/useTimeline";

export default function PropertiesPanel({ clip, track, onUpdateClip, onClose, readOnly = false }: {
  clip: Clip | null; track: Track | null; onUpdateClip: (id: string, changes: Partial<Clip>) => void; onClose: () => void; readOnly?: boolean;
}) {
  const update = (changes: Partial<Clip>) => { if (clip) onUpdateClip(clip.id, changes); };
  const number = (label: string, value: number, change: (value: number) => void, min = 0, max = 1800) => <label className="block text-xs space-y-1">{label}<Input aria-label={label} type="number" min={min} max={max} step={.1} value={Number(value.toFixed(2))} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) change(value); }} /></label>;
  return <div className="h-full border-l border-border/30 bg-background/60 overflow-y-auto p-3 space-y-3">
    <div className="flex justify-between items-center text-sm font-medium">Clip properties <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close clip properties">×</Button></div>
    {!clip ? <p className="text-xs text-muted-foreground">Select a clip to edit its timing, trim, volume or text.</p> : <fieldset disabled={readOnly || track?.isLocked} className="space-y-3 disabled:opacity-60">
      {track?.isLocked && <p className="text-xs">Unlock the track to edit this clip.</p>}
      <label className="block text-xs space-y-1">Name<Input value={clip.name ?? ""} maxLength={256} onChange={e => update({ name: e.target.value })} /></label>
      {number("Timeline start (seconds)", clip.startTime, value => update({ startTime: value }))}
      {number("Duration (seconds)", clip.duration, value => update({ duration: value }), .1)}
      {clip.type !== "text" && clip.mediaKind !== "image" && number("Source in-point (seconds)", clip.trimStart ?? 0, value => update({ trimStart: value }), 0, clip.sourceDuration ?? 1800)}
      {clip.sourceDuration && <p className="text-xs text-muted-foreground">Source length {clip.sourceDuration.toFixed(2)} s. Trim changes which part of the source plays.</p>}
      {clip.type === "text" ? <>
        <label className="block text-xs space-y-1">Text<textarea className="w-full border rounded bg-background p-2" rows={3} maxLength={2000} value={clip.text ?? ""} onChange={e => update({ text: e.target.value })} /></label>
        {number("Font size", clip.style?.fontSize ?? 32, value => update({ style: { ...clip.style, fontSize: Math.max(8, Math.min(128, value)) } }), 8, 128)}
        <label className="block text-xs">Text color <input aria-label="Text color" type="color" value={clip.style?.color ?? "#ffffff"} onChange={e => update({ style: { ...clip.style, color: e.target.value } })} /></label>
        <label className="block text-xs space-y-1">Alignment<select className="w-full rounded border bg-background p-2" value={clip.style?.textAlign ?? "center"} onChange={e => update({ style: { ...clip.style, textAlign: e.target.value as "left" | "center" | "right" } })}><option>left</option><option>center</option><option>right</option></select></label>
      </> : <>
        {clip.mediaKind !== "image" && number("Clip volume (%)", clip.style?.volume ?? 100, value => update({ style: { ...clip.style, volume: Math.max(0, Math.min(200, value)) } }), 0, 200)}
        {clip.type === "video" && number("Opacity (%)", clip.style?.opacity ?? 100, value => update({ style: { ...clip.style, opacity: Math.max(0, Math.min(100, value)) } }), 0, 100)}
      </>}
    </fieldset>}
  </div>;
}
