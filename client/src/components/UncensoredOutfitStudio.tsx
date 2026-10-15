"use client";

import { useEffect, useState } from "react";
import { Loader2, Shirt, Sparkles, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNCENSORED_IMAGE_COST, UNCENSORED_OUTFIT_PRESETS } from "@shared/uncensoredStudio";
import UncensoredResultActions, {
  UncensoredBeforeAfterCompare,
  UncensoredSourcePickerExtras,
} from "@/components/UncensoredResultActions";

type Cloth = "upper" | "lower" | "overall";
type OutfitMode = "quick" | "transfer";

/**
 * Outfit Studio — two ways to restyle a character's wardrobe:
 *   1. Quick Wardrobe Swap (default): 1-click curated wardrobe presets or custom
 *      outfit description on a single image while preserving identity & pose.
 *   2. Copy From Another Image: CatVTON transfer between two of the caller's own gens.
 * Never accepts external uploads, so this cannot become a nudify tool.
 */
export default function UncensoredOutfitStudio({
  focusGenerationId,
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
  onSheet,
}: {
  focusGenerationId?: number | null;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
  onUseCharacter?: (id: number) => void;
  onSheet?: (id: number) => void;
}) {
  const [mode, setMode] = useState<OutfitMode>("quick");
  const [personId, setPersonId] = useState<number | null>(focusGenerationId ?? null);
  const [garmentId, setGarmentId] = useState<number | null>(null);
  const [clothType, setClothType] = useState<Cloth>("overall");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(UNCENSORED_OUTFIT_PRESETS[0].id);
  const [customOutfitPrompt, setCustomOutfitPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);

  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (focusGenerationId) setPersonId(focusGenerationId);
  }, [focusGenerationId]);

  useEffect(() => {
    if (!personId && images.data && images.data.length > 0) {
      setPersonId(images.data[0].id);
    }
  }, [personId, images.data]);

  const outfit = trpc.uncensored.outfit.useMutation({
    onSuccess: (data) => {
      setResultUrl(data.url);
      setResultId(data.generationId);
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.status.invalidate();
      toast.success("Outfit transferred.");
    },
    onError: (e) => toast.error(e.message),
  });

  const quickRestyle = trpc.uncensored.refineImage.useMutation({
    onSuccess: (data) => {
      setResultUrl(data.url ?? null);
      setResultId(data.generationId);
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.status.invalidate();
      toast.success("Wardrobe swapped — original image is untouched.");
    },
    onError: (e) => toast.error(e.message),
  });

  const isBusy = outfit.isPending || quickRestyle.isPending;
  const selectedPerson = images.data?.find((i) => i.id === personId) ?? null;

  const handleQuickSwap = () => {
    if (!personId) {
      toast.error("Pick one of your images first.");
      return;
    }
    const preset = UNCENSORED_OUTFIT_PRESETS.find((p) => p.id === selectedPresetId);
    const custom = customOutfitPrompt.trim();
    const promptToRun = custom
      ? `same person, face, pose, and lighting, wearing ${custom}`
      : preset?.prompt ?? UNCENSORED_OUTFIT_PRESETS[0].prompt;
    setResultUrl(null);
    setResultId(null);
    quickRestyle.mutate({
      sourceGenerationId: personId,
      prompt: promptToRun,
      strength: 0.52,
    });
  };

  const handleOutfit = () => {
    if (!personId || !garmentId) {
      toast.error("Pick the person, then the outfit to copy.");
      return;
    }
    setResultUrl(null);
    setResultId(null);
    outfit.mutate({ personGenerationId: personId, garmentGenerationId: garmentId, clothType });
  };

  const picker = (
    selectedId: number | null,
    onPick: (id: number) => void,
    empty: string,
  ) =>
    images.data && images.data.length > 0 ? (
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {images.data.map((img) => (
          <button
            key={img.id}
            type="button"
            disabled={isBusy}
            onClick={() => onPick(img.id)}
            className={`overflow-hidden rounded-lg border-2 transition-all ${
              selectedId === img.id ? "border-rose-500 ring-1 ring-rose-500/40" : "border-transparent hover:border-rose-500/40"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl ?? ""} alt="" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
    );

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Outfit Swap Studio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Swap clothes on any of your characters in 1 click while keeping their face, pose, and lighting.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{UNCENSORED_IMAGE_COST.outfit} credits</span>
      </div>

      {/* Mode selector */}
      <div className="mt-4 inline-flex rounded-lg border border-border/60 p-1">
        <button
          type="button"
          onClick={() => setMode("quick")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
            mode === "quick" ? "bg-rose-500/20 text-rose-200" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> 1-Click Wardrobe Restyle
        </button>
        <button
          type="button"
          onClick={() => setMode("transfer")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
            mode === "transfer" ? "bg-rose-500/20 text-rose-200" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Copy className="h-3.5 w-3.5" /> Copy From 2nd Image
        </button>
      </div>

      <div className="mt-4">
        <UncensoredSourcePickerExtras
          selectedGenerationId={personId}
          onSelectGeneration={(id) => {
            setPersonId(id);
            setResultUrl(null);
            setResultId(null);
          }}
          disabled={isBusy}
        />
        <p className="text-sm text-muted-foreground">1. Pick character image to restyle</p>
        {picker(personId, setPersonId, "Generate a character on the Create tab first.")}
      </div>

      {mode === "quick" ? (
        <>
          <div className="mt-5">
            <p className="text-sm text-muted-foreground mb-2">2. Choose a wardrobe preset (or describe your own below)</p>
            <div className="flex flex-wrap gap-2">
              {UNCENSORED_OUTFIT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setCustomOutfitPrompt("");
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedPresetId === preset.id && !customOutfitPrompt.trim()
                      ? "border-rose-500 bg-rose-500/15 text-rose-200"
                      : "border-border/60 text-muted-foreground hover:border-rose-500/40 hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-1.5">Or custom wardrobe description (optional):</p>
            <Textarea
              value={customOutfitPrompt}
              onChange={(e) => setCustomOutfitPrompt(e.target.value)}
              placeholder="e.g. a sheer gold chainmail dress, or black satin corset with stockings…"
              rows={2}
              maxLength={400}
              disabled={isBusy}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleQuickSwap}
            disabled={isBusy || !personId}
            className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
            size="lg"
          >
            {quickRestyle.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Swapping outfit…
              </>
            ) : (
              <>
                <Shirt className="mr-2 h-5 w-5" /> Swap Outfit · {UNCENSORED_IMAGE_COST.outfit} credits
              </>
            )}
          </Button>
        </>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">2. Pick second image whose outfit to copy</p>
            {picker(garmentId, setGarmentId, "Generate a second outfit shot first.")}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              { id: "overall" as const, label: "Full look" },
              { id: "upper" as const, label: "Top" },
              { id: "lower" as const, label: "Bottom" },
            ]).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClothType(c.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  clothType === c.id
                    ? "border-rose-500 bg-rose-500/10 text-rose-300"
                    : "border-border/60 text-muted-foreground hover:border-rose-500/40"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleOutfit}
            disabled={isBusy || !personId || !garmentId || personId === garmentId}
            className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
            size="lg"
          >
            {outfit.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Transferring outfit…
              </>
            ) : (
              <>
                <Shirt className="mr-2 h-5 w-5" /> Transfer outfit · {UNCENSORED_IMAGE_COST.outfit} credits
              </>
            )}
          </Button>
        </>
      )}

      <UncensoredBeforeAfterCompare
        beforeUrl={selectedPerson?.imageUrl ?? null}
        afterUrl={resultUrl}
        beforeLabel="Original"
        afterLabel="New Outfit"
      >
        {resultUrl && resultId && (
          <UncensoredResultActions
            generationId={resultId}
            url={resultUrl}
            onContinue={() => {
              setPersonId(resultId);
              setResultUrl(null);
              setResultId(null);
              toast.info("Now restyling the new outfit image.");
            }}
            onRefine={onRefine}
            onInpaint={onInpaint}
            onSheet={onSheet}
            onAnimate={onAnimate}
            onUseCharacter={onUseCharacter}
          />
        )}
      </UncensoredBeforeAfterCompare>
    </div>
  );
}

