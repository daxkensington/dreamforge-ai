import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Image as ImageIcon,
  Loader2,
  Presentation,
  Sparkles,
  Upload,
} from "lucide-react";
import { getEffectiveSubscriptionTier } from "@shared/subscriptionEntitlement";
import {
  getWorkspaceImageSelectionError,
  hasWorkspaceModelAccess,
} from "@shared/workspaceModelSelection";
import { getTierConfig } from "@shared/tiers";
import {
  emptyPresentationSession,
  generatedPresentation,
  isUnresolvedPresentationJob,
  parsePresentationSession,
  PRESENTATION_DRAFT_CREDITS,
  preparePresentationImageJob,
  presentationFilename,
  presentationRequestErrorState,
  savedPresentation,
  settlePresentationImageJob,
  type PresentationSession,
  type PresentationSlide,
} from "@shared/presentation";

const STYLES = [
  "modern",
  "corporate",
  "creative",
  "dark",
  "startup",
  "education",
] as const;
const storageKey = (id: number) => "dreamforgex:presentation:" + id;
function downloadJson(value: unknown, title: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = presentationFilename(title, "json");
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function newSlide(title = "New slide"): PresentationSlide {
  return {
    id: crypto.randomUUID(),
    title,
    content: "Add your content here.",
    notes: "",
    imagePrompt: "",
  };
}

export default function PresentationBuilder() {
  const { user, loading } = useAuth();
  const [session, setSession] = useState<PresentationSession>(() =>
    emptyPresentationSession(0)
  );
  const sessionRef = useRef(session);
  const [ready, setReady] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState("");
  const [modelId, setModelId] = useState("built-in-v1");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [exportProgress, setExportProgress] = useState("");
  const [exporting, setExporting] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<Record<string, boolean>>({});
  const draftLock = useRef(false);
  const imageLocks = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const imageModels = trpc.generation.imageModels.useQuery(undefined, {
    enabled: !!user,
    retry: 1,
  });
  const subscription = trpc.pricing.getCurrentSubscription.useQuery(undefined, {
    enabled: !!user,
    retry: 1,
  });
  const draftMutation = trpc.presentation.draft.useMutation();
  const imageMutation = trpc.generation.create.useMutation();
  const tier = getEffectiveSubscriptionTier({
    planName: subscription.data?.plan?.name,
    status: subscription.data?.subscription?.status,
    currentPeriodStart: subscription.data?.subscription?.currentPeriodStart,
    currentPeriodEnd: subscription.data?.subscription?.currentPeriodEnd,
  });
  const planReady = subscription.isSuccess && !subscription.isFetching;
  const selectedModel = imageModels.data?.find(model => model.id === modelId);
  const catalogReady = imageModels.isSuccess && !imageModels.isFetching;
  const selectionError = !catalogReady
    ? "Load current image model prices first."
    : getWorkspaceImageSelectionError({
        modelId,
        catalog: imageModels.data,
        catalogReady,
        userTier: tier,
        planReady,
        width: 768,
        height: 432,
      });
  const hasPending =
    isUnresolvedPresentationJob(session.draftJob) ||
    Object.values(session.jobs).some(isUnresolvedPresentationJob);
  const activeSlide = session.deck?.slides[currentSlide];
  const activeJob = activeSlide ? session.jobs[activeSlide.id] : undefined;
  const accountReady = ready && session.userId === (user?.id ?? 0);

  useEffect(() => {
    if (loading) return;
    const id = user?.id ?? 0;
    let value = emptyPresentationSession(id);
    try {
      const raw = window.sessionStorage.getItem(storageKey(id));
      if (raw) value = parsePresentationSession(raw, id);
    } catch {
      setStorageError(
        "A saved draft could not be restored. Download JSON backups while editing."
      );
    }
    sessionRef.current = value;
    setSession(value);
    setCurrentSlide(0);
    setReady(true);
    setNotice("");
  }, [user?.id, loading]);

  const update = (
    change: (value: PresentationSession) => PresentationSession,
    requireStorage = false
  ) => {
    const next = change(sessionRef.current);
    try {
      window.sessionStorage.setItem(
        storageKey(next.userId),
        JSON.stringify(next)
      );
      setStorageError("");
    } catch {
      setStorageError(
        "Tab storage is unavailable. Download an editable JSON backup before leaving."
      );
      if (requireStorage)
        throw new Error(
          "Allow browser tab storage before paid generation so retries can retain the original request ID. No request was submitted."
        );
    }
    sessionRef.current = next;
    setSession(next);
    return next;
  };
  const edit = (
    key: "title" | "content" | "notes" | "imagePrompt",
    value: string
  ) => {
    if (!activeSlide) return;
    update(state => ({
      ...state,
      deck: state.deck && {
        ...state.deck,
        slides: state.deck.slides.map(slide =>
          slide.id === activeSlide.id ? { ...slide, [key]: value } : slide
        ),
      },
    }));
  };
  const handleDraft = async () => {
    if (!user || !accountReady || draftLock.current) return;
    draftLock.current = true;
    setDraftBusy(true);
    setNotice("");
    const account = user.id;
    try {
      const old = sessionRef.current.draftJob;
      const input =
        old && isUnresolvedPresentationJob(old)
          ? old.input
          : {
              requestId: crypto.randomUUID(),
              topic: sessionRef.current.topic.trim(),
              slideCount: sessionRef.current.slideCount,
              style: sessionRef.current.style,
              audience: sessionRef.current.audience.trim(),
            };
      update(
        state => ({ ...state, draftJob: { input, state: "pending" } }),
        true
      );
      const response = await draftMutation.mutateAsync(input);
      if (sessionRef.current.userId !== account) return;
      if (response.status === "completed" && response.result) {
        const deck = generatedPresentation.parse(response.result);
        update(state => ({
          ...state,
          deck: {
            version: 1,
            title: deck.title,
            slides: deck.slides.map(slide => ({
              ...slide,
              id: crypto.randomUUID(),
            })),
          },
          jobs: {},
          draftJob: { input, state: "completed" },
        }));
        setCurrentSlide(0);
        setNotice(
          "Presentation draft generated. Review and edit all claims before presenting."
        );
      } else {
        update(state => ({
          ...state,
          draftJob: {
            input,
            state: response.status === "failed" ? "failed" : "uncertain",
            error:
              response.error ??
              "Still processing. Retry checks the same paid request.",
          },
        }));
      }
    } catch (error) {
      if (sessionRef.current.userId === account) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not confirm generation.";
        update(state => ({
          ...state,
          draftJob:
            state.draftJob && isUnresolvedPresentationJob(state.draftJob)
              ? {
                  ...state.draftJob,
                  state: presentationRequestErrorState(error),
                  error: message,
                }
              : state.draftJob,
        }));
        setNotice(message);
      }
    } finally {
      draftLock.current = false;
      setDraftBusy(false);
    }
  };
  const handleImage = async (slide: PresentationSlide) => {
    if (!user || !accountReady || imageLocks.current.has(slide.id)) return;
    imageLocks.current.add(slide.id);
    setImageBusy(value => ({ ...value, [slide.id]: true }));
    setNotice("");
    const account = user.id;
    try {
      const previous = sessionRef.current.jobs[slide.id];
      if (
        !isUnresolvedPresentationJob(previous) &&
        (selectionError || !selectedModel)
      )
        throw new Error(selectionError ?? "Choose an image model.");
      const job = preparePresentationImageJob(previous, {
        userId: account,
        prompt: slide.imagePrompt,
        modelId,
        creditCost: selectedModel?.creditCost ?? 0,
      });
      update(
        state => ({
          ...state,
          jobs: { ...state.jobs, [slide.id]: { ...job, state: "pending" } },
        }),
        true
      );
      const result = await imageMutation.mutateAsync({
        ...job.input,
        requestId: job.requestId,
        expectedCreditCost: job.creditCost,
      });
      if (sessionRef.current.userId !== account) return;
      const settled = settlePresentationImageJob(job, result);
      update(state => ({
        ...state,
        jobs: { ...state.jobs, [slide.id]: settled },
        deck: state.deck && {
          ...state.deck,
          slides: state.deck.slides.map(value =>
            value.id === slide.id &&
            result.status === "completed" &&
            result.mediaType === "image"
              ? { ...value, imageUrl: result.imageUrl }
              : value
          ),
        },
      }));
    } catch (error) {
      if (sessionRef.current.userId === account) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not confirm image generation.";
        update(state => ({
          ...state,
          jobs:
            state.jobs[slide.id] &&
            isUnresolvedPresentationJob(state.jobs[slide.id])
              ? {
                  ...state.jobs,
                  [slide.id]: {
                    ...state.jobs[slide.id],
                    state: presentationRequestErrorState(error),
                    error: message,
                  },
                }
              : state.jobs,
        }));
        setNotice(message);
      }
    } finally {
      imageLocks.current.delete(slide.id);
      setImageBusy(value => ({ ...value, [slide.id]: false }));
    }
  };
  const handleExport = async () => {
    if (!session.deck || exporting) return;
    setExporting(true);
    setExportProgress("Preparing images and text…");
    setNotice("");
    try {
      const { createPresentationPdf } = await import("@/lib/presentationPdf");
      const pdf = await createPresentationPdf({
        ...session.deck,
        includeNotes,
        onProgress: (done, total) =>
          setExportProgress("Exporting page " + done + " of " + total),
      });
      pdf.save(presentationFilename(session.deck.title, "pdf"));
      setNotice(
        "PDF exported with all slide content" +
          (includeNotes ? " and speaker notes." : ".")
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "PDF export failed. Your editable draft is retained."
      );
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };
  const importJson = async (file?: File) => {
    if (!file || hasPending) return;
    try {
      if (file.size > 3 * 1024 * 1024)
        throw new Error("Choose a JSON draft smaller than 3 MB.");
      const deck = savedPresentation.parse(JSON.parse(await file.text()));
      update(state => ({ ...state, deck, jobs: {}, draftJob: undefined }));
      setCurrentSlide(0);
      setNotice("Editable draft imported.");
    } catch {
      setNotice(
        "That file is not a valid editable presentation JSON draft (maximum 3 MB)."
      );
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <PageLayout>
      <div className="container max-w-7xl py-8 space-y-6">
        <header className="space-y-2">
          <Presentation className="h-7 w-7 text-cyan-400" aria-hidden="true" />
          <h1 className="text-3xl font-bold">Presentation Builder</h1>
          <p className="text-muted-foreground">
            Generate a structured deck, edit every slide and speaker note, add
            images, and export a complete PDF.
          </p>
          <p className="text-xs text-muted-foreground">
            Drafts are saved in this browser tab for this account. Download
            editable JSON for a durable backup. PDF text is rendered as images
            to preserve multilingual fonts and is not selectable.
          </p>
        </header>
        {notice && (
          <p
            role="status"
            className="rounded-lg border p-3 text-sm whitespace-pre-wrap"
          >
            {notice}
          </p>
        )}
        {storageError && (
          <p role="alert" className="text-sm text-amber-400">
            {storageError}
          </p>
        )}
        {!accountReady ? (
          <p role="status">Loading your presentation draft…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={hasPending || exporting}
                onClick={() => {
                  update(state => ({
                    ...state,
                    deck: {
                      version: 1,
                      title: "Untitled presentation",
                      slides: [newSlide("Your presentation")],
                    },
                    jobs: {},
                    draftJob: undefined,
                  }));
                  setCurrentSlide(0);
                }}
              >
                Start blank (free)
              </Button>
              <Button
                variant="outline"
                disabled={hasPending || exporting}
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Import JSON
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Import presentation JSON"
                onChange={event => void importJson(event.target.files?.[0])}
              />
              {session.deck && (
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadJson(session.deck, session.deck!.title)
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download editable JSON
                </Button>
              )}
            </div>
            {hasPending && (
              <p role="status" className="text-sm text-amber-400">
                An unresolved paid request is saved in this tab. Retry that same
                request to check its result. Replacing or importing a deck is
                disabled until it finishes.
              </p>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Generate a presentation draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="block text-sm" htmlFor="presentation-topic">
                  Topic
                </label>
                <Textarea
                  id="presentation-topic"
                  maxLength={2000}
                  value={session.topic}
                  disabled={hasPending || draftBusy}
                  onChange={event =>
                    update(state => ({ ...state, topic: event.target.value }))
                  }
                  placeholder="Explain your topic and the goal of the presentation"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="presentation-count"
                      className="block text-sm mb-2"
                    >
                      Slides
                    </label>
                    <Select
                      value={String(session.slideCount)}
                      disabled={hasPending || draftBusy}
                      onValueChange={value =>
                        update(state => ({
                          ...state,
                          slideCount: Number(value),
                        }))
                      }
                    >
                      <SelectTrigger id="presentation-count">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 5, 8, 10, 12, 15, 20].map(n => (
                          <SelectItem key={n} value={String(n)}>
                            {n} slides
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="presentation-style"
                      className="block text-sm mb-2"
                    >
                      Style
                    </label>
                    <Select
                      value={session.style}
                      disabled={hasPending || draftBusy}
                      onValueChange={value =>
                        update(state => ({
                          ...state,
                          style: value as PresentationSession["style"],
                        }))
                      }
                    >
                      <SelectTrigger id="presentation-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLES.map(value => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="presentation-audience"
                      className="block text-sm mb-2"
                    >
                      Audience (optional)
                    </label>
                    <Input
                      id="presentation-audience"
                      maxLength={300}
                      disabled={hasPending || draftBusy}
                      value={session.audience}
                      onChange={event =>
                        update(state => ({
                          ...state,
                          audience: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <p className="text-sm">
                  {PRESENTATION_DRAFT_CREDITS} credits for one text draft.
                  Images are optional and charged separately at the selected
                  model price. Generating a new draft replaces the current deck.
                </p>
                {session.draftJob?.error && (
                  <p role="alert" className="text-sm text-amber-400">
                    {session.draftJob.error}
                  </p>
                )}
                {user ? (
                  <Button
                    onClick={() => void handleDraft()}
                    disabled={
                      draftBusy ||
                      Object.values(session.jobs).some(
                        isUnresolvedPresentationJob
                      ) ||
                      (!isUnresolvedPresentationJob(session.draftJob) &&
                        session.topic.trim().length < 3)
                    }
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {draftBusy
                      ? "Checking request…"
                      : isUnresolvedPresentationJob(session.draftJob)
                        ? "Retry same draft request"
                        : "Generate draft / " +
                          PRESENTATION_DRAFT_CREDITS +
                          " credits"}
                  </Button>
                ) : (
                  <a className="underline text-cyan-400" href={getLoginUrl()}>
                    Sign in to generate a draft or image
                  </a>
                )}
              </CardContent>
            </Card>
            {session.deck && activeSlide && (
              <section className="space-y-4" aria-label="Presentation editor">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="deck-title" className="text-sm block mb-2">
                      Presentation name
                    </label>
                    <Input
                      id="deck-title"
                      maxLength={240}
                      value={session.deck.title}
                      onChange={event =>
                        update(state => ({
                          ...state,
                          deck: state.deck && {
                            ...state.deck,
                            title: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm py-2">
                    <input
                      type="checkbox"
                      checked={includeNotes}
                      disabled={exporting}
                      onChange={event => setIncludeNotes(event.target.checked)}
                    />
                    Include speaker notes
                  </label>
                  <Button
                    onClick={() => void handleExport()}
                    disabled={exporting}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exporting ? "Exporting…" : "Export PDF (free)"}
                  </Button>
                </div>
                {exportProgress && <p role="status">{exportProgress}</p>}
                <nav
                  aria-label="Slides"
                  className="flex gap-2 overflow-x-auto pb-2"
                >
                  {session.deck.slides.map((slide, index) => (
                    <Button
                      key={slide.id}
                      variant={index === currentSlide ? "default" : "outline"}
                      className="shrink-0 max-w-52"
                      aria-current={index === currentSlide ? "step" : undefined}
                      onClick={() => setCurrentSlide(index)}
                    >
                      <span className="truncate">
                        {index + 1}. {slide.title || "Untitled slide"}
                      </span>
                    </Button>
                  ))}
                </nav>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0 space-y-4">
                    <div className="rounded-xl bg-slate-900 border p-6 md:p-10 min-h-80 break-words">
                      <p className="text-cyan-400 text-xs mb-4">
                        Slide {currentSlide + 1} of {session.deck.slides.length}
                      </p>
                      <h2 className="text-2xl md:text-3xl font-bold mb-5 whitespace-pre-wrap">
                        {activeSlide.title}
                      </h2>
                      {activeSlide.imageUrl && (
                        <img
                          src={activeSlide.imageUrl}
                          alt={
                            activeSlide.imagePrompt ||
                            "Illustration for " + activeSlide.title
                          }
                          className="w-full max-h-72 object-contain rounded-lg mb-5"
                        />
                      )}
                      <div className="text-base whitespace-pre-wrap leading-relaxed">
                        {activeSlide.content}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-between">
                      <Button
                        variant="outline"
                        disabled={currentSlide === 0}
                        onClick={() => setCurrentSlide(index => index - 1)}
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        disabled={
                          currentSlide >= session.deck.slides.length - 1
                        }
                        onClick={() => setCurrentSlide(index => index + 1)}
                      >
                        Next
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={
                          session.deck.slides.length >= 30 || hasPending
                        }
                        onClick={() => {
                          const index = session.deck!.slides.length;
                          update(state => ({
                            ...state,
                            deck: state.deck && {
                              ...state.deck,
                              slides: [...state.deck.slides, newSlide()],
                            },
                          }));
                          setCurrentSlide(index);
                        }}
                      >
                        Add slide
                      </Button>
                      <Button
                        variant="outline"
                        disabled={session.deck.slides.length <= 1 || hasPending}
                        onClick={() => {
                          update(state => ({
                            ...state,
                            deck: state.deck && {
                              ...state.deck,
                              slides: state.deck.slides.filter(
                                slide => slide.id !== activeSlide.id
                              ),
                            },
                          }));
                          setCurrentSlide(index => Math.max(0, index - 1));
                        }}
                      >
                        Delete current slide
                      </Button>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Edit slide {currentSlide + 1}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <label htmlFor="slide-title" className="block text-sm">
                          Title
                        </label>
                        <Textarea
                          id="slide-title"
                          rows={2}
                          maxLength={4000}
                          value={activeSlide.title}
                          onChange={event => edit("title", event.target.value)}
                        />
                        <label
                          htmlFor="slide-content"
                          className="block text-sm"
                        >
                          Content (one point per line)
                        </label>
                        <Textarea
                          id="slide-content"
                          rows={7}
                          maxLength={20000}
                          value={activeSlide.content}
                          onChange={event =>
                            edit("content", event.target.value)
                          }
                        />
                        <label htmlFor="slide-notes" className="block text-sm">
                          Speaker notes
                        </label>
                        <Textarea
                          id="slide-notes"
                          rows={6}
                          maxLength={20000}
                          value={activeSlide.notes}
                          onChange={event => edit("notes", event.target.value)}
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Slide image
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <label
                          htmlFor="slide-image-prompt"
                          className="block text-sm"
                        >
                          Image prompt
                        </label>
                        <Textarea
                          id="slide-image-prompt"
                          rows={4}
                          maxLength={1500}
                          value={activeSlide.imagePrompt}
                          disabled={isUnresolvedPresentationJob(activeJob)}
                          onChange={event =>
                            edit("imagePrompt", event.target.value)
                          }
                        />
                        {user && (
                          <>
                            <label
                              htmlFor="slide-image-model"
                              className="block text-sm"
                            >
                              Image model and exact quote
                            </label>
                            <Select
                              value={modelId}
                              disabled={isUnresolvedPresentationJob(activeJob)}
                              onValueChange={setModelId}
                            >
                              <SelectTrigger id="slide-image-model">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {imageModels.data?.map(model => (
                                  <SelectItem
                                    key={model.id}
                                    value={model.id}
                                    disabled={
                                      !model.isConfigured ||
                                      !hasWorkspaceModelAccess(
                                        tier,
                                        model.requiredTier
                                      )
                                    }
                                  >
                                    {model.name} / {model.creditCost} credits /{" "}
                                    {
                                      getTierConfig(model.requiredTier)
                                        .displayName
                                    }
                                    {model.isConfigured ? "" : " / unavailable"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              768 × 432 image settings. Output dimensions can
                              vary by model.
                            </p>
                            {selectionError &&
                              !isUnresolvedPresentationJob(activeJob) && (
                                <p className="text-sm text-amber-400">
                                  {selectionError}
                                </p>
                              )}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={imageModels.isFetching}
                              onClick={() => void imageModels.refetch()}
                            >
                              Refresh image models
                            </Button>
                          </>
                        )}
                        {activeJob && (
                          <p
                            role={activeJob.error ? "alert" : "status"}
                            className="text-xs break-words"
                          >
                            {activeJob.error ||
                              (activeJob.state === "completed"
                                ? "Image completed."
                                : "Image request saved.")}{" "}
                            {isUnresolvedPresentationJob(activeJob) && (
                              <span>
                                Original quote: {activeJob.creditCost} credits.
                                Request: {activeJob.requestId}
                              </span>
                            )}
                          </p>
                        )}
                        <Button
                          className="w-full"
                          disabled={
                            !user ||
                            !!imageBusy[activeSlide.id] ||
                            (!!session.draftJob &&
                              isUnresolvedPresentationJob(session.draftJob)) ||
                            (!isUnresolvedPresentationJob(activeJob) &&
                              (!activeSlide.imagePrompt.trim() ||
                                !!selectionError))
                          }
                          onClick={() => void handleImage(activeSlide)}
                        >
                          {imageBusy[activeSlide.id] ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          {isUnresolvedPresentationJob(activeJob)
                            ? "Retry same image request"
                            : (activeSlide.imageUrl
                                ? "Generate new image / "
                                : "Generate image / ") +
                              (selectedModel?.creditCost ?? "—") +
                              " credits"}
                        </Button>
                        {activeSlide.imageUrl && (
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={isUnresolvedPresentationJob(activeJob)}
                            onClick={() =>
                              update(state => ({
                                ...state,
                                deck: state.deck && {
                                  ...state.deck,
                                  slides: state.deck.slides.map(slide =>
                                    slide.id === activeSlide.id
                                      ? { ...slide, imageUrl: undefined }
                                      : slide
                                  ),
                                },
                              }))
                            }
                          >
                            Remove image from slide
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
