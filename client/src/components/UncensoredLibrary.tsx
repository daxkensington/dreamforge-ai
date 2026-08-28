"use client";

import { Download, Film, Paintbrush, User, Wand2, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UNCENSORED_IMAGE_COST } from "@shared/uncensoredStudio";

export default function UncensoredLibrary({
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
}: {
  onRefine: (id: number) => void;
  onInpaint: (id: number) => void;
  onAnimate: (id: number) => void;
  onUseCharacter: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const items = trpc.uncensored.myLibrary.useQuery();
  const upscale = trpc.uncensored.upscale.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      toast.success("Upscaled — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });

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
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.data.map((img) => {
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
            <div className="flex flex-wrap gap-1 p-2">
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
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onUseCharacter(img.id)}>
                <User className="mr-1 h-3 w-3" /> Character
              </Button>
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
                  void navigator.clipboard.writeText(img.prompt);
                  toast.success("Prompt copied.");
                }}
              >
                Copy prompt
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                <a href={img.imageUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1 h-3 w-3" /> Open
                </a>
              </Button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
