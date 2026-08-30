"use client";

import { useEffect, useState } from "react";
import { Loader2, LayoutGrid, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNCENSORED_IMAGE_COST, UNCENSORED_SHEET_VIEWS } from "@shared/uncensoredStudio";
import UncensoredResultActions from "@/components/UncensoredResultActions";

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
}: {
  focusGenerationId?: number | null;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
  onUseCharacter?: (id: number) => void;
}) {
  const [sourceId, setSourceId] = useState<number | null>(focusGenerationId ?? null);
  const [savedCharacterId, setSavedCharacterId] = useState<number | null>(null);
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
    });
  };

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Character sheet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Four views of the same identity — front, three-quarter, profile, full body. Studio backdrop.
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
        <p className="text-sm text-muted-foreground">Or pick one of your uncensored images:</p>
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

      <Button
        onClick={handleSheet}
        disabled={sheet.isPending || (!sourceId && !savedCharacterId)}
        className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
        size="lg"
      >
        {sheet.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building sheet…
          </>
        ) : (
          <>
            <LayoutGrid className="mr-2 h-5 w-5" /> 4-view sheet · {UNCENSORED_IMAGE_COST.sheet} credits
          </>
        )}
      </Button>
      {(sourceId || savedCharacterId) && (
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-rose-300">
          <Lock className="h-3 w-3" /> Same face, four cameras.
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {results.map((r) => (
            <div key={r.generationId} className="overflow-hidden rounded-xl border border-rose-500/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt={r.view} className="w-full" />
              <p className="px-2 pt-2 text-[11px] capitalize text-muted-foreground">
                {UNCENSORED_SHEET_VIEWS.find((v) => v.id === r.view)?.label ?? r.view}
              </p>
              <div className="p-2">
                <UncensoredResultActions
                  generationId={r.generationId}
                  url={r.url}
                  onRefine={onRefine}
                  onInpaint={onInpaint}
                  onAnimate={onAnimate}
                  onUseCharacter={onUseCharacter}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
