"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/_core/hooks/useAuth";
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

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

type PhotoUpload =
  | { status: "idle" | "uploading" }
  | { status: "ready"; url: string }
  | { status: "failed"; message: string };

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
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [photo, setPhoto] = useState<PhotoUpload>({ status: "idle" });
  const uploadRequest = useRef<AbortController | null>(null);
  const photoInputId = useId();
  const [note, setNote] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);

  const transform = trpc.viral.transform.useMutation({
    onSuccess: data => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Done!");
      } else {
        toast.error(("error" in data && data.error) || "Generation failed");
      }
    },
    onError: err => toast.error(err.message),
  });

  const isLoading = transform.isPending;
  const imageUrl = photo.status === "ready" ? photo.url : "";

  useEffect(() => () => uploadRequest.current?.abort(), []);

  const handleFileUpload = async (file: File) => {
    if (!isAuthenticated) return;
    uploadRequest.current?.abort();
    uploadRequest.current = null;
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhoto({
        status: "failed",
        message: "Choose a JPG, PNG, WebP, GIF or AVIF image.",
      });
      return;
    }
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      setPhoto({
        status: "failed",
        message: "Choose a non-empty image up to 10 MB.",
      });
      return;
    }

    const controller = new AbortController();
    uploadRequest.current = controller;
    setPhoto({ status: "uploading" });

    try {
      // The transform endpoint accepts a storage URL, not a base64 file.
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const payload: { url?: unknown; error?: unknown } = await response
        .json()
        .catch(() => ({}));
      if (uploadRequest.current !== controller || controller.signal.aborted)
        return;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "Upload failed. Select the photo to try again."
        );
      }
      const url = payload?.url;
      if (
        typeof url !== "string" ||
        url.length > 2048 ||
        !/^https?:\/\//i.test(url)
      ) {
        throw new Error(
          "Upload did not return a usable image. Select the photo to try again."
        );
      }
      setPhoto({ status: "ready", url });
    } catch (error) {
      if (uploadRequest.current !== controller || controller.signal.aborted)
        return;
      setPhoto({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Upload failed. Select the photo to try again.",
      });
    } finally {
      if (uploadRequest.current === controller) uploadRequest.current = null;
    }
  };

  const handleGenerate = () => {
    if (!isAuthenticated || isLoading || uploadRequest.current) return;
    if (!imageUrl) {
      toast.error("Upload a photo first");
      return;
    }
    setResultUrl(null);
    setResultId(null);
    transform.mutate({ preset, imageUrl, note: note.trim() || undefined });
  };

  const handleReset = () => {
    uploadRequest.current?.abort();
    uploadRequest.current = null;
    setPhoto({ status: "idle" });
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
              {showcase.map(src => (
                <Image
                  key={src}
                  src={src}
                  alt={title + " example"}
                  width={400}
                  height={400}
                  sizes="(min-width: 640px) 280px, calc(50vw - 24px)"
                  className="aspect-square w-full rounded-xl object-cover bg-card/40"
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
                  <Label
                    htmlFor={photoInputId}
                    className="text-sm font-medium mb-2 block"
                  >
                    Upload your photo
                  </Label>
                  <div className="relative aspect-square w-full rounded-xl border-2 border-dashed border-border/60 hover:border-cyan-500/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-colors overflow-hidden bg-background/40">
                    <input
                      id={photoInputId}
                      type="file"
                      accept={PHOTO_TYPES.join(",")}
                      aria-describedby={`${photoInputId}-help`}
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      onChange={e => {
                        const file = e.currentTarget.files?.[0];
                        e.currentTarget.value = "";
                        if (file) void handleFileUpload(file);
                      }}
                      disabled={authLoading || !isAuthenticated || isLoading}
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
                        {photo.status === "uploading" ? (
                          <>
                            <Loader2
                              className="h-8 w-8 motion-safe:animate-spin"
                              aria-hidden="true"
                            />
                            <p role="status" className="text-sm">
                              Uploading photo…
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8" aria-hidden="true" />
                            <p className="text-sm">
                              {authLoading
                                ? "Checking sign-in…"
                                : isAuthenticated
                                  ? "Choose a photo"
                                  : "Sign in to upload"}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <p
                    id={`${photoInputId}-help`}
                    className="mt-2 text-xs text-muted-foreground"
                  >
                    JPG, PNG, WebP, GIF or AVIF up to 10 MB. A clear
                    front-facing photo works best.
                  </p>
                  {photo.status === "failed" && (
                    <p role="alert" className="mt-2 text-sm text-destructive">
                      {photo.message}
                    </p>
                  )}
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
                    onChange={e => setNote(e.target.value)}
                    placeholder={examplePrompts[0]}
                    rows={3}
                    maxLength={300}
                    className="resize-none text-sm"
                    disabled={isLoading}
                  />
                  {examplePrompts.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {examplePrompts.slice(0, 3).map(p => (
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
                    disabled={isLoading || !isAuthenticated || !imageUrl}
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
