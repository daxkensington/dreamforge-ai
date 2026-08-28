"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Paintbrush, Eraser, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNCENSORED_IMAGE_COST } from "@shared/uncensoredStudio";

/**
 * Paint-region inpaint on the caller's own uncensored generations.
 * Brush = change this; everything unpainted stays pixel-identical.
 */
export default function UncensoredInpaintStudio({
  focusGenerationId,
}: {
  focusGenerationId?: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(focusGenerationId ?? null);
  const [prompt, setPrompt] = useState("");
  const [brush, setBrush] = useState(32);
  const [erasing, setErasing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const utils = trpc.useUtils();
  const selected = images.data?.find((i) => i.id === sourceId) ?? null;

  useEffect(() => {
    if (focusGenerationId) setSourceId(focusGenerationId);
  }, [focusGenerationId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selected?.imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const mask = document.createElement("canvas");
      mask.width = img.naturalWidth;
      mask.height = img.naturalHeight;
      const mctx = mask.getContext("2d");
      if (mctx) {
        mctx.fillStyle = "#000000";
        mctx.fillRect(0, 0, mask.width, mask.height);
      }
      maskRef.current = mask;
    };
    img.src = selected.imageUrl;
  }, [selected?.imageUrl]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const stroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (!canvas || !mask || !drawing.current) return;
    const ctx = canvas.getContext("2d");
    const mctx = mask.getContext("2d");
    if (!ctx || !mctx) return;
    const p = pos(e);
    const prev = last.current ?? p;
    ctx.strokeStyle = erasing ? "rgba(0,0,0,0)" : "rgba(244,63,94,0.45)";
    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.lineWidth = brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    mctx.strokeStyle = erasing ? "#000000" : "#ffffff";
    mctx.lineWidth = brush;
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.beginPath();
    mctx.moveTo(prev.x, prev.y);
    mctx.lineTo(p.x, p.y);
    mctx.stroke();
    last.current = p;
  };

  const inpaint = trpc.uncensored.inpaint.useMutation({
    onSuccess: (data) => {
      setResultUrl(data.url);
      utils.uncensored.myUncensoredImages.invalidate();
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
    if (!mask) {
      toast.error("Paint the region to change first.");
      return;
    }
    inpaint.mutate({
      sourceGenerationId: sourceId,
      prompt: prompt.trim(),
      maskDataUrl: mask.toDataURL("image/png"),
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
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair rounded-xl border border-border/60 touch-none"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant={erasing ? "secondary" : "outline"} size="sm" onClick={() => setErasing(false)}>
              <Paintbrush className="mr-1 h-3.5 w-3.5" /> Paint
            </Button>
            <Button type="button" variant={erasing ? "outline" : "secondary"} size="sm" onClick={() => setErasing((v) => !v)}>
              <Eraser className="mr-1 h-3.5 w-3.5" /> Erase
            </Button>
            <div className="flex min-w-[160px] items-center gap-2">
              <span className="text-xs text-muted-foreground">Brush</span>
              <Slider value={[brush]} onValueChange={(v) => setBrush(v[0] ?? 32)} min={8} max={96} step={4} />
            </div>
          </div>
        </div>
      )}

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should appear in the painted region? (e.g. red silk dress, neon tattoo)"
        rows={3}
        maxLength={1000}
        disabled={inpaint.isPending}
        className="mt-4 resize-none"
      />

      <Button
        onClick={handleInpaint}
        disabled={inpaint.isPending || !sourceId || prompt.trim().length < 3}
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

      {resultUrl && (
        <div className="mt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Inpainted" className="w-full rounded-xl border border-rose-500/40" />
          <Button asChild variant="outline" size="sm" className="mt-2 w-full">
            <a href={resultUrl} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" /> Open full size
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
