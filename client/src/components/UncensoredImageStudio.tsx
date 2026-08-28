"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Loader2, Download, Lock, Sparkles, RotateCcw, Wand2, Film, Paintbrush, Maximize, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  UNCENSORED_ASPECTS,
  UNCENSORED_FRAMINGS,
  UNCENSORED_POSES,
  UNCENSORED_IMAGE_COST,
  DEFAULT_UNCENSORED_ASPECT,
  DEFAULT_UNCENSORED_NEGATIVE,
  UNCENSORED_PROMPT_CHIPS,
} from "@shared/uncensoredStudio";
import { UNCENSORED_STYLES, DEFAULT_UNCENSORED_STYLE } from "@shared/uncensoredStyles";

/**
 * Paid uncensored image studio. Portrait-first, quality tier, framing,
 * seed, variations, and optional same-character lock against the caller's
 * own generations. This is the product pass-holders came for — not a toggle
 * buried in the SFW workspace.
 */
export default function UncensoredImageStudio({
  focusCharacterId,
  onRefine,
  onInpaint,
  onAnimate,
}: {
  focusCharacterId?: number | null;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
} = {}) {
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [style, setStyle] = useState(DEFAULT_UNCENSORED_STYLE);
  const [aspect, setAspect] = useState(DEFAULT_UNCENSORED_ASPECT);
  const [framing, setFraming] = useState<string | null>("bust");
  const [pose, setPose] = useState<string | null>(null);
  const [quality, setQuality] = useState<"fast" | "quality">("fast");
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [savedCharacterId, setSavedCharacterId] = useState<number | null>(null);
  const [savingFor, setSavingFor] = useState<number | null>(null);
  const [charName, setCharName] = useState("");
  const [results, setResults] = useState<{ url: string; seed: number | null; generationId: number }[]>([]);

  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const savedChars = trpc.uncensored.listCharacters.useQuery();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (focusCharacterId) {
      setCharacterId(focusCharacterId);
      setShowAdvanced(true);
    }
  }, [focusCharacterId]);

  const gen = trpc.uncensored.generate.useMutation({
    onSuccess: (data) => {
      setResults(data.images);
      utils.uncensored.myUncensoredImages.invalidate();
      toast.success(data.images.length === 1 ? "Image ready." : `${data.images.length} images ready.`);
      utils.uncensored.myLibrary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const upscale = trpc.uncensored.upscale.useMutation({
    onSuccess: (data) => {
      setResults((prev) => [{ url: data.url, seed: null, generationId: data.generationId }, ...prev]);
      utils.uncensored.myUncensoredImages.invalidate();
      toast.success("Upscaled.");
    },
    onError: (e) => toast.error(e.message),
  });

  const saveCharacter = trpc.uncensored.saveCharacter.useMutation({
    onSuccess: (data) => {
      utils.uncensored.listCharacters.invalidate();
      setSavingFor(null);
      setCharName("");
      setSavedCharacterId(data.id);
      setCharacterId(null);
      toast.success(`${data.name} saved — locked for the next shot.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCharacter = trpc.uncensored.deleteCharacter.useMutation({
    onSuccess: () => {
      utils.uncensored.listCharacters.invalidate();
      toast.success("Character removed.");
    },
    onError: (e) => toast.error(e.message),
  });

  const characterLocked = !!characterId || !!savedCharacterId;
  const unitCost = characterLocked
    ? UNCENSORED_IMAGE_COST.character
    : UNCENSORED_IMAGE_COST[quality];
  const cost = unitCost * count;
  const aspectMeta = UNCENSORED_ASPECTS.find((a) => a.id === aspect) ?? UNCENSORED_ASPECTS[0];

  const parsedSeed = useMemo(() => {
    const n = Number(seed);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  }, [seed]);

  const appendChip = (text: string) => {
    setPrompt((p) => (p.trim() ? `${p.trim()}, ${text}` : text));
  };

  const handleGenerate = () => {
    if (prompt.trim().length < 3) {
      toast.error("Describe what you want to create.");
      return;
    }
    setResults([]);
    gen.mutate({
      prompt: prompt.trim(),
      negativePrompt: negative.trim() || undefined,
      style,
      aspect,
      framing: framing ?? undefined,
      pose: pose ?? undefined,
      quality,
      count,
      seed: parsedSeed,
      characterGenerationId: characterId ?? undefined,
      savedCharacterId: savedCharacterId ?? undefined,
    });
  };

  const reuseSeed = (s: number | null) => {
    if (s == null) return;
    setSeed(String(s));
    toast.info(`Seed ${s} locked — next generate reuses it.`);
  };

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-semibold">Create</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Unfiltered Flux on our GPUs. Portrait-first, private, no watermark.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{cost} credits</span>
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground mb-2">Characters — save one of your gens, then lock her for new scenes</p>
        {savedChars.data && savedChars.data.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {savedChars.data.map((c) => (
              <div key={c.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (savedCharacterId === c.id) {
                      setSavedCharacterId(null);
                    } else {
                      setSavedCharacterId(c.id);
                      setCharacterId(null);
                    }
                  }}
                  disabled={gen.isPending}
                  className={`overflow-hidden rounded-lg border-2 ${
                    savedCharacterId === c.id
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
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (savedCharacterId === c.id) setSavedCharacterId(null);
                    deleteCharacter.mutate({ id: c.id });
                  }}
                  className="absolute -right-1 -top-1 rounded-full bg-black/80 p-0.5 text-muted-foreground hover:text-rose-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Generate, then tap Save on a result to keep a named character.</p>
        )}
        {savedCharacterId && (
          <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-300">
            <Lock className="h-3 w-3" /> {savedChars.data?.find((c) => c.id === savedCharacterId)?.name ?? "Character"} locked — new scene, same identity.
          </p>
        )}
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the scene, character, lighting, mood…"
        rows={4}
        maxLength={1000}
        disabled={gen.isPending}
        className="mt-4 resize-none"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleGenerate();
          }
        }}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {UNCENSORED_PROMPT_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => appendChip(c.text)}
            className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-rose-500/40 hover:text-rose-200"
          >
            + {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground mb-2">Style</p>
        <div className="flex flex-wrap gap-2">
          {UNCENSORED_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              disabled={gen.isPending}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                style === s.id
                  ? "border-rose-500 bg-rose-500/10 text-rose-300"
                  : "border-border/60 text-muted-foreground hover:border-rose-500/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Aspect</p>
          <div className="flex flex-wrap gap-2">
            {UNCENSORED_ASPECTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAspect(a.id)}
                disabled={gen.isPending}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  aspect === a.id
                    ? "border-rose-500 bg-rose-500/10 text-rose-300"
                    : "border-border/60 text-muted-foreground hover:border-rose-500/40"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Framing</p>
          <div className="flex flex-wrap gap-2">
            {UNCENSORED_FRAMINGS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFraming(framing === f.id ? null : f.id)}
                disabled={gen.isPending}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  framing === f.id
                    ? "border-rose-500 bg-rose-500/10 text-rose-300"
                    : "border-border/60 text-muted-foreground hover:border-rose-500/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs text-muted-foreground mb-2">Pose</p>
        <div className="flex flex-wrap gap-2">
          {UNCENSORED_POSES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPose(pose === p.id ? null : p.id)}
              disabled={gen.isPending}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                pose === p.id
                  ? "border-rose-500 bg-rose-500/10 text-rose-300"
                  : "border-border/60 text-muted-foreground hover:border-rose-500/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border/60 p-1">
          {(["fast", "quality"] as const).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuality(q)}
              disabled={gen.isPending || characterLocked}
              className={`rounded-md px-3 py-1 text-xs capitalize ${
                quality === q && !characterLocked
                  ? "bg-rose-500/20 text-rose-200"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {q === "fast" ? `Fast · ${UNCENSORED_IMAGE_COST.fast}cr` : `Quality · ${UNCENSORED_IMAGE_COST.quality}cr`}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border/60 p-1">
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              disabled={gen.isPending}
              className={`rounded-md px-3 py-1 text-xs ${
                count === n ? "bg-rose-500/20 text-rose-200" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ×{n}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="mt-4 text-xs text-muted-foreground hover:text-foreground"
      >
        {showAdvanced ? "Hide" : "Show"} advanced · seed, negative, character lock
      </button>

      {showAdvanced && (
        <div className="mt-3 space-y-4 rounded-xl border border-border/50 bg-black/20 p-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Negative prompt</p>
            <Input
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
              placeholder={DEFAULT_UNCENSORED_NEGATIVE}
              maxLength={500}
              disabled={gen.isPending}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Seed (blank = random)</p>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
              placeholder="reproducible seed"
              disabled={gen.isPending}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Same character — lock to one of your own gens (img2img, {UNCENSORED_IMAGE_COST.character}cr)
            </p>
            {images.data && images.data.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {images.data.slice(0, 12).map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => {
                      setCharacterId(characterId === img.id ? null : img.id);
                      setSavedCharacterId(null);
                    }}
                    disabled={gen.isPending}
                    className={`overflow-hidden rounded-lg border-2 ${
                      characterId === img.id
                        ? "border-rose-500 ring-1 ring-rose-500/40"
                        : "border-transparent hover:border-rose-500/40"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl ?? ""} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Generate one first, then lock her for the next shot.</p>
            )}
            {characterId && !savedCharacterId && (
              <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-300">
                <Lock className="h-3 w-3" /> Character locked — new scene, same identity.
              </p>
            )}
          </div>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={gen.isPending || prompt.trim().length < 3}
        className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
        size="lg"
      >
        {gen.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating {aspectMeta.label.toLowerCase()}…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" /> Generate · {cost} credits
          </>
        )}
      </Button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Ctrl+Enter to generate</p>

      {results.length > 0 && (
        <div className={`mt-6 grid gap-3 ${results.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {results.map((r) => (
            <div key={r.generationId} className="overflow-hidden rounded-xl border border-rose-500/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt="Generated" className="w-full" />
              <div className="flex items-center justify-between gap-2 p-2 text-[11px] text-muted-foreground">
                <span>{r.seed != null ? `seed ${r.seed}` : aspectMeta.label}</span>
                <div className="flex flex-wrap gap-1">
                  {r.seed != null && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => reuseSeed(r.seed)}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Seed
                    </Button>
                  )}
                  {onRefine && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onRefine(r.generationId)}>
                      <Wand2 className="mr-1 h-3 w-3" /> Refine
                    </Button>
                  )}
                  {onInpaint && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onInpaint(r.generationId)}>
                      <Paintbrush className="mr-1 h-3 w-3" /> Inpaint
                    </Button>
                  )}
                  {onAnimate && (
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onAnimate(r.generationId)}>
                      <Film className="mr-1 h-3 w-3" /> Animate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={upscale.isPending}
                    onClick={() => upscale.mutate({ sourceGenerationId: r.generationId, scale: "2x" })}
                  >
                    <Maximize className="mr-1 h-3 w-3" /> 2×
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={upscale.isPending}
                    onClick={() => upscale.mutate({ sourceGenerationId: r.generationId, scale: "4x" })}
                  >
                    <Maximize className="mr-1 h-3 w-3" /> 4×
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      setCharacterId(r.generationId);
                      setSavedCharacterId(null);
                      setShowAdvanced(true);
                      toast.info("Character locked for the next shot.");
                    }}
                  >
                    <Lock className="mr-1 h-3 w-3" /> Lock
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => {
                      setSavingFor(savingFor === r.generationId ? null : r.generationId);
                      setCharName("");
                    }}
                  >
                    <UserPlus className="mr-1 h-3 w-3" /> Save
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-1 h-3 w-3" /> Open
                    </a>
                  </Button>
                </div>
              </div>
              {savingFor === r.generationId && (
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
                        saveCharacter.mutate({ name: charName.trim(), sourceGenerationId: r.generationId });
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    disabled={saveCharacter.isPending || charName.trim().length < 1}
                    onClick={() => saveCharacter.mutate({ name: charName.trim(), sourceGenerationId: r.generationId })}
                  >
                    {saveCharacter.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
