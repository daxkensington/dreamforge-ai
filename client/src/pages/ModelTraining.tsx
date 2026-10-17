import { useEffect, useRef, useState } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Brain, Download, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { uploadOwnedMedia } from "@/lib/mediaUpload";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getTrainingCredits,
  TRAINING_POLICY,
  TRAINING_STATE_LABELS,
  type TrainingType,
} from "@shared/training";

type ImageItem = {
  id: string;
  name: string;
  key?: string;
  file?: File;
  preview?: string;
  progress: number;
  error?: string;
};
const RUNNING = ["submitting", "queued", "training", "cancel_requested"];
export default function ModelTraining() {
  const { user, isAuthenticated, loading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const utils = trpc.useUtils();
  const policy = trpc.training.policy.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const list = trpc.training.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const create = trpc.training.create.useMutation(),
    prepare = trpc.training.prepare.useMutation(),
    submit = trpc.training.submit.useMutation();
  const cancel = trpc.training.cancel.useMutation(),
    remove = trpc.training.delete.useMutation(),
    download = trpc.training.download.useMutation();
  const [name, setName] = useState(""),
    [type, setType] = useState<TrainingType>("face"),
    [triggerWord, setTriggerWord] = useState(""),
    [steps, setSteps] = useState<800 | 1200>(800);
  const [images, setImages] = useState<ImageItem[]>([]),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [activeId, setActiveId] = useState<number>();
  const [draftOwner, setDraftOwner] = useState<string | null>(null),
    requestId = useRef<string | null>(null),
    previews = useRef<string[]>([]),
    polling = useRef(false);
  const quote = getTrainingCredits(steps),
    eligible = policy.data?.eligible === true,
    available = policy.data?.providerAvailable === true;
  const storageId = user ? `dreamforge-training-draft:${user.id}` : null;
  useEffect(() => {
    return () => previews.current.forEach(url => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (!storageId) return;
    previews.current.forEach(url => URL.revokeObjectURL(url));
    previews.current = [];
    setName("");
    setTriggerWord("");
    setImages([]);
    setConsent(false);
    requestId.current = null;
    try {
      const raw = localStorage.getItem(storageId);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.expiresAt > Date.now() && Array.isArray(saved.images)) {
          setName(saved.name || "");
          setTriggerWord(saved.triggerWord || "");
          setType(
            ["face", "style", "product", "object"].includes(saved.type)
              ? saved.type
              : "face"
          );
          setSteps(saved.steps === 1200 ? 1200 : 800);
          setImages(
            saved.images
              .filter((item: any) => typeof item.key === "string")
              .slice(0, 20)
              .map((item: any) => ({
                id: crypto.randomUUID(),
                name: String(item.name),
                key: item.key,
                progress: 1,
              }))
          );
          requestId.current = saved.requestId || null;
        }
      }
    } catch {
      /* A malformed local draft cannot affect saved jobs. */
    }
    setDraftOwner(storageId);
  }, [storageId]);
  useEffect(() => {
    if (!storageId || draftOwner !== storageId) return;
    try {
      localStorage.setItem(
        storageId,
        JSON.stringify({
          name,
          type,
          triggerWord,
          steps,
          requestId: requestId.current,
          expiresAt: Date.now() + 24 * 3600_000,
          images: images
            .filter(i => i.key)
            .map(({ key, name }) => ({ key, name })),
        })
      );
    } catch {
      /* Local persistence is optional; saved jobs remain in the account library. */
    }
  }, [storageId, draftOwner, name, type, triggerWord, steps, images]);
  useEffect(() => {
    const ids = (list.data ?? [])
      .filter(job => RUNNING.includes(job.state))
      .map(job => job.id);
    if (!ids.length) return;
    const timer = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        await Promise.allSettled(
          ids.map(id => utils.client.training.refresh.mutate({ id }))
        );
        await utils.training.list.invalidate();
      } finally {
        polling.current = false;
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [list.data, utils]);
  function changeDraft() {
    requestId.current = null;
    setError("");
  }
  async function upload(item: ImageItem) {
    if (!item.file || item.key) return;
    setImages(items =>
      items.map(i => (i.id === item.id ? { ...i, error: undefined } : i))
    );
    try {
      const result = await uploadOwnedMedia(item.file, "training", progress =>
        setImages(items =>
          items.map(i => (i.id === item.id ? { ...i, progress } : i))
        )
      );
      setImages(items =>
        items.map(i =>
          i.id === item.id ? { ...i, key: result.key, progress: 1 } : i
        )
      );
      return result.key;
    } catch (e) {
      setImages(items =>
        items.map(i =>
          i.id === item.id
            ? { ...i, error: e instanceof Error ? e.message : "Upload failed." }
            : i
        )
      );
      throw e;
    }
  }
  async function prepareDataset() {
    setBusy(true);
    setError("");
    try {
      const keys: string[] = [];
      for (const item of images) {
        const key = item.key ?? (await upload(item));
        if (!key) throw new Error("Upload each image first.");
        keys.push(key);
      }
      requestId.current ??= crypto.randomUUID();
      const job = await create.mutateAsync({
        requestId: requestId.current,
        name,
        type,
        triggerWord,
        steps,
        imageKeys: keys,
      });
      await prepare.mutateAsync({ id: job.id });
      previews.current.forEach(url => URL.revokeObjectURL(url));
      previews.current = [];
      setImages([]);
      setName("");
      setTriggerWord("");
      setConsent(false);
      requestId.current = null;
      if (storageId) {
        try {
          localStorage.removeItem(storageId);
        } catch {
          /* Private mode may disable storage. */
        }
      }
      await utils.training.list.invalidate();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not prepare this dataset."
      );
      await utils.training.list.invalidate();
    } finally {
      setBusy(false);
    }
  }
  async function action(id: number, run: () => Promise<unknown>) {
    setActiveId(id);
    setError("");
    try {
      await run();
      await utils.training.list.invalidate();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed."
      );
    } finally {
      setActiveId(undefined);
    }
  }
  async function discardImage(item: ImageItem) {
    setBusy(true);
    setError("");
    try {
      if (item.key)
        await utils.client.training.discardImages.mutate({
          imageKeys: [item.key],
        });
      if (item.preview) {
        URL.revokeObjectURL(item.preview);
        previews.current = previews.current.filter(url => url !== item.preview);
      }
      setImages(items => items.filter(i => i.id !== item.id));
      changeDraft();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not remove this upload."
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <PageLayout>
        <div className="container py-12" role="status">
          Loading training library…
        </div>
      </PageLayout>
    );
  return (
    <PageLayout>
      <div className="container max-w-5xl py-10 space-y-7">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-violet-400" />
            Train your own model
          </h1>
          <p className="mt-3 text-muted-foreground">
            Teach a custom model a person, product, object or visual style, then
            create images with it in Workspace.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded border border-red-500/40 bg-red-500/10 p-4"
          >
            {error}
          </p>
        )}
        {(policy.error || list.error) && (
          <p role="alert">
            Training could not load.{" "}
            <Button
              variant="outline"
              onClick={() => {
                void policy.refetch();
                void list.refetch();
              }}
            >
              Try again
            </Button>
          </p>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Prepare a training dataset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Agency includes {TRAINING_POLICY.savedSlots} saved model slots.
              Training costs {TRAINING_POLICY.standardCredits.toLocaleString()}{" "}
              credits for 800 steps or{" "}
              {TRAINING_POLICY.detailedCredits.toLocaleString()} for 1,200
              steps. Preparing images is free. Each custom image costs 210–420
              credits depending on its size.
            </p>
            {!eligible && policy.data && (
              <p className="text-amber-300">
                An active Agency plan is required to train or generate with
                custom models. You can still download models you already
                trained.{" "}
                <Link href="/pricing" className="underline">
                  View plans
                </Link>
              </p>
            )}
            {!available && policy.data && (
              <p className="text-amber-300">
                Custom training is temporarily unavailable. Your saved models
                remain here.
              </p>
            )}
            <fieldset
              disabled={busy || !eligible || !available}
              className="space-y-5 disabled:opacity-60"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="space-y-2">
                  Model name
                  <Input
                    value={name}
                    maxLength={128}
                    onChange={e => {
                      setName(e.target.value);
                      changeDraft();
                    }}
                    placeholder="My product"
                  />
                </label>
                <label className="space-y-2">
                  Subject
                  <select
                    className="w-full rounded border bg-background p-2"
                    value={type}
                    onChange={e => {
                      setType(e.target.value as TrainingType);
                      changeDraft();
                    }}
                  >
                    {["face", "product", "object", "style"].map(value => (
                      <option key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  Trigger word
                  <Input
                    value={triggerWord}
                    maxLength={32}
                    onChange={e => {
                      setTriggerWord(e.target.value);
                      changeDraft();
                    }}
                    placeholder="myproduct_xyz"
                  />
                  <span className="text-xs text-muted-foreground">
                    3–32 letters, numbers or underscores; start with a letter.
                    Use this word in prompts.
                  </span>
                </label>
                <label className="space-y-2">
                  Training depth
                  <select
                    className="w-full rounded border bg-background p-2"
                    value={steps}
                    onChange={e => {
                      setSteps(Number(e.target.value) as 800 | 1200);
                      changeDraft();
                    }}
                  >
                    <option value={800}>800 steps · 10,000 credits</option>
                    <option value={1200}>1,200 steps · 15,000 credits</option>
                  </select>
                </label>
              </div>
              <label className="block rounded-lg border border-dashed p-5 cursor-pointer">
                <span className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5" />
                  Choose 5–20 different photos
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  JPEG, PNG or WebP, up to 10 MB each. Clear, varied photos work
                  best. Images stay private. Prepare and start within 24 hours
                  of uploading.
                </span>
                <input
                  className="mt-3 w-full"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={e => {
                    const chosen = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    changeDraft();
                    if (images.length + chosen.length > 20) {
                      setError("Choose at most 20 photos.");
                      return;
                    }
                    if (
                      chosen.some(
                        file =>
                          !["image/jpeg", "image/png", "image/webp"].includes(
                            file.type
                          ) || file.size > TRAINING_POLICY.uploadMaxBytes
                      )
                    ) {
                      setError("Use JPEG, PNG or WebP files under 10 MB.");
                      return;
                    }
                    setImages(items => [
                      ...items,
                      ...chosen.map(file => {
                        const preview = URL.createObjectURL(file);
                        previews.current.push(preview);
                        return {
                          id: crypto.randomUUID(),
                          name: file.name,
                          file,
                          preview,
                          progress: 0,
                        };
                      }),
                    ]);
                  }}
                />
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map(item => (
                  <div
                    key={item.id}
                    className="rounded border p-2 text-sm space-y-2"
                  >
                    {item.preview && (
                      <img
                        src={item.preview}
                        alt={item.name}
                        className="h-24 w-full object-cover rounded"
                      />
                    )}
                    <p className="truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p aria-live="polite">
                      {item.key
                        ? "Uploaded"
                        : item.progress > 0
                          ? `Uploading ${Math.round(item.progress * 100)}%`
                          : "Ready to upload"}
                    </p>
                    {item.error && <p className="text-red-400">{item.error}</p>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void discardImage(item)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-1"
                />
                I have permission to train on these images, including consent
                from anyone shown. I understand that starting training costs{" "}
                {quote.toLocaleString()} credits.
              </label>
              <Button
                disabled={
                  !consent ||
                  images.length < 5 ||
                  !name.trim() ||
                  !/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(triggerWord) ||
                  busy
                }
                onClick={() => void prepareDataset()}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? "Uploading and preparing…" : "Prepare images — free"}
              </Button>
            </fieldset>
          </CardContent>
        </Card>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Your training library</h2>
          <Button variant="outline" onClick={() => void list.refetch()}>
            Refresh library
          </Button>
        </div>
        {list.isLoading && <p role="status">Loading saved jobs…</p>}
        {list.data?.length === 0 && (
          <p className="text-muted-foreground">
            Your prepared datasets and trained models will appear here. Jobs
            stay here if you close this page.
          </p>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {list.data?.map(job => (
            <Card key={job.id}>
              <CardHeader>
                <CardTitle className="text-lg">{job.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p role="status" className="font-medium">
                  {TRAINING_STATE_LABELS[job.state] ?? job.state}
                  {job.state === "queued" && job.queuePosition !== null
                    ? ` · position ${job.queuePosition}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {job.imageCount} photos · {job.steps.toLocaleString()} steps ·{" "}
                  {job.quotedCredits.toLocaleString()} credits{" "}
                  {job.refunded
                    ? "returned"
                    : job.charged
                      ? "charged"
                      : "on start"}
                </p>
                <p className="text-sm">
                  Trigger word: <code>{job.triggerWord}</code>
                </p>
                {job.state === "reconciliation" && (
                  <p className="text-sm text-amber-300">
                    We could not confirm the outcome. Your request will not run
                    again automatically. Credits are held for review. Contact
                    support with job #{job.id}.
                  </p>
                )}
                {job.state === "cancel_requested" && (
                  <p className="text-sm text-muted-foreground">
                    Cancellation is requested. Work that already started may
                    finish; credits return only after a confirmed failure.
                  </p>
                )}
                {job.errorCode === "status_or_download_retry" && (
                  <p className="text-sm text-amber-300">
                    Status or model download could not be confirmed. Refresh to
                    retry safely; this does not restart training.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {["draft", "preparing"].includes(job.state) && (
                    <Button
                      disabled={!eligible || activeId === job.id}
                      onClick={() =>
                        void action(job.id, () =>
                          prepare.mutateAsync({ id: job.id })
                        )
                      }
                    >
                      Prepare / resume
                    </Button>
                  )}
                  {job.state === "ready_to_submit" && (
                    <Button
                      disabled={!eligible || !available || activeId === job.id}
                      onClick={() =>
                        void action(job.id, () =>
                          submit.mutateAsync({
                            id: job.id,
                            quotedCredits: job.quotedCredits,
                          })
                        )
                      }
                    >
                      Train for {job.quotedCredits.toLocaleString()} credits
                    </Button>
                  )}
                  {RUNNING.includes(job.state) && (
                    <Button
                      variant="outline"
                      disabled={activeId === job.id}
                      onClick={() =>
                        void action(job.id, () =>
                          utils.client.training.refresh.mutate({ id: job.id })
                        )
                      }
                    >
                      Check status
                    </Button>
                  )}
                  {[
                    "draft",
                    "preparing",
                    "ready_to_submit",
                    ...RUNNING,
                  ].includes(job.state) &&
                    job.state !== "cancel_requested" && (
                      <Button
                        variant="outline"
                        disabled={activeId === job.id}
                        onClick={() =>
                          void action(job.id, () =>
                            cancel.mutateAsync({ id: job.id })
                          )
                        }
                      >
                        Cancel
                      </Button>
                    )}
                  {job.canDownload && (
                    <>
                      {eligible ? (
                        <Button asChild>
                          <Link href={`/workspace?trainedModelId=${job.id}`}>
                            Use in Workspace
                          </Link>
                        </Button>
                      ) : (
                        <Button disabled>Agency required to use</Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={activeId === job.id}
                        onClick={() =>
                          void action(job.id, async () => {
                            const file = await download.mutateAsync({
                              id: job.id,
                            });
                            const a = document.createElement("a");
                            a.href = file.url;
                            a.download = file.filename;
                            a.rel = "noopener";
                            a.click();
                          })
                        }
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </>
                  )}
                  {![
                    "submitting",
                    "queued",
                    "training",
                    "cancel_requested",
                    "reconciliation",
                  ].includes(job.state) && (
                    <Button
                      variant="outline"
                      disabled={activeId === job.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${job.name} and its dataset? Images used by another saved training job will remain.`
                          )
                        )
                          void action(job.id, () =>
                            remove.mutateAsync({ id: job.id })
                          );
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
