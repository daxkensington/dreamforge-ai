"use client";

import { useEffect, useState } from "react";
import { Film, Loader2, Sparkles, Wand2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  UNCENSORED_VIDEO_DURATIONS,
  UNCENSORED_VIDEO_MOTIONS,
  DEFAULT_UNCENSORED_VIDEO_DURATION,
  uncensoredVideoCredits,
} from "@shared/uncensoredStudio";

/**
 * Uncensored video studio — shown to holders of an active pass. Wan 2.2 on our
 * own GPUs (no external provider will render this). Two modes:
 *   - Text to video
 *   - Animate: turn one of your own uncensored images into a short clip (I2V)
 */
type Mode = "t2v" | "i2v";
type Aspect = "portrait" | "landscape" | "square";

const ASPECTS: { id: Aspect; label: string }[] = [
  { id: "portrait", label: "Portrait" },
  { id: "landscape", label: "Landscape" },
  { id: "square", label: "Square" },
];

export default function UncensoredVideoStudio({
  focusGenerationId,
}: {
  focusGenerationId?: number | null;
} = {}) {
  const [mode, setMode] = useState<Mode>(focusGenerationId ? "i2v" : "t2v");
  const [quality, setQuality] = useState<"fast" | "hd">("fast");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("portrait");
  const [duration, setDuration] = useState<typeof DEFAULT_UNCENSORED_VIDEO_DURATION>(
    DEFAULT_UNCENSORED_VIDEO_DURATION,
  );
  const [motion, setMotion] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(focusGenerationId ?? null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (focusGenerationId) {
      setSourceId(focusGenerationId);
      setMode("i2v");
    }
  }, [focusGenerationId]);

  const { data: status } = trpc.uncensored.status.useQuery();
  const videoAvailable = status?.videoAvailable ?? false;
  const images = trpc.uncensored.myUncensoredImages.useQuery(undefined, { enabled: mode === "i2v" });
  const savedChars = trpc.uncensored.listCharacters.useQuery(undefined, { enabled: mode === "i2v" });

  const fallbackCost = { fast: { t2v: 50, i2v: 40 }, hd: { t2v: 120, i2v: 100 } };
  const baseCost = status?.videoCost?.[quality]?.[mode] ?? fallbackCost[quality][mode];
  const cost = uncensoredVideoCredits(baseCost, duration);

  // Async job: submit returns a generationId, then we poll videoStatus until the
  // clip lands (video routinely outlasts a single request).
  const [pendingId, setPendingId] = useState<number | null>(null);

  const gen = trpc.uncensored.generateVideo.useMutation({
    onSuccess: (data) => {
      setPendingId(data.generationId);
      toast.success("Generating your video — this can take a few minutes.");
    },
    onError: (e) => toast.error(e.message),
  });

  const statusQuery = trpc.uncensored.videoStatus.useQuery(
    { generationId: pendingId ?? 0 },
    {
      enabled: pendingId != null,
      refetchInterval: (q) => (q.state.data && q.state.data.status !== "processing" ? false : 5000),
      // Video takes minutes — keep polling even if the user tabs away, else the
      // clip silently never appears until they refocus the tab.
      refetchIntervalInBackground: true,
    },
  );

  // react-query v5 removed useQuery onSuccess — react to the polled data here.
  useEffect(() => {
    const data = statusQuery.data;
    if (!data || pendingId == null) return;
    if (data.status === "completed" && data.url) {
      setVideoUrl(data.url);
      setPendingId(null);
      toast.success("Video ready.");
    } else if (data.status === "failed") {
      setPendingId(null);
      toast.error("Video generation failed — your credits were refunded.");
    }
  }, [statusQuery.data, pendingId]);

  const isBusy = gen.isPending || pendingId != null;
  const canGenerate =
    (prompt.trim().length >= 3 || !!motion) && !isBusy && (mode === "t2v" || !!sourceId);

  const handleGenerate = () => {
    if (mode === "i2v" && !sourceId) {
      toast.error("Pick an image to animate.");
      return;
    }
    if (prompt.trim().length < 3 && !motion) {
      toast.error("Describe the motion, or pick a motion chip.");
      return;
    }
    setVideoUrl(null);
    gen.mutate({
      prompt: prompt.trim() || "natural motion",
      mode,
      quality,
      aspect,
      duration,
      motion: motion ?? undefined,
      ...(mode === "i2v" && sourceId ? { sourceGenerationId: sourceId } : {}),
    });
  };

  // Ships behind a kill-switch; the card announces itself as "coming" until the
  // GPU worker is live so pass-holders aren't dropped into a failing path.
  if (!videoAvailable) {
    return (
      <div className="mt-8 rounded-2xl border border-rose-500/20 bg-card/30 p-6 text-center">
        <Film className="mx-auto h-6 w-6 text-rose-500/70" />
        <h2 className="mt-2 text-lg font-semibold">Uncensored video — coming shortly</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Text-to-video and animate-your-image, running on our own GPUs. Included with your pass
          (credit-based). Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex items-center gap-2">
        <Film className="h-5 w-5 text-rose-500" />
        <h2 className="text-lg font-semibold">Uncensored video</h2>
        <span className="ml-auto text-xs text-muted-foreground">{duration} clip · {cost} credits</span>
      </div>

      {/* Mode toggle */}
      <div className="mt-4 inline-flex rounded-lg border border-border/60 p-1">
        <button
          type="button"
          onClick={() => setMode("t2v")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${mode === "t2v" ? "bg-rose-500/15 text-rose-300" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Wand2 className="h-3.5 w-3.5" /> Text to video
        </button>
        <button
          type="button"
          onClick={() => setMode("i2v")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${mode === "i2v" ? "bg-rose-500/15 text-rose-300" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ImageIcon className="h-3.5 w-3.5" /> Animate an image
        </button>
      </div>

      {/* I2V source picker */}
      {mode === "i2v" && (
        <div className="mt-4">
          {savedChars.data && savedChars.data.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">Characters</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {savedChars.data.map((c) =>
                  c.generationId ? (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSourceId(c.generationId!)}
                      className={`overflow-hidden rounded-lg border-2 ${
                        sourceId === c.generationId
                          ? "border-rose-500 ring-1 ring-rose-500/40"
                          : "border-transparent hover:border-rose-500/40"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.imageUrl ?? ""} alt={c.name} className="h-16 w-16 object-cover" />
                      <span className="block max-w-16 truncate px-1 py-0.5 text-center text-[10px] text-muted-foreground">
                        {c.name}
                      </span>
                    </button>
                  ) : null,
                )}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Pick one of your uncensored images to animate:</p>
          {images.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your generations…
            </div>
          ) : images.data && images.data.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.data.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSourceId(img.id)}
                  className={`overflow-hidden rounded-lg border-2 transition-colors ${sourceId === img.id ? "border-rose-500 ring-1 ring-rose-500/40" : "border-transparent hover:border-rose-500/40"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl ?? ""} alt={img.prompt.slice(0, 40)} className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No uncensored images yet — generate one in the Studio first, then come back to animate it.
            </p>
          )}
        </div>
      )}

      {/* Prompt */}
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={mode === "i2v" ? "Describe the motion… (e.g. slow turn toward camera, hair blowing)" : "Describe the video you want…"}
        rows={3}
        maxLength={1000}
        disabled={isBusy}
        className="mt-4 resize-none"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleGenerate();
          }
        }}
      />

      <div className="mt-3">
        <p className="text-xs text-muted-foreground mb-2">Motion</p>
        <div className="flex flex-wrap gap-2">
          {UNCENSORED_VIDEO_MOTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMotion(motion === m.id ? null : m.id)}
              disabled={isBusy}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                motion === m.id
                  ? "border-rose-500 bg-rose-500/10 text-rose-300"
                  : "border-border/60 text-muted-foreground hover:border-rose-500/40"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality tier */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Quality:</span>
        {([
          { id: "fast", label: "Fast", note: "~90s" },
          { id: "hd", label: "HD · Top quality", note: "~2-4 min" },
        ] as const).map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setQuality(q.id)}
            disabled={isBusy}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${quality === q.id ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-border/60 text-muted-foreground hover:border-rose-500/40"}`}
          >
            {q.label} <span className="opacity-60">· {q.note}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Length:</span>
        {UNCENSORED_VIDEO_DURATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDuration(d.id)}
            disabled={isBusy}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${duration === d.id ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-border/60 text-muted-foreground hover:border-rose-500/40"}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Aspect */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Format:</span>
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAspect(a.id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${aspect === a.id ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-border/60 text-muted-foreground hover:border-rose-500/40"}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="mt-4 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
      >
        {isBusy ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating video… (this can take a few minutes)</>
        ) : (
          <><Sparkles className="mr-2 h-5 w-5" /> Generate video · {cost} credits</>
        )}
      </Button>

      {videoUrl && (
        <div className="mt-5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoUrl} controls autoPlay loop className="mx-auto max-h-[520px] w-full rounded-xl border border-border/60 bg-black" />
          <p className="mt-2 text-center text-xs text-muted-foreground">Private to your account. Uncensored generations never enter the public gallery.</p>
        </div>
      )}
    </div>
  );
}
