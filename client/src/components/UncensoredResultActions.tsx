"use client";

import { useState } from "react";
import {
  Columns2,
  Download,
  Film,
  FolderInput,
  LayoutGrid,
  Loader2,
  Lock,
  Maximize,
  Paintbrush,
  Scissors,
  Shirt,
  SplitSquareHorizontal,
  UserPlus,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Shared follow-up actions for a finished uncensored image so Refine / Inpaint /
 * Outfit / Sheet don't dump the user back to Library to keep working. Includes
 * built-in "Save as Named Character" when `onSave` is not provided by parent.
 */
export default function UncensoredResultActions({
  generationId,
  url,
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
  onOutfit,
  onSheet,
  onContinue,
  onSave,
}: {
  generationId: number;
  url: string;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
  onUseCharacter?: (id: number) => void;
  onOutfit?: (id: number) => void;
  onSheet?: (id: number) => void;
  onContinue?: () => void;
  onSave?: () => void;
}) {
  const [namingOpen, setNamingOpen] = useState(false);
  const [charName, setCharName] = useState("");
  const utils = trpc.useUtils();
  const cutout = trpc.uncensored.removeBackground.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.status.invalidate();
      toast.success("Cutout ready — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });
  const upscale = trpc.uncensored.upscale.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.status.invalidate();
      toast.success("Upscaled — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });
  const saveChar = trpc.uncensored.saveCharacter.useMutation({
    onSuccess: (c) => {
      setNamingOpen(false);
      setCharName("");
      utils.uncensored.listCharacters.invalidate();
      toast.success(`Saved "${c.name}" to your Named Characters.`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {onContinue && (
          <Button type="button" variant="outline" size="sm" onClick={onContinue}>
            Continue from this
          </Button>
        )}
        {onRefine && (
          <Button type="button" variant="outline" size="sm" onClick={() => onRefine(generationId)}>
            <Wand2 className="mr-1 h-3.5 w-3.5" /> Refine
          </Button>
        )}
        {onInpaint && (
          <Button type="button" variant="outline" size="sm" onClick={() => onInpaint(generationId)}>
            <Paintbrush className="mr-1 h-3.5 w-3.5" /> Inpaint
          </Button>
        )}
        {onOutfit && (
          <Button type="button" variant="outline" size="sm" onClick={() => onOutfit(generationId)}>
            <Shirt className="mr-1 h-3.5 w-3.5" /> Outfit
          </Button>
        )}
        {onSheet && (
          <Button type="button" variant="outline" size="sm" onClick={() => onSheet(generationId)}>
            <LayoutGrid className="mr-1 h-3.5 w-3.5" /> Sheet
          </Button>
        )}
        {onAnimate && (
          <Button type="button" variant="outline" size="sm" onClick={() => onAnimate(generationId)}>
            <Film className="mr-1 h-3.5 w-3.5" /> Animate
          </Button>
        )}
        {onUseCharacter && (
          <Button type="button" variant="outline" size="sm" onClick={() => onUseCharacter(generationId)}>
            <Lock className="mr-1 h-3.5 w-3.5" /> Lock
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (onSave) {
              onSave();
            } else {
              setNamingOpen((v) => !v);
            }
          }}
        >
          <UserPlus className="mr-1 h-3.5 w-3.5" /> Save Character
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cutout.isPending}
          onClick={() => cutout.mutate({ sourceGenerationId: generationId })}
        >
          <Scissors className="mr-1 h-3.5 w-3.5" /> Cutout
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upscale.isPending}
          onClick={() => upscale.mutate({ sourceGenerationId: generationId, scale: "2x" })}
        >
          <Maximize className="mr-1 h-3.5 w-3.5" /> 2×
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upscale.isPending}
          onClick={() => upscale.mutate({ sourceGenerationId: generationId, scale: "4x" })}
        >
          <Maximize className="mr-1 h-3.5 w-3.5" /> 4×
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={url} download={`dreamforgex-${generationId}.png`} target="_blank" rel="noopener noreferrer">
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </a>
        </Button>
      </div>
      {namingOpen && !onSave && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-background/60 p-2">
          <Input
            value={charName}
            onChange={(e) => setCharName(e.target.value.slice(0, 40))}
            placeholder="Name this character (e.g. Aria, Valentina)…"
            maxLength={40}
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && charName.trim()) {
                e.preventDefault();
                saveChar.mutate({ name: charName.trim(), sourceGenerationId: generationId });
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={!charName.trim() || saveChar.isPending}
            onClick={() => saveChar.mutate({ name: charName.trim(), sourceGenerationId: generationId })}
          >
            {saveChar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setNamingOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Shared quick-pick bar for Named Saved Characters + 1-Click Workspace Image Import
 * across Refine, Inpaint, Outfit, Sheet, and Video Studio tabs.
 */
export function UncensoredSourcePickerExtras({
  selectedGenerationId,
  onSelectGeneration,
  disabled,
  showSavedCharacters = true,
}: {
  selectedGenerationId: number | null;
  onSelectGeneration: (id: number) => void;
  disabled?: boolean;
  showSavedCharacters?: boolean;
}) {
  const [showWorkspaceImport, setShowWorkspaceImport] = useState(false);
  const utils = trpc.useUtils();
  const savedChars = trpc.uncensored.listCharacters.useQuery(undefined, {
    enabled: showSavedCharacters,
  });
  const workspaceImages = trpc.uncensored.myWorkspaceImages.useQuery(undefined, {
    enabled: showWorkspaceImport,
  });
  const importWorkspace = trpc.uncensored.importWorkspaceImage.useMutation({
    onSuccess: (imported) => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      onSelectGeneration(imported.generationId);
      setShowWorkspaceImport(false);
      toast.success("Workspace character imported into Uncensored Studio.");
    },
    onError: (e) => toast.error(e.message),
  });

  const charsWithGen = (savedChars.data ?? []).filter((c) => c.generationId != null);

  return (
    <div className="mb-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showSavedCharacters && charsWithGen.length > 0 ? (
          <p className="text-xs font-medium text-muted-foreground">Named Characters</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={disabled || importWorkspace.isPending}
          onClick={() => setShowWorkspaceImport((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-50"
        >
          <FolderInput className="h-3 w-3" />
          {showWorkspaceImport ? "Hide Workspace Import" : "Import from Workspace"}
        </button>
      </div>

      {showSavedCharacters && charsWithGen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {charsWithGen.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectGeneration(c.generationId!)}
              className={`overflow-hidden rounded-lg border-2 transition-all ${
                selectedGenerationId === c.generationId
                  ? "border-rose-500 ring-1 ring-rose-500/40"
                  : "border-transparent hover:border-rose-500/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl ?? ""} alt={c.name} className="h-14 w-14 object-cover" />
              <span className="block max-w-14 truncate px-1 py-0.5 text-center text-[10px] text-muted-foreground">
                {c.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {showWorkspaceImport && (
        <div className="rounded-xl border border-rose-500/30 bg-background/60 p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Click any AI image from your standard <code className="text-rose-200">/workspace</code> to import &amp; select it here:
          </p>
          {workspaceImages.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading workspace images…
            </div>
          ) : workspaceImages.data && workspaceImages.data.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {workspaceImages.data.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  disabled={importWorkspace.isPending}
                  onClick={() => importWorkspace.mutate({ sourceGenerationId: img.id })}
                  className="group relative overflow-hidden rounded-lg border border-border/60 transition-all hover:border-rose-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.imageUrl ?? ""} alt="" className="aspect-square w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Import
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No additional images found in your standard workspace.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Interactive Before / After comparison viewer with Split-Curtain Slider & Side-by-Side modes.
 */
export function UncensoredBeforeAfterCompare({
  beforeUrl,
  afterUrl,
  beforeLabel = "Original",
  afterLabel = "Result",
  children,
}: {
  beforeUrl?: string | null;
  afterUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  children?: React.ReactNode;
}) {
  const [viewMode, setViewMode] = useState<"split" | "side">("split");
  const [splitPos, setSplitPos] = useState(50);

  if (!beforeUrl && !afterUrl) return null;

  if (beforeUrl && !afterUrl) {
    return (
      <div className="mt-6 max-w-md">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{beforeLabel}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt={beforeLabel} className="w-full rounded-xl border border-border/60" />
      </div>
    );
  }

  return (
    <div className="mt-6">
      {beforeUrl && afterUrl && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-300">
            {beforeLabel} vs. {afterLabel}
          </p>
          <div className="inline-flex rounded-lg border border-border/60 bg-background/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                viewMode === "split" ? "bg-rose-500/20 font-medium text-rose-200" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SplitSquareHorizontal className="h-3.5 w-3.5" /> Interactive Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode("side")}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition-colors ${
                viewMode === "side" ? "bg-rose-500/20 font-medium text-rose-200" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" /> Side-by-Side
            </button>
          </div>
        </div>
      )}

      {beforeUrl && afterUrl && viewMode === "split" ? (
        <div className="mx-auto max-w-xl">
          <div className="relative select-none overflow-hidden rounded-xl border border-rose-500/40 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={afterUrl} alt={afterLabel} className="block w-full" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeUrl}
              alt={beforeLabel}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.9)]"
              style={{ left: `${splitPos}%` }}
            >
              <div className="absolute top-1/2 -left-3.5 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-rose-300 bg-rose-600 text-[10px] font-bold text-white shadow-lg">
                ↔
              </div>
            </div>
            <span className="pointer-events-none absolute top-2.5 left-2.5 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-200">
              {beforeLabel}
            </span>
            <span className="pointer-events-none absolute top-2.5 right-2.5 rounded bg-rose-600/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              {afterLabel}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={splitPos}
              aria-label="Before and after comparison slider"
              onChange={(e) => setSplitPos(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
          {children}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {beforeUrl && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{beforeLabel}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={beforeUrl} alt={beforeLabel} className="w-full rounded-xl border border-border/60" />
            </div>
          )}
          {afterUrl && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-rose-300">{afterLabel}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={afterUrl} alt={afterLabel} className="w-full rounded-xl border border-rose-500/40" />
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


