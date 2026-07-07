"use client";

import { useState } from "react";
import { Film, Loader2, Sparkles, Wand2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

export default function UncensoredVideoStudio() {
  const [mode, setMode] = useState<Mode>("t2v");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("portrait");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const { data: status } = trpc.uncensored.status.useQuery();
  const videoAvailable = status?.videoAvailable ?? false;
  const images = trpc.uncensored.myUncensoredImages.useQuery(undefined, { enabled: mode === "i2v" && videoAvailable });

  const cost = mode === "i2v" ? status?.videoCost?.i2v ?? 40 : status?.videoCost?.t2v ?? 50;

  const gen = trpc.uncensored.generateVideo.useMutation({
    onSuccess: (data) => {
      if (data.url) setVideoUrl(data.url);
      toast.success("Video ready.");
    },
    onError: (e) => toast.error(e.message),
  });

  const canGenerate =
    prompt.trim().length >= 3 && !gen.isPending && (mode === "t2v" || !!sourceId);

  const handleGenerate = () => {
    if (mode === "i2v" && !sourceId) {
      toast.error("Pick an image to animate.");
      return;
    }
    setVideoUrl(null);
    gen.mutate({
      prompt: prompt.trim(),
      mode,
      aspect,
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
        <span className="ml-auto text-xs text-muted-foreground">~5s clip · {cost} credits</span>
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
        disabled={gen.isPending}
        className="mt-4 resize-none"
      />

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
        {gen.isPending ? (
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
