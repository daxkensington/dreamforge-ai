import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Film, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { AnimationDialog } from "@/components/AnimationDialog";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { uploadOwnedMedia } from "@/lib/mediaUpload";
import { exportMusicVideo, inspectMusicAudio, isOwnedAnimationUrl, musicVideoSupportError } from "@/lib/musicVideoExport";

export default function MusicVideoStudio() {
  const { user, loading } = useAuth();
  const owner = useRef(user?.id); owner.current = user?.id;
  const imageInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const uploadToken = useRef<string | null>(null);
  const audioToken = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<{ userId: number; id: number; imageUrl: string }>();
  const [animationOpen, setAnimationOpen] = useState(false);
  const [clip, setClip] = useState<string>();
  const [audio, setAudio] = useState<File>();
  const [duration, setDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [output, setOutput] = useState<{ url: string; extension: string; mime: string }>();
  const [message, setMessage] = useState("");
  const [historyOffset, setHistoryOffset] = useState(0);
  const history = trpc.generation.list.useQuery({ limit: 50, offset: historyOffset }, { enabled: Boolean(user), retry: 1 });
  const policy = trpc.animation.policy.useQuery();
  const importSource = trpc.animation.importSource.useMutation();
  const clearOutput = () => { if (outputRef.current) URL.revokeObjectURL(outputRef.current); outputRef.current = null; setOutput(undefined); };

  useEffect(() => {
    abortRef.current?.abort(); uploadToken.current = null; audioToken.current = null;
    setSelected(undefined); setClip(undefined); setAudio(undefined); setDuration(0); setUploadProgress(null); setExportProgress(null); setAnimationOpen(false); setMessage(""); setHistoryOffset(0); clearOutput();
    return () => { abortRef.current?.abort(); if (outputRef.current) URL.revokeObjectURL(outputRef.current); outputRef.current = null; };
  }, [user?.id]);

  async function uploadImage(file?: File) {
    if (!file || !user || uploadToken.current) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/avif"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("Choose a PNG, JPEG, WebP or AVIF image up to 10 MiB."); return;
    }
    const userId = user.id, token = crypto.randomUUID(); uploadToken.current = token; setMessage(""); setUploadProgress(0);
    try {
      const asset = await uploadOwnedMedia(file, "animation", progress => { if (owner.current === userId && uploadToken.current === token) setUploadProgress(progress); });
      if (owner.current !== userId || uploadToken.current !== token) return;
      const source = await importSource.mutateAsync({ key: asset.key });
      if (owner.current !== userId || uploadToken.current !== token) return;
      setSelected({ userId, id: source.generationId, imageUrl: source.imageUrl }); setAnimationOpen(true);
    } catch (error) {
      if (owner.current === userId && uploadToken.current === token) setMessage(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      if (uploadToken.current === token) { uploadToken.current = null; if (owner.current === userId) setUploadProgress(null); }
      if (imageInput.current) imageInput.current.value = "";
    }
  }

  async function chooseAudio(file?: File) {
    if (!file) return;
    const token = crypto.randomUUID(), userId = user?.id; audioToken.current = token; setAudio(undefined); setDuration(0); setMessage(""); clearOutput();
    try {
      const seconds = await inspectMusicAudio(file);
      if (owner.current !== userId || audioToken.current !== token) return;
      setAudio(file); setDuration(seconds);
    } catch (error) { if (owner.current === userId && audioToken.current === token) setMessage(error instanceof Error ? error.message : "Audio could not be loaded."); }
    finally { if (audioInput.current) audioInput.current.value = ""; }
  }

  async function render() {
    if (!user || !audio || !clip || abortRef.current || !isOwnedAnimationUrl(clip, user.id)) return;
    const userId = user.id, abort = new AbortController(); abortRef.current = abort; clearOutput(); setMessage(""); setExportProgress(0);
    try {
      const result = await exportMusicVideo({ videoUrl: clip, userId, audio, signal: abort.signal, onProgress: value => { if (owner.current === userId && abortRef.current === abort) setExportProgress(value); } });
      if (owner.current !== userId || abortRef.current !== abort || abort.signal.aborted) return;
      const url = URL.createObjectURL(result.blob); outputRef.current = url; setOutput({ url, extension: result.extension, mime: result.mime });
      setMessage("Music video ready. Preview or download it below.");
    } catch (error) {
      if (owner.current === userId && abortRef.current === abort) setMessage(abort.signal.aborted ? "Export cancelled. You can retry without spending more credits." : error instanceof Error ? error.message : "Export failed. You can retry without spending more credits.");
    } finally { if (abortRef.current === abort) { abortRef.current = null; if (owner.current === userId) setExportProgress(null); } }
  }

  const busy = uploadProgress !== null || exportProgress !== null;
  const clips = history.data?.filter(item => item.status === "completed" && item.mediaType === "video" && (item.metadata as any)?.tool === "image-animation" && !!item.imageUrl && !!user && isOwnedAnimationUrl(item.imageUrl, user.id)) ?? [];
  return <PageLayout><div className="container max-w-4xl py-10 md:py-14">
    <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs text-purple-400"><Film className="h-3 w-3" /> Music Video Studio</div>
    <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">Make a music video</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">Animate your image, then automatically loop the five-second clip over your song and export it in your browser.</p>
    <p className="mt-3 text-sm text-muted-foreground">The visual repeats; it does not sync to the beat. The complete song plays up to 10 minutes. Keep this tab visible during real-time export.</p>
    {loading ? <p className="mt-8">Loading your account…</p> : !user ? <Button asChild className="mt-8"><a href={getLoginUrl()}>Sign in to create a music video</a></Button> : <div className="mt-8 space-y-6">
      <section className="rounded-xl border p-5 space-y-3"><h2 className="font-semibold">1. Choose your song</h2>
        <p className="text-sm text-muted-foreground">Audio stays in your browser during export. Choose a file up to 20 MiB and 10 minutes.</p>
        <input ref={audioInput} type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4" aria-label="Choose audio file" disabled={busy} onChange={event => { void chooseAudio(event.target.files?.[0]); }} />
        {audio && <p className="text-sm">{audio.name} · {Math.ceil(duration)} seconds</p>}
      </section>
      <section className="rounded-xl border p-5 space-y-3"><h2 className="font-semibold">2. Create or choose an animation</h2>
        <p className="text-sm text-muted-foreground">{policy.data ? `${policy.data.creditCost.toLocaleString()} credits for one ${policy.data.duration}-second ${policy.data.resolution} animation · ${policy.data.requiredTier} plan or higher.` : "Loading the animation quote…"} Uploading and local export are free. You review the quote before generating. Export supports animation files up to 100 MiB and requires a current Chrome browser.</p>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" aria-label="Choose image to animate" disabled={busy} onChange={event => { void uploadImage(event.target.files?.[0]); }} />
        <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => { const error = musicVideoSupportError(); if (error) setMessage(error); else imageInput.current?.click(); }}>{uploadProgress !== null ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading {Math.round(uploadProgress * 100)}%</> : "Upload an image"}</Button><Button variant="outline" disabled={busy} onClick={() => setAnimationOpen(true)}>Check unfinished animation</Button><Button variant="outline" disabled={history.isFetching || busy} onClick={() => void history.refetch()}>Refresh saved clips</Button></div>
        {history.isError && <p role="alert">Saved clips could not be loaded. Try Refresh.</p>}
        {clips.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{clips.map(video => <button key={video.id} className="rounded border p-3 text-left" disabled={busy} aria-pressed={clip === video.imageUrl} onClick={() => { setClip(video.imageUrl!); clearOutput(); setMessage(""); }}><span className="text-sm">Animation #{video.id}{clip === video.imageUrl ? " · selected" : ""}</span><video src={video.imageUrl!} muted preload="metadata" className="mt-2 w-full rounded" /></button>)}</div>}
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || !historyOffset || history.isFetching} onClick={() => setHistoryOffset(value => Math.max(0, value - 50))}>Previous saved clips</Button><Button variant="outline" size="sm" disabled={busy || history.isFetching || (history.data?.length ?? 0) < 50} onClick={() => setHistoryOffset(value => value + 50)}>More saved clips</Button></div>
        {clip && <p role="status" className="text-sm">Animation selected. Exporting does not generate another clip.</p>}
      </section>
      <section className="rounded-xl border p-5 space-y-3"><h2 className="font-semibold">3. Export music video</h2>
        <p className="text-sm text-muted-foreground">The animation loops while the entire song plays. Export runs locally at 720p and 30 fps, and takes approximately the song's duration. Retrying export does not use credits.</p>
        <Button disabled={!audio || !clip || busy} onClick={() => void render()}>Export music video</Button>
        {exportProgress !== null && <div className="flex items-center gap-3"><progress value={exportProgress} max={1} aria-label="Music video export progress" /><span>{Math.round(exportProgress * 100)}%</span><Button variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>Cancel</Button></div>}
        {output && <div className="space-y-2"><video src={output.url} controls className="w-full rounded" aria-label="Music video result" /><p className="text-sm">Format: {output.mime}</p><Button asChild><a href={output.url} download={`dreamforge-music-video.${output.extension}`}>Download music video</a></Button></div>}
      </section>
      {message && <p role="status" aria-live="polite">{message}</p>}
      <p className="text-sm text-muted-foreground">For multiple clips or other edits, use the <Link href="/timeline/new" className="underline">timeline editor</Link>.</p>
    </div>}
    <AnimationDialog open={animationOpen && Boolean(user) && (!selected || selected.userId === user?.id)} onOpenChange={setAnimationOpen} generationId={selected && selected.userId === user?.id ? selected.id : null} sourceUrl={selected && selected.userId === user?.id ? selected.imageUrl : undefined} beforeNewRequest={musicVideoSupportError} onComplete={() => { void history.refetch(); }} onVideoReady={url => { if (owner.current && isOwnedAnimationUrl(url, owner.current)) { setClip(url); clearOutput(); setMessage("Animation ready. Select your song and export without another charge."); } }} />
  </div></PageLayout>;
}
