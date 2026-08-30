"use client";

import { Download, Film, Lock, Maximize, Paintbrush, UserPlus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/**
 * Shared follow-up actions for a finished uncensored image so Refine / Inpaint
 * don't dump the user back to Library to keep working.
 */
export default function UncensoredResultActions({
  generationId,
  url,
  onRefine,
  onInpaint,
  onAnimate,
  onUseCharacter,
  onContinue,
  onSave,
}: {
  generationId: number;
  url: string;
  onRefine?: (id: number) => void;
  onInpaint?: (id: number) => void;
  onAnimate?: (id: number) => void;
  onUseCharacter?: (id: number) => void;
  onContinue?: () => void;
  onSave?: () => void;
}) {
  const utils = trpc.useUtils();
  const upscale = trpc.uncensored.upscale.useMutation({
    onSuccess: () => {
      utils.uncensored.myUncensoredImages.invalidate();
      utils.uncensored.myLibrary.invalidate();
      toast.success("Upscaled — added to your library.");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mt-2 flex flex-wrap gap-2">
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
      {onSave && (
        <Button type="button" variant="outline" size="sm" onClick={onSave}>
          <UserPlus className="mr-1 h-3.5 w-3.5" /> Save
        </Button>
      )}
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
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Download className="mr-1 h-3.5 w-3.5" /> Open
        </a>
      </Button>
    </div>
  );
}
