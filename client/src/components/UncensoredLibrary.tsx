"use client";

import { useMemo, useState } from "react";
import { Download, Film, Paintbrush, User, UserPlus, Wand2, Maximize, RotateCcw, Trash2, RefreshCw, Star, Scissors, LayoutGrid, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatUncensoredRecipe, getUncensoredAspectFromSize } from "@shared/uncensoredStudio";

type Filter = "all" | "image" | "video" | "starred";

export default function UncensoredLibrary({
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
  onRecreate,
  onSheet,
  onOutfit,
}: {
  onRefine: (id: number) => void;
  onInpaint: (id: number) => void;
  onAnimate: (id: number) => void;
  onUseCharacter: (id: number) => void;
  onRecreate: (id: number) => void;
  onSheet: (id: number) => void;
  onOutfit: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const items = trpc.uncensored.myLibrary.useQuery();
  const savedChars = trpc.uncensored.listCharacters.useQuery();
  const [savingFor, setSavingFor] = useState<number | null>(null);
  const [updatingFor, setUpdatingFor] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [charName, setCharName] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const saveCharacter = trpc.uncensored.saveCharacter.useMutation({
    onSuccess: (data) => {
      utils.uncensored.listCharacters.invalidate();
      setSavingFor(null);
      setCharName("");
      toast.success(`${data.name} saved to your characters.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateCharacter = trpc.uncensored.updateCharacter.useMutation({
    onSuccess: (data) => {
      utils.uncensored.listCharacters.invalidate();
      setUpdatingFor(null);
      toast.success(`${data.name}'s reference updated.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleStar = trpc.uncensored.toggleStar.useMutation({
    onSuccess: (data) => {
      utils.uncensored.myLibrary.invalidate();
      toast.success(data.starred ? "Starred." : "Removed from starred.");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteGeneration = trpc.uncensored.deleteGeneration.useMutation({
    onSuccess: () => {
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.myUncensoredImages.invalidate();
      setConfirmDelete(null);
      toast.success("Removed from your library.");
    },
    onError: (e) => toast.error(e.message),
  });
  const cutout = trpc.uncensored.removeBackground.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      toast.success("Cutout ready — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });
  const upscale = trpc.uncensored.upscale.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      toast.success("Upscaled — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items.data ?? []).filter((img) => {
      const meta = (img.metadata as Record<string, unknown> | null) ?? {};
      if (filter === "starred") {
        if (!meta.starred) return false;
      } else if (filter !== "all" && img.mediaType !== filter) {
        return false;
      }
      if (q && !img.prompt.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items.data, filter, query]);

  if (items.isLoading) {
    return <p className="mt-8 text-sm text-muted-foreground">Loading your library…</p>;
  }
  if (!items.data?.length) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        Nothing here yet — generate on the Create tab and every private image lands in this library.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">Your library</h2>
      <p className="mt-1 text-sm text-muted-foreground">Private. Never gallery. Click through to refine, inpaint, or animate.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {([
          { id: "all" as const, label: "All" },
          { id: "image" as const, label: "Images" },
          { id: "video" as const, label: "Video" },
          { id: "starred" as const, label: "Starred" },
        ]).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.id
                ? "border-rose-500 bg-rose-500/10 text-rose-300"
                : "border-border/60 text-muted-foreground hover:border-rose-500/40"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompts…"
          className="h-8 max-w-xs"
        />
      </div>
      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing matches that filter.</p>
      ) : (
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((img) => {
          const isVideo = img.mediaType === "video";
          return (
          <div key={img.id} className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {isVideo ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={img.imageUrl ?? ""} className="aspect-[3/4] w-full object-cover" muted loop playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.imageUrl ?? ""} alt={img.prompt.slice(0, 80)} className="aspect-[3/4] w-full object-cover" />
            )}
            <p className="line-clamp-2 px-2 pt-2 text-[11px] text-muted-foreground">{img.prompt}</p>
            {(() => {
              const meta = (img.metadata as Record<string, unknown> | null) ?? {};
              const bits = [
                typeof meta.style === "string" ? meta.style : null,
                typeof meta.seed === "number" ? `seed ${meta.seed}` : null,
              ].filter(Boolean);
              return bits.length ? (
                <p className="px-2 text-[10px] text-muted-foreground/80">{bits.join(" · ")}</p>
              ) : null;
            })()}
            <div className="flex flex-wrap gap-1 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={toggleStar.isPending}
                onClick={() => toggleStar.mutate({ id: img.id })}
              >
                <Star
                  className={`mr-1 h-3 w-3 ${((img.metadata as Record<string, unknown> | null)?.starred ? "fill-rose-400 text-rose-400" : "")}`}
                />
                Star
              </Button>
              {!isVideo && (
                <>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onRefine(img.id)}>
                <Wand2 className="mr-1 h-3 w-3" /> Refine
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onInpaint(img.id)}>
                <Paintbrush className="mr-1 h-3 w-3" /> Inpaint
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onAnimate(img.id)}>
                <Film className="mr-1 h-3 w-3" /> Animate
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onSheet(img.id)}>
                <LayoutGrid className="mr-1 h-3 w-3" /> Sheet
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onOutfit(img.id)}>
                <Shirt className="mr-1 h-3 w-3" /> Outfit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={cutout.isPending}
                onClick={() => cutout.mutate({ sourceGenerationId: img.id })}
              >
                <Scissors className="mr-1 h-3 w-3" /> Cutout
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onRecreate(img.id)}>
                <RotateCcw className="mr-1 h-3 w-3" /> Recreate
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onUseCharacter(img.id)}>
                <User className="mr-1 h-3 w-3" /> Lock
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  setSavingFor(savingFor === img.id ? null : img.id);
                  setUpdatingFor(null);
                  setCharName("");
                }}
              >
                <UserPlus className="mr-1 h-3 w-3" /> Save
              </Button>
              {savedChars.data && savedChars.data.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    setUpdatingFor(updatingFor === img.id ? null : img.id);
                    setSavingFor(null);
                  }}
                >
                  <RefreshCw className="mr-1 h-3 w-3" /> Update char
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={upscale.isPending}
                onClick={() => upscale.mutate({ sourceGenerationId: img.id, scale: "2x" })}
              >
                <Maximize className="mr-1 h-3 w-3" /> 2×
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={upscale.isPending}
                onClick={() => upscale.mutate({ sourceGenerationId: img.id, scale: "4x" })}
              >
                <Maximize className="mr-1 h-3 w-3" /> 4×
              </Button>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => {
                  const meta = (img.metadata as Record<string, unknown> | null) ?? {};
                  void navigator.clipboard.writeText(
                    formatUncensoredRecipe({
                      prompt: img.prompt,
                      style: typeof meta.style === "string" ? meta.style : null,
                      aspect: getUncensoredAspectFromSize(img.width, img.height),
                      framing: typeof meta.framing === "string" ? meta.framing : null,
                      pose: typeof meta.pose === "string" ? meta.pose : null,
                      camera: typeof meta.camera === "string" ? meta.camera : null,
                      lighting: typeof meta.lighting === "string" ? meta.lighting : null,
                      wardrobe: typeof meta.wardrobe === "string" ? meta.wardrobe : null,
                      setting: typeof meta.setting === "string" ? meta.setting : null,
                      seed: typeof meta.seed === "number" ? meta.seed : null,
                    }),
                  );
                  toast.success("Recipe copied.");
                }}
              >
                Copy recipe
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                <a href={img.imageUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1 h-3 w-3" /> Open
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-rose-300 hover:text-rose-200"
                disabled={deleteGeneration.isPending}
                onClick={() => {
                  if (confirmDelete === img.id) {
                    deleteGeneration.mutate({ id: img.id });
                  } else {
                    setConfirmDelete(img.id);
                  }
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" /> {confirmDelete === img.id ? "Confirm" : "Delete"}
              </Button>
            </div>
            {savingFor === img.id && !isVideo && (
              <div className="flex items-center gap-2 border-t border-border/40 p-2">
                <Input
                  value={charName}
                  onChange={(e) => setCharName(e.target.value.slice(0, 40))}
                  placeholder="Name this character"
                  maxLength={40}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && charName.trim()) {
                      saveCharacter.mutate({ name: charName.trim(), sourceGenerationId: img.id });
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-8"
                  disabled={saveCharacter.isPending || charName.trim().length < 1}
                  onClick={() => saveCharacter.mutate({ name: charName.trim(), sourceGenerationId: img.id })}
                >
                  Save
                </Button>
              </div>
            )}
            {updatingFor === img.id && !isVideo && savedChars.data && (
              <div className="flex flex-wrap gap-2 border-t border-border/40 p-2">
                {savedChars.data.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={updateCharacter.isPending}
                    onClick={() => updateCharacter.mutate({ id: c.id, sourceGenerationId: img.id })}
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
