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
  const images = trpc.uncensored.myUncensoredImages.useQuery();
  const upscale = trpc.uncensored.upscale.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      toast.success("Upscaled — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (images.isLoading) {
    return <p className="mt-8 text-sm text-muted-foreground">Loading your library…</p>;
  }
  if (!images.data?.length) {
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
        {images.data.map((img) => (
          <div key={img.id} className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl ?? ""} alt={img.prompt.slice(0, 80)} className="aspect-[3/4] w-full object-cover" />
            <p className="line-clamp-2 px-2 pt-2 text-[11px] text-muted-foreground">{img.prompt}</p>
            <div className="flex flex-wrap gap-1 p-2">
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
                <Maximize className="mr-1 h-3 w-3" /> 2× ({UNCENSORED_IMAGE_COST.upscale2x})
              </Button>
              <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                <a href={img.imageUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-1 h-3 w-3" /> Open
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
