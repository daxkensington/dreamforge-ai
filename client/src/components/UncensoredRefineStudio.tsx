"use client";

import { useEffect, useState } from "react";
import { Loader2, Wand2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Refine — uncensored img2img over the user's OWN generations.
 *
 * Answers the most-repeated request in the generation logs, which people write
 * as "change this one thing and leave everything else alone". There is
 * deliberately no upload control anywhere in this component: the only possible
 * input is an image the signed-in user already generated here, which keeps the
 * subject a fictional character we produced. Accepting uploads would make this
 * a nudify tool, and no consent checkbox makes that verifiable.
 */
export default function UncensoredRefineStudio({
  focusGenerationId,
}: {
  focusGenerationId?: number | null;
} = {}) {
  const [sourceId, setSourceId] = useState<number | null>(focusGenerationId ?? null);
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(60); // 0-100 slider → 0.2–0.9
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const status = trpc.uncensored.status.useQuery();
  const refineCost = status.data?.refineCost ?? 10;

  const utils = trpc.useUtils();
  const images = trpc.uncensored.myUncensoredImages.useQuery();

  useEffect(() => {
    if (focusGenerationId) setSourceId(focusGenerationId);
  }, [focusGenerationId]);

  const refine = trpc.uncensored.refineImage.useMutation({
    onSuccess: (data) => {
      setResultUrl(data.url ?? null);
      toast.success("Refined — that's a new image, your original is untouched.");
      // The result is itself refinable, so refresh the picker.
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const selected = images.data?.find((i) => i.id === sourceId) ?? null;
  const isBusy = refine.isPending;

  const handleRefine = () => {
    if (!sourceId) {
      toast.error("Pick one of your images to refine.");
      return;
    }
    if (prompt.trim().length < 3) {
      toast.error("Describe the change you want.");
      return;
    }
    setResultUrl(null);
    refine.mutate({
      sourceGenerationId: sourceId,
      prompt: prompt.trim(),
      strength: Math.min(0.9, Math.max(0.2, strength / 100)),
    });
  };

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Refine an image</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change one thing and keep the rest — same character, new detail.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{refineCost} credits</span>
      </div>

      {/* Source picker — your own generations only. No upload by design. */}
      <div className="mt-5">
        <p className="text-sm text-muted-foreground">Pick one of your uncensored images:</p>
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
                disabled={isBusy}
                onClick={() => setSourceId(img.id)}
                className={`overflow-hidden rounded-lg border-2 transition-colors disabled:opacity-60 ${
                  sourceId === img.id
                    ? "border-rose-500 ring-1 ring-rose-500/40"
                    : "border-transparent hover:border-rose-500/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl ?? ""}
                  alt={img.prompt.slice(0, 40)}
                  className="aspect-square w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No uncensored images yet — generate one first, then come back to refine it.
          </p>
        )}
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the change… (e.g. same pose and face, change the dress to red silk)"
        rows={3}
        maxLength={1000}
        disabled={isBusy}
        className="mt-4 resize-none"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleRefine();
          }
        }}
      />

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">How much to change</span>
          <span className="font-medium">
            {strength <= 40 ? "Subtle" : strength <= 70 ? "Balanced" : "Heavy"}
          </span>
        </div>
        <Slider
          value={[strength]}
          onValueChange={(v) => setStrength(v[0] ?? 60)}
          min={20}
          max={90}
          step={5}
          disabled={isBusy}
          className="mt-2"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Lower keeps the original composition and character; higher re-imagines more of the scene.
        </p>
      </div>

      <Button
        onClick={handleRefine}
        disabled={isBusy || !sourceId || prompt.trim().length < 3}
        className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
        size="lg"
      >
        {isBusy ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Refining…
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-5 w-5" /> Refine ({refineCost} credits)
          </>
        )}
      </Button>

      {(selected || resultUrl) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {selected && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Original</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.imageUrl ?? ""}
                alt="source"
                className="w-full rounded-xl border border-border/60"
              />
            </div>
          )}
          {resultUrl && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Refined</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="refined" className="w-full rounded-xl border border-rose-500/40" />
              <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Open full size
                </a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
