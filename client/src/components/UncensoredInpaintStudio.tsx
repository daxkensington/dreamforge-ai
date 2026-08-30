"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paintbrush, Eraser, Download, Undo2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNCENSORED_IMAGE_COST } from "@shared/uncensoredStudio";

/**
 * Paint-region inpaint. Overlay canvas sits on the original so strokes never
 * destroy the photo. Hidden mask canvas is what the server blends with.
 */
export default function UncensoredInpaintStudio({
  focusGenerationId,
}: {
  focusGenerationId?: number | null;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<{ overlay: ImageData; mask: ImageData }[]>([]);
  const [sourceId, setSourceId] = useState<number | null>(focusGenerationId ?? null);
  const [prompt, setPrompt] = useState("");
  const [brush, setBrush] = useState(32);
  const [strength, setStrength] = useState(55);
  const [erasing, setErasing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);
  const [hasPaint, setHasPaint] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const utils = trpc.useUtils();
  const selected = images.data?.find((i) => i.id === sourceId) ?? null;

  useEffect(() => {
    if (focusGenerationId) setSourceId(focusGenerationId);
  }, [focusGenerationId]);

  const resetMask = useCallback((w: number, h: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.width = w;
    overlay.height = h;
    const octx = overlay.getContext("2d");
    octx?.clearRect(0, 0, w, h);
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext("2d");
    if (mctx) {
      mctx.fillStyle = "#000000";
      mctx.fillRect(0, 0, w, h);
    }
    maskRef.current = mask;
    historyRef.current = [];
    setHasPaint(false);
  }, []);

  useEffect(() => {
    if (!selected?.imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resetMask(img.naturalWidth, img.naturalHeight);
    img.src = selected.imageUrl;
  }, [selected?.imageUrl, resetMask]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = overlayRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const snapshot = () => {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!overlay || !mask) return;
    const octx = overlay.getContext("2d");
    const mctx = mask.getContext("2d");
    if (!octx || !mctx) return;
    historyRef.current.push({
      overlay: octx.getImageData(0, 0, overlay.width, overlay.height),
      mask: mctx.getImageData(0, 0, mask.width, mask.height),
    });
    if (historyRef.current.length > 30) historyRef.current.shift();
  };

  const stroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!overlay || !mask || !drawing.current) return;
    const octx = overlay.getContext("2d");
    const mctx = mask.getContext("2d");
    if (!octx || !mctx) return;
    const p = pos(e);
    const prev = last.current ?? p;

    octx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    octx.strokeStyle = erasing ? "rgba(0,0,0,1)" : "rgba(244,63,94,0.5)";
    octx.lineWidth = brush;
    octx.lineCap = "round";
    octx.lineJoin = "round";
    octx.beginPath();
    octx.moveTo(prev.x, prev.y);
    octx.lineTo(p.x, p.y);
    octx.stroke();
    octx.globalCompositeOperation = "source-over";

    mctx.strokeStyle = erasing ? "#000000" : "#ffffff";
    mctx.lineWidth = brush;
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.beginPath();
    mctx.moveTo(prev.x, prev.y);
    mctx.lineTo(p.x, p.y);
    mctx.stroke();
    last.current = p;
    setHasPaint(true);
  };

  const undo = () => {
    const prev = historyRef.current.pop();
    const overlay = overlayRef.current;
    const mask = maskRef.current;
    if (!prev || !overlay || !mask) {
      if (overlay) resetMask(overlay.width, overlay.height);
      return;
    }
    overlay.getContext("2d")?.putImageData(prev.overlay, 0, 0);
    mask.getContext("2d")?.putImageData(prev.mask, 0, 0);
  };

  const inpaint = trpc.uncensored.inpaint.useMutation({
    onSuccess: (data) => {
      setResultUrl(data.url);
      setResultId(data.generationId);
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      toast.success("Region updated — original is untouched.");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleInpaint = () => {
    if (!sourceId) {
      toast.error("Pick one of your images.");
      return;
    }
    if (prompt.trim().length < 3) {
      toast.error("Describe what should appear in the painted region.");
      return;
    }
    const mask = maskRef.current;
    if (!mask || !hasPaint) {
      toast.error("Paint the region to change first.");
      return;
    }
    inpaint.mutate({
      sourceGenerationId: sourceId,
      prompt: prompt.trim(),
      maskDataUrl: mask.toDataURL("image/png"),
      strength: Math.min(0.85, Math.max(0.3, strength / 100)),
    });
  };

  return (
    <div className="mt-8 rounded-2xl border border-rose-500/30 bg-card/40 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inpaint a region</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paint over what to change. Everything else stays identical.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{UNCENSORED_IMAGE_COST.inpaint} credits</span>
      </div>

      <div className="mt-4">
        <p className="text-sm text-muted-foreground">Pick one of your uncensored images:</p>
        {images.data && images.data.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.data.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => {
                  setSourceId(img.id);
                  setResultUrl(null);
                  setResultId(null);
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
          <p className="mt-3 text-sm text-muted-foreground">Generate one first, then paint a region to edit.</p>
        )}
      </div>

      {selected && (
        <div className="mt-4">
          <div className="relative overflow-hidden rounded-xl border border-border/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.imageUrl ?? ""} alt="" className="block w-full" />
            <canvas
              ref={overlayRef}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => {
                (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
                snapshot();
                drawing.current = true;
                last.current = pos(e);
                stroke(e);
              }}
              onPointerMove={stroke}
              onPointerUp={() => {
                drawing.current = false;
                last.current = null;
              }}
              onPointerCancel={() => {
                drawing.current = false;
                last.current = null;
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant={erasing ? "outline" : "secondary"} size="sm" onClick={() => setErasing(false)}>
              <Paintbrush className="mr-1 h-3.5 w-3.5" /> Paint
            </Button>
            <Button type="button" variant={erasing ? "secondary" : "outline"} size="sm" onClick={() => setErasing(true)}>
              <Eraser className="mr-1 h-3.5 w-3.5" /> Erase
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={undo}>
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const o = overlayRef.current;
                if (o) resetMask(o.width, o.height);
              }}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
            <div className="flex min-w-[160px] flex-1 items-center gap-2">
              <span className="text-xs text-muted-foreground">Brush</span>
              <Slider value={[brush]} onValueChange={(v) => setBrush(v[0] ?? 32)} min={8} max={96} step={4} />
            </div>
          </div>
        </div>
      )}

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            handleInpaint();
          }
        }}
        placeholder="What should appear in the painted region? (e.g. red silk dress, neon tattoo)"
        rows={3}
        maxLength={1000}
        disabled={inpaint.isPending}
        className="mt-4 resize-none"
      />

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">How much to change the painted region</span>
          <span className="font-medium">
            {strength <= 40 ? "Subtle" : strength <= 65 ? "Balanced" : "Heavy"}
          </span>
        </div>
        <Slider
          value={[strength]}
          onValueChange={(v) => setStrength(v[0] ?? 55)}
          min={30}
          max={85}
          step={5}
          disabled={inpaint.isPending}
          className="mt-2"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Lower keeps more of the original pixels in the brush; higher replaces the region more freely.
        </p>
      </div>

      <Button
        onClick={handleInpaint}
        disabled={inpaint.isPending || !sourceId || prompt.trim().length < 3 || !hasPaint}
        className="mt-4 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
        size="lg"
      >
        {inpaint.isPending ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Inpainting…
          </>
        ) : (
          <>
            <Paintbrush className="mr-2 h-5 w-5" /> Inpaint region · {UNCENSORED_IMAGE_COST.inpaint} credits
          </>
        )}
      </Button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">Ctrl+Enter to run</p>

      {resultUrl && (
        <div className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Inpainted" className="w-full rounded-xl border border-rose-500/40" />
          <div className="mt-2 flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={resultUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" /> Open full size
              </a>
            </Button>
            {resultId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setSourceId(resultId);
                  setResultUrl(null);
                  setResultId(null);
                  toast.info("Now painting on the new image.");
                }}
              >
                Continue from this
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
