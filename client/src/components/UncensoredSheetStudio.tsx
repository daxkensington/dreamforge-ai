"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, LayoutGrid, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  UNCENSORED_IMAGE_COST,
  UNCENSORED_SHEET_VIEWS,
  UNCENSORED_WARDROBE,
} from "@shared/uncensoredStudio";
import UncensoredResultActions, {
  UncensoredSourcePickerExtras,
} from "@/components/UncensoredResultActions";

/**
 * Four-view identity sheet from one of the caller's own uncensored gens.
 * No uploads — same ownership gate as character lock.
 */
export default function UncensoredSheetStudio({
  focusGenerationId,
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
  onOutfit,
}: {
  focusGenerationId?: number | null;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
  onUseCharacter?: (id: number) => void;
  onOutfit?: (id: number) => void;
}) {
  const [sourceId, setSourceId] = useState<number | null>(focusGenerationId ?? null);
  const [savedCharacterId, setSavedCharacterId] = useState<number | null>(null);
  const [wardrobe, setWardrobe] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [stitching, setStitching] = useState(false);
  const [results, setResults] = useState<{ generationId: number; url: string; view: string }[]>([]);

  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const savedChars = trpc.uncensored.listCharacters.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (focusGenerationId) {
      setSourceId(focusGenerationId);
      setSavedCharacterId(null);
    }
  }, [focusGenerationId]);

  const sheet = trpc.uncensored.characterSheet.useMutation({
    onSuccess: (data) => {
      setResults(data.images);
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.status.invalidate();
      toast.success("Four-view sheet ready.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSheet = () => {
    if (!sourceId && !savedCharacterId) {
      toast.error("Pick a character or one of your images.");
      return;
    }
    setResults([]);
    sheet.mutate({
      characterGenerationId: savedCharacterId ? undefined : sourceId ?? undefined,
      savedCharacterId: savedCharacterId ?? undefined,
      wardrobe: wardrobe ?? undefined,
      customPrompt: customPrompt.trim() || undefined,
    });
  };

  const handleDownloadComposite = async () => {
    if (results.length === 0) return;
    setStitching(true);
    try {
      const loaded = await Promise.all(
        results.map(
          (r) =>
            new Promise<{ img: HTMLImageElement; label: string }>((resolve, reject) => {
              const im = new Image();
              im.crossOrigin = "anonymous";
              im.onload = () => {
                const label =
                  UNCENSORED_SHEET_VIEWS.find((v) => v.id === r.view)?.label ?? r.view;
                resolve({ img: im, label });
              };
              im.onerror = () => reject(new Error("Image load failed"));
              im.src = r.url;
            }),
        ),
      );
      const cellW = loaded[0]?.img.naturalWidth || 832;
      const cellH = loaded[0]?.img.naturalHeight || 1216;
      const pad = 24;
      const cols = Math.min(2, loaded.length);
      const rows = Math.ceil(loaded.length / cols);
      const canvas = document.createElement("canvas");
      canvas.width = cols * cellW + (cols + 1) * pad;
      canvas.height = rows * cellH + (rows + 1) * pad;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      loaded.forEach(({ img, label }, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = pad + col * (cellW + pad);
        const y = pad + row * (cellH + pad);
        ctx.drawImage(img, x, y, cellW, cellH);
        ctx.fillStyle = "rgba(9, 9, 11, 0.72)";
        ctx.fillRect(x + 16, y + cellH - 52, 220, 36);
        ctx.fillStyle = "#fda4af";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(label.toUpperCase(), x + 28, y + cellH - 27);
      });

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `character-sheet-${Date.now()}.png`;
      a.click();
      toast.success("Downloaded 2×2 turnaround sheet.");
    } catch {
      toast.error("Couldn't stitch composite — use the individual Open links below.");
    } finally {
      setStitching(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">4-View Character Turnaround Sheet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Four views of the same identity rendered in parallel — front, three-quarter, profile, and full body.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{UNCENSORED_IMAGE_COST.sheet} credits</span>
      </div>

      {savedChars.data && savedChars.data.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground mb-2">Named characters</p>
          <div className="flex flex-wrap gap-2">
            {savedChars.data.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSavedCharacterId(savedCharacterId === c.id ? null : c.id);
                  setSourceId(null);
                }}
                className={`overflow-hidden rounded-lg border-2 ${
                  savedCharacterId === c.id ? "border-rose-500 ring-1 ring-rose-500/40" : "border-transparent hover:border-rose-500/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imageUrl ?? ""} alt={c.name} className="h-16 w-16 object-cover" />
                <span className="block max-w-16 truncate px-1 py-0.5 text-center text-[10px] text-muted-foreground">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <UncensoredSourcePickerExtras
          selectedGenerationId={sourceId}
          onSelectGeneration={(id) => {
            setSourceId(id);
            setSavedCharacterId(null);
          }}
          disabled={sheet.isPending}
          showSavedCharacters={false}
        />
        <p className="text-sm text-muted-foreground">1. Pick one of your uncensored images:</p>
        {images.data && images.data.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.data.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setSourceId(sourceId === img.id ? null : img.id);
                  setSavedCharacterId(null);
                }}
                className={`overflow-hidden rounded-lg border-2 ${
                  sourceId === img.id ? "border-rose-500 ring-1 ring-rose-500/40" : "border-transparent hover:border-rose-500/40"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.imageUrl ?? ""} alt="" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Generate one first, then build her turnaround.</p>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          2. Optional wardrobe &amp; styling direction across all 4 views (leave blank to keep original look):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {UNCENSORED_WARDROBE.map((w) => (
            <button
              key={w.id}
              type="button"
              disabled={sheet.isPending}
              onClick={() => setWardrobe(wardrobe === w.id ? null : w.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                wardrobe === w.id
                  ? "border-rose-500 bg-rose-500/15 font-medium text-rose-200"
                  : "border-border/60 text-muted-foreground hover:border-rose-500/40 hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <Input
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value.slice(0, 400))}
          placeholder="Optional turnaround note (e.g. wearing crimson silk gown, silver tiara, cyberpunk armor)…"
          maxLength={400}
          disabled={sheet.isPending}
          className="mt-2.5"
        />
      </div>

      <Button
        onClick={handleSheet}
        disabled={sheet.isPending || (!sourceId && !savedCharacterId)}
        className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
        size="lg"
      >
        {sheet.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building 4 views in parallel…
          </>
        ) : (
          <>
            <LayoutGrid className="mr-2 h-5 w-5" /> Generate 4-View Sheet · {UNCENSORED_IMAGE_COST.sheet} credits
          </>
        )}
      </Button>
      {(sourceId || savedCharacterId) && (
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-rose-300">
          <Lock className="h-3 w-3" /> Same face &amp; identity across all four camera angles.
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-300">
              Completed 4-View Turnaround
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={stitching}
              onClick={handleDownloadComposite}
              className="border-rose-500/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
            >
              {stitching ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Stitching 2×2 Sheet…
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download 2×2 Master Sheet (PNG)
                </>
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {results.map((r) => (
              <div key={r.generationId} className="overflow-hidden rounded-xl border border-rose-500/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt={r.view} className="w-full" />
                <p className="px-2 pt-2 text-[11px] font-medium capitalize text-muted-foreground">
                  {UNCENSORED_SHEET_VIEWS.find((v) => v.id === r.view)?.label ?? r.view}
                </p>
                <div className="p-2">
                  <UncensoredResultActions
                    generationId={r.generationId}
                    url={r.url}
                    onRefine={onRefine}
                    onInpaint={onInpaint}
                    onOutfit={onOutfit}
                    onAnimate={onAnimate}
                    onUseCharacter={onUseCharacter}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
