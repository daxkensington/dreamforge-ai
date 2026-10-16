"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Film,
  Paintbrush,
  User,
  UserPlus,
  Wand2,
  Maximize,
  RotateCcw,
  Trash2,
  RefreshCw,
  Star,
  Scissors,
  LayoutGrid,
  Shirt,
  CheckSquare,
  Square,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatUncensoredRecipe, getUncensoredAspectFromSize } from "@shared/uncensoredStudio";

type Filter = "all" | "image" | "video" | "starred";
type SortBy = "newest" | "oldest" | "starred";

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
  const [charFilterId, setCharFilterId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inspectId, setInspectId] = useState<number | null>(null);

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
  const bulkDelete = trpc.uncensored.bulkDeleteGenerations.useMutation({
    onSuccess: (res) => {
      utils.uncensored.myLibrary.invalidate();
      utils.uncensored.myUncensoredImages.invalidate();
      setSelectedIds([]);
      setSelectMode(false);
      toast.success(`Removed ${res.deletedCount} item${res.deletedCount === 1 ? "" : "s"} from your library.`);
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
    const activeChar = savedChars.data?.find((c) => c.id === charFilterId) ?? null;
    const filtered = (items.data ?? []).filter((img) => {
      const meta = (img.metadata as Record<string, unknown> | null) ?? {};
      if (filter === "starred") {
        if (!meta.starred) return false;
      } else if (filter !== "all" && img.mediaType !== filter) {
        return false;
      }
      if (activeChar) {
        const matchesSavedId = meta.savedCharacterId === activeChar.id;
        const matchesRefGen =
          activeChar.generationId != null &&
          (img.id === activeChar.generationId || img.parentGenerationId === activeChar.generationId);
        if (!matchesSavedId && !matchesRefGen) return false;
      }
      if (q && !img.prompt.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "starred") {
        const aStar = Boolean((a.metadata as Record<string, unknown> | null)?.starred);
        const bStar = Boolean((b.metadata as Record<string, unknown> | null)?.starred);
        if (aStar !== bStar) return aStar ? -1 : 1;
      }
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : a.id;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : b.id;
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [items.data, savedChars.data, filter, charFilterId, sortBy, query]);

  const inspectedIndex = useMemo(
    () => (inspectId == null ? -1 : visible.findIndex((i) => i.id === inspectId)),
    [inspectId, visible],
  );
  const inspectedItem = inspectedIndex >= 0 ? visible[inspectedIndex] ?? null : null;

  useEffect(() => {
    if (inspectId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInspectId(null);
      if (e.key === "ArrowLeft" && inspectedIndex > 0) {
        setInspectId(visible[inspectedIndex - 1]!.id);
      }
      if (e.key === "ArrowRight" && inspectedIndex >= 0 && inspectedIndex < visible.length - 1) {
        setInspectId(visible[inspectedIndex + 1]!.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspectId, inspectedIndex, visible]);

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkDownload = () => {
    const targets = visible.filter((i) => selectedIds.includes(i.id) && i.imageUrl);
    if (targets.length === 0) return;
    targets.forEach((item, idx) => {
      window.setTimeout(() => {
        const a = document.createElement("a");
        a.href = item.imageUrl!;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.download = `dreamforgex-uncensored-${item.id}.${item.mediaType === "video" ? "mp4" : "png"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 250);
    });
    toast.success(`Downloading ${targets.length} item${targets.length === 1 ? "" : "s"}…`);
  };

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Your Private Vault ({visible.length})</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Private. Never gallery. Click any image to inspect full-screen, or launch into Refine, Inpaint, Outfit, Sheet &amp; Video.
          </p>
        </div>
        <Button
          type="button"
          variant={selectMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setSelectMode((v) => !v);
            setSelectedIds([]);
          }}
          className={selectMode ? "bg-rose-500 text-white hover:bg-rose-600" : ""}
        >
          <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
          {selectMode ? "Done selecting" : "Select multiple"}
        </Button>
      </div>

      {selectMode && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-rose-200">
            <span className="font-semibold">{selectedIds.length} selected</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSelectedIds(visible.map((i) => i.id))}
            >
              Select all ({visible.length})
            </Button>
            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={selectedIds.length === 0}
              onClick={handleBulkDownload}
            >
              <Download className="mr-1 h-3 w-3" /> Download ({selectedIds.length})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-rose-500/40 text-xs text-rose-300 hover:bg-rose-500/20"
              disabled={selectedIds.length === 0 || bulkDelete.isPending}
              onClick={() => bulkDelete.mutate({ ids: selectedIds })}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Delete ({selectedIds.length})
            </Button>
          </div>
        </div>
      )}

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
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {([
            { id: "newest" as const, label: "Newest" },
            { id: "starred" as const, label: "Starred first" },
            { id: "oldest" as const, label: "Oldest" },
          ]).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSortBy(s.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                sortBy === s.id
                  ? "border-rose-500/60 bg-rose-500/15 text-rose-200"
                  : "border-border/60 text-muted-foreground hover:border-rose-500/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search prompts…"
          className="h-8 max-w-xs"
        />
      </div>

      {savedChars.data && savedChars.data.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Character filter:</span>
          <button
            type="button"
            onClick={() => setCharFilterId(null)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
              charFilterId === null
                ? "border-rose-500 bg-rose-500/15 text-rose-200"
                : "border-border/60 text-muted-foreground hover:border-rose-500/40"
            }`}
          >
            All characters
          </button>
          {savedChars.data.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCharFilterId(charFilterId === c.id ? null : c.id)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                charFilterId === c.id
                  ? "border-rose-500 bg-rose-500/15 text-rose-200"
                  : "border-border/60 text-muted-foreground hover:border-rose-500/40"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing matches that filter.</p>
      ) : (
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((img) => {
          const isVideo = img.mediaType === "video";
          const isSelected = selectedIds.includes(img.id);
          return (
          <div
            key={img.id}
            className={`overflow-hidden rounded-xl border bg-card/40 transition-all ${
              isSelected ? "border-rose-500 ring-2 ring-rose-500/40" : "border-border/60"
            }`}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (selectMode) toggleSelectId(img.id);
                else setInspectId(img.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (selectMode) toggleSelectId(img.id);
                  else setInspectId(img.id);
                }
              }}
              className="group relative cursor-pointer"
            >
              {isVideo ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={img.imageUrl ?? ""} className="aspect-[3/4] w-full object-cover" muted loop playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.imageUrl ?? ""} alt={img.prompt.slice(0, 80)} className="aspect-[3/4] w-full object-cover" />
              )}
              {selectMode ? (
                <span className="absolute left-2 top-2 rounded-md bg-black/75 p-1 text-rose-300">
                  {isSelected ? <CheckSquare className="h-4 w-4 text-rose-400" /> : <Square className="h-4 w-4" />}
                </span>
              ) : (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Eye className="h-3 w-3 text-rose-400" /> Inspect
                </span>
              )}
            </div>
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
              {isVideo && img.parentGenerationId && (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onAnimate(img.parentGenerationId!)}>
                  <Film className="mr-1 h-3 w-3" /> Animate again
                </Button>
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

      {inspectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setInspectId(null)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-rose-500/35 bg-zinc-950 p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 font-semibold text-rose-300">
                  #{inspectedItem.id} · {inspectedIndex + 1} of {visible.length}
                </span>
                {inspectedItem.width && inspectedItem.height && (
                  <span>{inspectedItem.width}×{inspectedItem.height}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={inspectedIndex <= 0}
                  onClick={() => inspectedIndex > 0 && setInspectId(visible[inspectedIndex - 1]!.id)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  disabled={inspectedIndex >= visible.length - 1}
                  onClick={() =>
                    inspectedIndex < visible.length - 1 && setInspectId(visible[inspectedIndex + 1]!.id)
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setInspectId(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="my-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/60">
              {inspectedItem.mediaType === "video" ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={inspectedItem.imageUrl ?? ""}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[60vh] w-auto rounded-lg object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inspectedItem.imageUrl ?? ""}
                  alt={inspectedItem.prompt.slice(0, 80)}
                  className="max-h-[60vh] w-auto rounded-lg object-contain"
                />
              )}
            </div>

            <p className="line-clamp-2 text-xs text-muted-foreground">{inspectedItem.prompt}</p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-3">
              {inspectedItem.mediaType !== "video" && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onRefine(id);
                    }}
                  >
                    <Wand2 className="mr-1 h-3.5 w-3.5 text-rose-400" /> Refine
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onInpaint(id);
                    }}
                  >
                    <Paintbrush className="mr-1 h-3.5 w-3.5 text-rose-400" /> Inpaint
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onOutfit(id);
                    }}
                  >
                    <Shirt className="mr-1 h-3.5 w-3.5 text-rose-400" /> Outfit Swap
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onSheet(id);
                    }}
                  >
                    <LayoutGrid className="mr-1 h-3.5 w-3.5 text-rose-400" /> 4-View Sheet
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onAnimate(id);
                    }}
                  >
                    <Film className="mr-1 h-3.5 w-3.5 text-rose-400" /> Animate 5s Video
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onUseCharacter(id);
                    }}
                  >
                    <User className="mr-1 h-3.5 w-3.5 text-rose-400" /> Lock Face
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      const id = inspectedItem.id;
                      setInspectId(null);
                      onRecreate(id);
                    }}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5 text-rose-400" /> Recreate
                  </Button>
                </>
              )}
              <Button asChild size="sm" className="ml-auto h-8 bg-gradient-to-r from-rose-500 to-orange-500 text-xs text-white">
                <a href={inspectedItem.imageUrl ?? "#"} download target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1 h-3.5 w-3.5" /> Download Full-Res
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
