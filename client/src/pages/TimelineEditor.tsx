import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import PageLayout from "@/components/PageLayout";
import TimelineEditorComponent from "@/components/timeline/TimelineEditor";
import TimelineToolbar from "@/components/timeline/TimelineToolbar";
import TimelinePreview from "@/components/timeline/TimelinePreview";
import PropertiesPanel from "@/components/timeline/PropertiesPanel";
import { exportTimeline, inspectTimelineFile } from "@/components/timeline/timelineMedia";
import { useTimeline } from "@/hooks/useTimeline";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { uploadOwnedMedia } from "@/lib/mediaUpload";
import { getLoginUrl } from "@/const";
import { timelineDocumentSchema, type Clip } from "@shared/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, Upload, Film, Download } from "lucide-react";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = name;
  anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function TimelineEditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation(); const { user, loading: authLoading } = useAuth();
  const id = /^\d+$/.test(projectId ?? "") && Number(projectId) > 0 ? Number(projectId) : undefined;
  const validRoute = !!id || projectId === "new";
  const project = trpc.timeline.get.useQuery({ id: id ?? 0 }, { enabled: !!id && !!user, retry: false, refetchOnWindowFocus: false });
  const save = trpc.timeline.save.useMutation();
  const [title, setTitle] = useState("Untitled timeline"), [revision, setRevision] = useState(0);
  const [loadedId, setLoadedId] = useState<number | null>(null), [baseline, setBaseline] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false), [uploadProgress, setUploadProgress] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false), [galleryOffset, setGalleryOffset] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null), [exportLabel, setExportLabel] = useState("");
  const exportAbort = useRef<AbortController | null>(null), fileInput = useRef<HTMLInputElement>(null), backupInput = useRef<HTMLInputElement>(null);
  const ready = validRoute && (!id || loadedId === id);
  const canEdit = !!user && ready && (!id || !!project.data?.canEdit) && !project.data?.invalidDocument;
  const busy = save.isPending || uploading || exportProgress !== null;
  const timeline = useTimeline(canEdit && !busy);
  const timelineRef = useRef(timeline); timelineRef.current = timeline;
  const generations = trpc.generation.list.useQuery({ limit: 24, offset: galleryOffset }, { enabled: galleryOpen && !!user, retry: false });
  const snapshot = useMemo(() => JSON.stringify({ title, document: timeline.document }), [title, timeline.state.tracks, timeline.state.clips]);
  const dirty = ready && (baseline ? snapshot !== baseline : timeline.state.clips.length > 0 || title !== "Untitled timeline");
  useEffect(() => {
    if (project.data && loadedId !== project.data.id) {
      const data = project.data; timelineRef.current.load(data.document); setTitle(data.title); setRevision(data.revision); setLoadedId(data.id);
      setBaseline(JSON.stringify({ title: data.title, document: data.document })); setError("");
    }
  }, [project.data, loadedId]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => () => exportAbort.current?.abort(), []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement; if (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable || busy) return;
      const value = timelineRef.current;
      if (event.code === "Space") { event.preventDefault(); value.togglePlay(); }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); value.setPlayhead(value.state.playheadPosition + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : 1 / 30)); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? value.redo() : value.undo(); }
      else if (event.key === "Delete" || event.key === "Backspace") { if (value.state.selectedClipId) { event.preventDefault(); value.removeClip(value.state.selectedClipId); } }
      else if (event.key.toLowerCase() === "b") { const clip = value.selectedClip; if (clip) value.splitClip(clip.id, value.state.playheadPosition); }
      else if (event.key === "Escape") value.selectClip(null);
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [busy]);
  async function persist() {
    setError(""); setNotice("");
    const parsed = timelineDocumentSchema.safeParse(timeline.document);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Timeline is invalid"); return; }
    const savedSnapshot = JSON.stringify({ title: title.trim(), document: parsed.data });
    try {
      const result = await save.mutateAsync({ id, expectedRevision: revision, title, document: parsed.data });
      setRevision(result.revision); setTitle(title.trim()); setBaseline(savedSnapshot); setNotice("Timeline saved");
      if (!id) { setLoadedId(result.id); navigate(`/timeline/${result.id}`, { replace: true }); }
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed. Your local edits are still here."); }
  }
  function appendMedia(url: string, kind: "image" | "video" | "audio", duration: number, name: string) {
    const type = kind === "audio" ? "audio" : "video", track = timeline.state.tracks.find(track => track.type === type && !track.isLocked);
    if (!track) throw new Error(`Unlock or add a ${type} track first`);
    if (timeline.state.clips.length >= 300) throw new Error("A timeline can contain at most 300 clips");
    const length = Math.min(duration, 1800 - timeline.state.playheadPosition);
    if (length < .1) throw new Error("Move the playhead before the 30-minute limit");
    timeline.addClip({ trackId: track.id, type, mediaKind: kind, sourceUrl: url, startTime: timeline.state.playheadPosition,
      duration: length, sourceDuration: kind === "image" ? undefined : duration, name });
  }
  async function upload(file: File) {
    if (!canEdit) return; setError(""); setUploading(true); setUploadProgress(0);
    try {
      const media = await inspectTimelineFile(file);
      const result = await uploadOwnedMedia(file, "timeline", value => setUploadProgress(value));
      // The edit callback captured before uploading remains authorized in the server save as well.
      appendMedia(result.url, media.kind, media.duration, file.name); setNotice("Media uploaded. Save the timeline to keep the edit.");
    } catch (error) { setError(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  }
  async function importGeneration(generation: NonNullable<typeof generations.data>[number]) {
    if (!canEdit || !generation.imageUrl) return;
    try {
      const kind = generation.mediaType === "video" ? "video" : "image";
      let duration = kind === "image" ? 5 : generation.duration ?? 0;
      if (!duration) {
        const response = await fetch(generation.imageUrl, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Saved media is no longer available");
        const blob = await response.blob(); if (blob.size > 25 * 1024 * 1024) throw new Error("Saved clip exceeds 25 MiB");
        duration = (await inspectTimelineFile(new File([blob], "saved-video", { type: blob.type }))).duration;
      }
      appendMedia(generation.imageUrl, kind, duration, `Generation #${generation.id}`); setGalleryOpen(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Import failed"); }
  }
  async function record() {
    timeline.setPlaying(false); const abort = new AbortController(); exportAbort.current = abort; setExportProgress(0); setError("");
    try {
      const result = await exportTimeline(timeline.document, { signal: abort.signal, onProgress: (fraction, label) => { setExportProgress(fraction); setExportLabel(label); } });
      download(result.blob, `${title.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "timeline"}.${result.extension}`);
      setNotice(`Export complete: ${result.mime}, 1280 × 720, 30 fps. File downloaded.`);
    } catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "Export failed"); else setNotice("Export cancelled"); }
    finally { setExportProgress(null); exportAbort.current = null; }
  }
  if (authLoading) return <PageLayout><p className="p-8">Loading your account…</p></PageLayout>;
  if (!user) return <PageLayout><div className="p-8 space-y-4"><h1 className="text-2xl font-bold">Timeline editor</h1><p>Sign in to create and save a timeline with your own media.</p><Button asChild><a href={getLoginUrl()}>Sign in</a></Button></div></PageLayout>;
  if (!validRoute || project.error) return <PageLayout><div className="p-8 space-y-4"><p role="alert">{project.error?.message ?? "Invalid timeline project"}</p><Button asChild><Link href="/timeline/new">Create a timeline</Link></Button></div></PageLayout>;
  if (!ready) return <PageLayout><p className="p-8">Loading project…</p></PageLayout>;
  return <PageLayout><div className="flex flex-col h-[calc(100dvh-5rem)] min-h-[700px]">
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border/30">
      <Link href="/video-studio" className="p-2" aria-label="Back to video studio" onClick={event => { if (dirty && !window.confirm("Leave without saving these timeline changes?")) event.preventDefault(); }}><ArrowLeft className="h-4 w-4" /></Link>
      <Film className="h-5 w-5" /><h1 className="font-semibold">Timeline</h1>
      <Input aria-label="Project title" className="w-48 sm:w-64" maxLength={256} value={title} disabled={!canEdit || busy} onChange={e => setTitle(e.target.value)} />
      <span className="text-xs text-muted-foreground">{id ? `Project #${id} · ${project.data?.role ?? "owner"} · revision ${revision}` : "New project"}{dirty ? " · Unsaved changes" : ""}</span>
      <div className="flex-1" /><Button onClick={() => void persist()} disabled={!canEdit || busy || !title.trim()}><Save className="mr-2 h-4 w-4" />{save.isPending ? "Saving…" : "Save"}</Button>
      <Button variant="outline" size="sm" onClick={() => download(new Blob([JSON.stringify({ title, document: timeline.document }, null, 2)], { type: "application/json" }), "timeline-backup.json")}>Backup JSON</Button>
      <Button variant="outline" size="sm" disabled={!canEdit || busy} onClick={() => backupInput.current?.click()}>Restore JSON</Button>
    </div>
    {!canEdit && <p className="px-4 py-2 text-sm bg-amber-500/10">{project.data?.invalidDocument ? "This saved timeline is not compatible. Download a backup before making changes in another editor." : "Viewer access: preview and export are available. Ask the owner for editor access to make changes."}</p>}
    {(error || notice) && <div role={error ? "alert" : "status"} className={`px-4 py-2 text-sm ${error ? "bg-red-500/15" : "bg-emerald-500/10"}`}>{error || notice}{error.includes("Another edit") && <Button size="sm" variant="outline" className="ml-3" onClick={() => { if (window.confirm("Reload the latest saved version? Download Backup JSON first to keep your local changes.")) void project.refetch().then(result => { if (!result.data) return; const data = result.data; timeline.load(data.document); setTitle(data.title); setRevision(data.revision); setBaseline(JSON.stringify({ title: data.title, document: data.document })); setError(""); }); }}>Reload latest</Button>}</div>}
    {uploading && <p role="status" className="px-4 py-2 text-sm">Uploading… {Math.round(uploadProgress * 100)}%</p>}
    {exportProgress !== null && <div role="status" className="px-4 py-2 text-sm flex gap-3 items-center"><progress value={exportProgress} max={1} className="flex-1" /><span>{Math.round(exportProgress * 100)}% · {exportLabel}</span><Button size="sm" variant="outline" onClick={() => exportAbort.current?.abort()}>Cancel export</Button></div>}
    <TimelineToolbar timeline={timeline} readOnly={!canEdit} busy={busy} onUpload={() => fileInput.current?.click()} onGallery={() => setGalleryOpen(true)} onExport={() => void record()} />
    <div className="px-3 py-1 text-xs text-muted-foreground">Export records the actual timeline in real time at 720p/30fps, with mixed audio. The browser selects and reports WebM or MP4. Mute silences a track; solo includes only solo tracks. Media limits: video 25 MiB, audio 20 MiB, images 10 MiB.</div>
    <div className="flex flex-col md:flex-row flex-1 min-h-[240px]"><div className="flex-1 min-w-0"><TimelinePreview timeline={timeline} /></div><aside className="w-full md:w-60 shrink-0 max-h-48 md:max-h-none"><PropertiesPanel clip={timeline.selectedClip} track={timeline.selectedTrack} onUpdateClip={timeline.updateClip} onClose={() => timeline.selectClip(null)} readOnly={!canEdit || busy} /></aside></div>
    <div className="h-[250px] shrink-0 border-t border-border/30"><TimelineEditorComponent timeline={timeline} /></div>
    <input ref={fileInput} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/avif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    <input ref={backupInput} type="file" className="hidden" accept="application/json" onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
      if (file.size > 2 * 1024 * 1024) { setError("Timeline backup exceeds 2 MiB"); return; }
      void file.text().then(text => { const value = JSON.parse(text), doc = timelineDocumentSchema.parse(value.document); timeline.load(doc); if (typeof value.title === "string") setTitle(value.title.slice(0, 256)); setNotice("Backup restored locally. Save to persist it."); }).catch(() => setError("Invalid or incompatible timeline backup"));
    }} />
    <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Import my saved generations</DialogTitle></DialogHeader>
      {generations.isLoading ? <p>Loading…</p> : generations.error ? <p role="alert">{generations.error.message}</p> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-auto">{generations.data?.filter(g => g.status === "completed" && g.imageUrl).map(g => <button key={g.id} className="border rounded p-2 text-left hover:bg-accent" onClick={() => void importGeneration(g)}><span className="block text-xs">{g.mediaType === "video" ? "Video" : "Image"} #{g.id}</span><span className="text-xs text-muted-foreground">Import {g.mediaType === "video" ? "video clip" : "as still image"}</span></button>)}</div>}
      {!generations.isLoading && !generations.data?.some(g => g.status === "completed" && g.imageUrl) && <p>No completed media on this page. Upload your own file or create a generation first.</p>}
      <div className="flex justify-between"><Button variant="outline" disabled={!galleryOffset} onClick={() => setGalleryOffset(value => Math.max(0, value - 24))}>Previous</Button><Button variant="outline" disabled={(generations.data?.length ?? 0) < 24} onClick={() => setGalleryOffset(value => value + 24)}>Next</Button></div>
    </DialogContent></Dialog>
  </div></PageLayout>;
}
