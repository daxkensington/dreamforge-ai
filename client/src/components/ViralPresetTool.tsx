"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Loader2,
  Wand2,
  Upload,
  Download,
  RotateCcw,
  Share2,
} from "lucide-react";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShareButton } from "@/components/ShareButton";
import type { LucideIcon } from "lucide-react";

export interface ViralPresetToolProps {
  preset:
    | "action-figure"
    | "funko-pop"
    | "chibi-figure"
    | "lego-mini"
    | "pet-to-person"
    | "barbie-box"
    | "jellycat-plush"
    | "pop-mart";
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  examplePrompts: string[];
  /** Helper line shown above the prompt box. */
  hint?: string;
  /** Optional showcase image strip (file paths under /showcase). */
  showcase?: string[];
}

/**
 * Shared UI for all viral preset tools. Server-side `viral.transform`
 * mutation does the heavy lifting; this component is pure orchestration:
 * upload, optional note, generate, show result + share/download.
 *
 * We deliberately don't expose model/style pickers — for these viral tools
 * the preset IS the product. Cognitive load = 0 maximises the conversion
 * rate from social-share traffic.
 */
export function ViralPresetTool({
  preset,
  title,
  description,
  icon,
  gradient,
  examplePrompts,
  hint,
  showcase,
}: ViralPresetToolProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [note, setNote] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);

  const transform = trpc.viral.transform.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Done!");
      } else {
        toast.error(("error" in data && data.error) || "Generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const isLoading = transform.isPending;

  const handleFileUpload = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = () => {
    if (!imageUrl) {
      toast.error("Upload a photo first");
      return;
    }
    setResultUrl(null);
    setResultId(null);
    transform.mutate({ preset, imageUrl, note: note.trim() || undefined });
  };

  const handleReset = () => {
    setImageUrl("");
    setNote("");
    setResultUrl(null);
    setResultId(null);
  };

  return (
    <ToolPageLayout
      title={title}
      description={description}
      icon={icon}
      gradient={gradient}
    >
      <div className="max-w-6xl mx-auto">
        {showcase && showcase.length > 0 && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3 text-center">
              Examples
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {showcase.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={title + " example"}
                  className="aspect-square w-full rounded-xl object-cover bg-card/40"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Upload your photo
                  </Label>
                  <label
                    className="block aspect-square w-full rounded-xl border-2 border-dashed border-border/60 hover:border-cyan-500/50 transition-colors cursor-pointer overflow-hidden bg-background/40"
                    aria-label="Upload an image"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                      }}
                      disabled={isLoading}
                    />
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Source"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
                        <Upload className="h-8 w-8" />
                        <p className="text-sm">Click to upload</p>
                        <p className="text-xs opacity-60">
                          A clear front-facing photo works best
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Optional creative note
                  </Label>
                  {hint && (
                    <p className="text-xs text-muted-foreground mb-2">{hint}</p>
                  )}
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={examplePrompts[0]}
                    rows={3}
                    maxLength={300}
                    className="resize-none text-sm"
                    disabled={isLoading}
                  />
                  {examplePrompts.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {examplePrompts.slice(0, 3).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNote(p)}
                          disabled={isLoading}
                          className="text-[11px] px-2 py-1 rounded-md bg-background/50 border border-border/40 hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading || !imageUrl}
                    className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Generate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isLoading}
                    aria-label="Reset"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Output */}
          <div className="lg:col-span-3">
            <div className="aspect-square w-full rounded-2xl border border-border/50 bg-card/40 overflow-hidden flex items-center justify-center relative">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <p className="text-sm text-muted-foreground">
                    Conjuring pixels…
                  </p>
                </div>
              )}
              {!isLoading && resultUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultUrl}
                  alt={title + " result"}
                  className="w-full h-full object-contain"
                />
              )}
              {!isLoading && !resultUrl && (
                <div className="text-center px-8 max-w-sm">
                  <Wand2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Your creation will appear here.
                  </p>
                </div>
              )}
            </div>

            {resultUrl && (
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={resultUrl}
                  download={`dreamforgex-${preset}.png`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </a>
                {resultId !== null && (
                  <ShareButton
                    generationId={resultId}
                    shareText={`Check out my AI ${title.toLowerCase()} from DreamForgeX:`}
                  />
                )}
                {resultId === null && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      void navigator.clipboard.writeText(resultUrl);
                      toast.success("Image link copied!");
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    Copy image link
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
