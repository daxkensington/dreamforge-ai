import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import ToolPageLayout from "@/components/ToolPageLayout";
import { AnimationDialog } from "@/components/AnimationDialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { uploadOwnedMedia } from "@/lib/mediaUpload";
import { IMAGE_ANIMATION_POLICY } from "@shared/imageAnimation";
import { Film, Loader2, Upload } from "lucide-react";

export default function ToolImageToVideo() {
  const { user, loading } = useAuth();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const uploading = useRef<{ userId: number; token: string } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{
    userId: number;
    id: number;
    imageUrl: string;
  }>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setProgress(null);
    setError("");
    setSelected(undefined);
    setOpen(false);
  }, [user?.id]);
  const input = useRef<HTMLInputElement>(null);
  const history = trpc.generation.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: Boolean(user), retry: 1 }
  );
  const policy = trpc.animation.policy.useQuery();
  const importSource = trpc.animation.importSource.useMutation();
  const images =
    history.data?.filter(
      item =>
        item.status === "completed" &&
        item.mediaType === "image" &&
        item.imageUrl &&
        !(item.metadata as any)?.uncensored
    ) ?? [];
  const videos =
    history.data?.filter(
      item =>
        item.status === "completed" &&
        item.mediaType === "video" &&
        (item.metadata as any)?.tool === "image-animation" &&
        item.imageUrl
    ) ?? [];
  const upload = async (file?: File) => {
    if (!file || !user || uploading.current?.userId === user.id) return;
    if (
      !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(
        file.type
      ) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG, WebP or AVIF image up to 10 MB.");
      return;
    }
    const actorId = user.id;
    const uploadToken = crypto.randomUUID();
    uploading.current = { userId: actorId, token: uploadToken };
    setError("");
    setProgress(0);
    try {
      const asset = await uploadOwnedMedia(file, "animation", fraction => {
        if (
          owner.current === actorId &&
          uploading.current?.token === uploadToken
        )
          setProgress(fraction);
      });
      if (owner.current !== actorId || uploading.current?.token !== uploadToken)
        return;
      const result = await importSource.mutateAsync({ key: asset.key });
      if (owner.current !== actorId || uploading.current?.token !== uploadToken)
        return;
      setSelected({
        userId: actorId,
        id: result.generationId,
        imageUrl: result.imageUrl,
      });
      setOpen(true);
      void history.refetch();
    } catch (failure) {
      if (owner.current === actorId && uploading.current?.token === uploadToken)
        setError(
          failure instanceof Error
            ? failure.message
            : "Image upload failed. Try again."
        );
    } finally {
      if (uploading.current?.token === uploadToken) {
        uploading.current = null;
        if (owner.current === actorId) setProgress(null);
        if (input.current) input.current.value = "";
      }
    }
  };
  return (
    <ToolPageLayout
      title="Image-to-Video"
      description="Create a real five-second animated video from an uploaded image or your generation history."
      icon={Film}
      gradient="from-cyan-500 to-blue-600"
      costCredits={policy.data?.creditCost ?? IMAGE_ANIMATION_POLICY.creditCost}
    >
      {loading ? (
        <p>Loading your account…</p>
      ) : !user ? (
        <Button asChild>
          <a href={getLoginUrl()}>Sign in to animate an image</a>
        </Button>
      ) : (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {policy.data
              ? `${policy.data.creditCost.toLocaleString()} credits per five-second 480p video · Creator or higher. Uploading and selecting images is free.`
              : "Loading the current animation quote…"}
          </p>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            aria-label="Upload animation source"
            onChange={event => {
              void upload(event.target.files?.[0]);
            }}
          />
          <Button
            disabled={progress !== null}
            onClick={() => input.current?.click()}
          >
            {progress !== null ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {progress !== null
              ? `Uploading ${Math.round(progress * 100)}%`
              : "Upload image"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Check unfinished animation
          </Button>
          {progress !== null && (
            <progress
              className="block w-full"
              value={progress}
              max={1}
              aria-label="Image upload progress"
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Choose one of your images</h2>
            <Button
              variant="outline"
              size="sm"
              disabled={history.isFetching}
              onClick={() => void history.refetch()}
            >
              Refresh
            </Button>
          </div>
          {history.isLoading ? (
            <p>Loading your images…</p>
          ) : history.isError ? (
            <p role="alert">
              Your images could not be loaded. Use Refresh to retry.
            </p>
          ) : !images.length ? (
            <p className="text-sm text-muted-foreground">
              Upload an image above or create one in the workspace.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {images.map(image => (
                <button
                  key={image.id}
                  className="overflow-hidden rounded-lg border p-2 text-left hover:border-primary focus-visible:outline focus-visible:outline-2"
                  onClick={() => {
                    setSelected({
                      userId: user.id,
                      id: image.id,
                      imageUrl: image.imageUrl!,
                    });
                    setOpen(true);
                  }}
                >
                  <img
                    src={image.imageUrl!}
                    alt={image.prompt.slice(0, 120)}
                    className="aspect-square w-full rounded object-cover"
                    loading="lazy"
                  />
                  <span className="mt-2 block truncate text-xs">
                    {image.prompt}
                  </span>
                </button>
              ))}
            </div>
          )}
          {videos.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold">Your completed animations</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {videos.map(video => (
                  <div key={video.id} className="rounded-lg border p-3">
                    <video
                      src={video.imageUrl!}
                      controls
                      preload="metadata"
                      aria-label={`Animation ${video.id}`}
                      className="w-full rounded"
                    />
                    <a
                      href={video.imageUrl!}
                      download={`dreamforge-animation-${video.id}.mp4`}
                      className="mt-2 inline-block text-sm underline"
                    >
                      Download video
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <AnimationDialog
        open={
          open && Boolean(user) && (!selected || selected.userId === user?.id)
        }
        onOpenChange={setOpen}
        generationId={
          selected?.userId === user?.id ? (selected?.id ?? null) : null
        }
        sourceUrl={
          selected?.userId === user?.id ? selected?.imageUrl : undefined
        }
        onComplete={() => {
          void history.refetch();
        }}
      />
    </ToolPageLayout>
  );
}
