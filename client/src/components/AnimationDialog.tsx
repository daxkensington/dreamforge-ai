import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { isUnclaimedOperationError } from "@shared/operationIdentity";

const motions = {
  "smooth-pan": {
    label: "Smooth pan",
    prompt:
      "Slow, smooth camera pan. Preserve the subject and composition. Natural, subtle movement.",
  },
  "gentle-zoom": {
    label: "Gentle zoom",
    prompt:
      "A gentle cinematic camera push-in. Preserve the subject and details. Smooth natural movement.",
  },
  "parallax-drift": {
    label: "Parallax drift",
    prompt:
      "A subtle camera drift with natural parallax and depth. Preserve the original subject and scene.",
  },
  "cinematic-sweep": {
    label: "Cinematic sweep",
    prompt:
      "A smooth cinematic camera sweep around the subject. Preserve the subject, lighting and scene.",
  },
} as const;
type Motion = keyof typeof motions;
type Attempt = {
  userId: number;
  requestId: string;
  generationId: number;
  motion: Motion;
  prompt: string;
  expectedCreditCost: number;
};
const storageKey = (userId: number) => `dreamforgex:animation:${userId}`;
function readAttempt(userId: number): Attempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(storageKey(userId)) ?? "null"
    );
    if (
      value?.userId === userId &&
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value.requestId) &&
      Number.isSafeInteger(value.generationId) &&
      value.generationId > 0 &&
      Object.hasOwn(motions, value.motion) &&
      Number.isSafeInteger(value.expectedCreditCost) &&
      value.expectedCreditCost > 0
    ) {
      const prompt = value.prompt === undefined ? motions[value.motion as Motion].prompt : value.prompt;
      if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 1000) return null;
      return { ...value, prompt };
    }
  } catch {
    /* In-memory retries still retain their identity. */
  }
  return null;
}

export function AnimationDialog({
  open,
  onOpenChange,
  generationId,
  sourceUrl,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generationId: number | null;
  sourceUrl?: string | null;
  onComplete: () => void;
}) {
  const { user } = useAuth();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const attemptRef = useRef<Attempt | null>(null);
  const starting = useRef(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [motion, setMotion] = useState<Motion>("smooth-pan");
  const [prompt, setPrompt] = useState<string>(motions["smooth-pan"].prompt);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>();
  const policy = trpc.animation.policy.useQuery(undefined, {
    enabled: open,
    retry: 1,
  });
  useEffect(() => {
    const saved = user ? readAttempt(user.id) : null;
    attemptRef.current = saved;
    starting.current = false;
    setAttempt(saved);
    setMotion(saved?.motion ?? "smooth-pan");
    setPrompt(saved?.prompt ?? motions["smooth-pan"].prompt);
    setReview(false);
    setResultUrl(undefined);
    setMessage("");
  }, [user?.id]);
  const accept = (data: any, requestId: string) => {
    const current = attemptRef.current;
    if (
      !current ||
      current.requestId !== requestId ||
      current.userId !== owner.current
    )
      return;
    if (data.status === "completed" || data.status === "failed") {
      try {
        sessionStorage.removeItem(storageKey(current.userId));
      } catch {
        /* Optional browser storage. */
      }
      attemptRef.current = null;
      setAttempt(null);
      setReview(false);
      if (data.status === "completed") {
        setResultUrl(data.imageUrl);
        setMessage("Your video is ready and saved in generation history.");
        onComplete();
      } else
        setMessage(
          data.error ||
            "Animation failed. Check the credit refund shown in your history."
        );
    } else {
      setReview(Boolean(data.reconciliationRequired));
      setMessage(
        data.reconciliationRequired
          ? "The provider outcome needs review. Your original request is retained; it will not be submitted again."
          : "Your animation is queued or rendering. You can close this window and check it later."
      );
    }
  };
  const start = trpc.animation.start.useMutation({
    onSettled: (_data, _error, variables) => {
      if (attemptRef.current?.requestId === variables.requestId || !attemptRef.current) starting.current = false;
    },
    onSuccess: (data, variables) => accept(data, variables.requestId),
    onError: (error, variables) => {
      const current = attemptRef.current;
      if (
        !current ||
        current.userId !== owner.current ||
        current.requestId !== variables.requestId
      )
        return;
      setMessage(error.message);
      setReview(true);
      if (isUnclaimedOperationError(error.data?.code)) {
        if (error.data?.code === "PRECONDITION_FAILED") void policy.refetch();
        try {
          sessionStorage.removeItem(storageKey(current.userId));
        } catch {
          /* Optional browser storage. */
        }
        attemptRef.current = null;
        setAttempt(null);
      }
    },
  });
  const status = trpc.animation.status.useMutation({
    onSuccess: (data, variables) => accept(data, variables.requestId),
    onError: (error, variables) => {
      if (
        attemptRef.current?.requestId === variables.requestId &&
        attemptRef.current.userId === owner.current
      ) {
        setMessage(error.message);
        setReview(true);
      }
    },
  });
  useEffect(() => {
    if (
      !attempt ||
      !user ||
      attempt.userId !== user.id ||
      start.isPending ||
      status.isPending ||
      review
    )
      return;
    const timer = setTimeout(
      () => status.mutate({ requestId: attempt.requestId }),
      5000
    );
    return () => clearTimeout(timer);
  }, [attempt?.requestId, user?.id, start.isPending, status.isPending, review]);
  const submit = () => {
    if (!user || starting.current || start.isPending || status.isPending)
      return;
    let current = attemptRef.current;
    if (current && current.userId !== user.id) return;
    if (!current) {
      if (!generationId || !policy.data?.isConfigured) return;
      const description = prompt.trim() || motions[motion].prompt;
      if (description.length < 3) { setMessage("Use at least three characters for the motion description, or leave it blank to use the preset."); return; }
      current = {
        userId: user.id,
        requestId: crypto.randomUUID(),
        generationId,
        motion,
        prompt: description,
        expectedCreditCost: policy.data.creditCost,
      };
      attemptRef.current = current;
      setAttempt(current);
      try {
        sessionStorage.setItem(storageKey(user.id), JSON.stringify(current));
      } catch {
        /* Keep the in-memory attempt. */
      }
      setResultUrl(undefined);
    }
    starting.current = true;
    setReview(false);
    setMessage("Submitting the original animation request…");
    start.mutate({
      requestId: current.requestId,
      generationId: current.generationId,
      prompt: current.prompt,
      expectedCreditCost: current.expectedCreditCost,
    });
  };
  const busy = start.isPending || status.isPending;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Animate image to video</DialogTitle>
          <DialogDescription>
            Create a five-second, 480p video from your image. Motion prompts
            guide the result.
          </DialogDescription>
        </DialogHeader>
        {resultUrl ? (
          <video src={resultUrl} controls className="max-h-60 w-full rounded" />
        ) : (
          sourceUrl && (!attempt || attempt.generationId === generationId) && (
            <img
              src={sourceUrl}
              alt="Selected source image"
              className="max-h-48 w-full rounded object-contain"
            />
          )
        )}
        <div className="space-y-2">
          <Label>Camera movement</Label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(motions).map(([id, option]) => (
              <Button
                key={id}
                type="button"
                variant={motion === id ? "default" : "outline"}
                disabled={Boolean(attempt) || busy}
                aria-pressed={motion === id}
                onClick={() => { setMotion(id as Motion); setPrompt(option.prompt); }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="animation-motion-description">Motion description</Label>
          <Textarea id="animation-motion-description" value={attempt?.prompt ?? prompt} maxLength={1000} rows={3} disabled={Boolean(attempt) || busy} onChange={event => setPrompt(event.target.value)} placeholder="Describe how the image should move, or leave blank to use the camera preset." />
          <p className="text-xs text-muted-foreground">Optional · up to 1,000 characters. An unfinished request keeps its original description in this tab for safe retries.</p>
        </div>
        <p className="text-sm">
          {attempt
            ? `${attempt.expectedCreditCost.toLocaleString()} credits · original request quote.`
            : policy.data
              ? `${policy.data.creditCost.toLocaleString()} credits · ${policy.data.duration} seconds · ${policy.data.resolution} · Creator or higher`
              : "Loading the current quote…"}
        </p>
        {policy.data && !policy.data.isConfigured && (
          <p className="text-sm text-amber-500">
            Animation is temporarily unavailable. You will not be charged.
          </p>
        )}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {message || policy.error?.message}
        </p>
        {attempt && (
          <p className="text-xs text-muted-foreground">
            An unfinished animation for image #{attempt.generationId} is saved for this account. Check it before
            starting another image.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {attempt && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (attempt.userId !== owner.current) return;
                setReview(false);
                status.mutate({ requestId: attempt.requestId });
              }}
            >
              Check status
            </Button>
          )}
          <Button
            onClick={submit}
            disabled={
              busy ||
              (!attempt && (policy.isFetching || !generationId || !policy.data?.isConfigured))
            }
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {attempt
              ? "Retry original request"
              : resultUrl
                ? "Generate another video"
                : "Generate video"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
