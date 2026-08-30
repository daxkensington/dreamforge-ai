"use client";

import { useEffect, useState } from "react";
import { Loader2, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNCENSORED_IMAGE_COST } from "@shared/uncensoredStudio";
import UncensoredResultActions from "@/components/UncensoredResultActions";

type Cloth = "upper" | "lower" | "overall";

/**
 * Outfit transfer between two of the caller's own uncensored gens.
 * Person + garment — never an upload, so this cannot become a nudify tool.
 */
export default function UncensoredOutfitStudio({
  focusGenerationId,
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
}: {
  focusGenerationId?: number | null;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
  onUseCharacter?: (id: number) => void;
}) {
  const [personId, setPersonId] = useState<number | null>(focusGenerationId ?? null);
  const [garmentId, setGarmentId] = useState<number | null>(null);
  const [clothType, setClothType] = useState<Cloth>("overall");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);

  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (focusGenerationId) setPersonId(focusGenerationId);
  }, [focusGenerationId]);

  const outfit = trpc.uncensored.outfit.useMutation({
    onSuccess: (data) => {
      setResultUrl(data.url);
      setResultId(data.generationId);
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      toast.success("Outfit transferred.");
    },
    onError: (e) => toast.error(e.message),
  });

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
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.data.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => onPick(img.id)}
            className={`overflow-hidden rounded-lg border-2 ${
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Outfit transfer</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Copy clothes from one of your gens onto another. Both images have to already exist here.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{UNCENSORED_IMAGE_COST.outfit} credits</span>
      </div>

      <div className="mt-4">
        <p className="text-sm text-muted-foreground">1. Person</p>
        {picker(personId, setPersonId, "Generate a character first.")}
      </div>
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">2. Outfit to copy</p>
        {picker(garmentId, setGarmentId, "Generate an outfit shot first.")}
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
        disabled={outfit.isPending || !personId || !garmentId || personId === garmentId}
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

      {resultUrl && resultId && (
        <div className="mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Outfit transfer" className="w-full rounded-xl border border-rose-500/40" />
          <UncensoredResultActions
            generationId={resultId}
            url={resultUrl}
            onRefine={onRefine}
            onInpaint={onInpaint}
            onAnimate={onAnimate}
            onUseCharacter={onUseCharacter}
          />
        </div>
      )}
    </div>
  );
}
