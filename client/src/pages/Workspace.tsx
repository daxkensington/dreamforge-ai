import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles,
  Wand2,
  Image,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Clock,
  ExternalLink,
  Video,
  Film,
  Settings2,
  Zap,
  RotateCcw,
  Timer,
  Cpu,
  Maximize,
  Play,
  ArrowRight,
  Clapperboard,
  Link2,
  Flame,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { getTrainingImageCredits } from "@shared/training";
import { motion, AnimatePresence } from "framer-motion";
import { StylePresets } from "@/components/StylePresets";
import { ShareButton } from "@/components/ShareButton";
import { AnimationDialog } from "@/components/AnimationDialog";
import { buildAdultRedirectUrl, isAdultRedirect } from "@shared/adultRouting";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { getTierConfig } from "@shared/tiers";
import { getSubscriptionEntitlement } from "@shared/subscriptionEntitlement";
import {
  initialWorkspaceVideoModel,
  workspaceVideoSelectionError,
} from "@shared/workspaceVideoSelection";
import {
  getWorkspaceImageSelectionError,
  hasWorkspaceModelAccess,
  WORKSPACE_AUTO_IMAGE_MODEL,
  fingerprintGenerationInput,
  isGenerationRequestRetry,
  isTerminalGenerationResult,
  resolveGenerationRequestIdentity,
  readGenerationRequestIdentity,
  persistGenerationRequestIdentity,
  clearGenerationRequestIdentity,
  type GenerationRequestIdentity,
} from "@shared/workspaceModelSelection";
import { isCurrentOperation, isUnclaimedOperationError } from "@shared/operationIdentity";

type WorkspaceGenerationPayload = {
  prompt: string;
  negativePrompt?: string;
  mediaType: "image" | "video";
  width: number;
  height: number;
  duration?: number;
  modelVersion: string;
  tagIds?: number[];
  uncensored: boolean;
  trainedModelId?: number;
  expectedCreditCost?: number;
};

// Existing style presets retain their separate execution path.
const DF_IMAGE_PRESETS = [
  {
    value: "df-cinematic",
    label: "DreamForge Cinematic",
    desc: "Dramatic lighting, film grain, cinematic color grading",
    types: ["image"],
    tier: "creator",
    badge: "Exclusive",
  },
  {
    value: "df-anime",
    label: "DreamForge Anime",
    desc: "High-quality anime with cel shading & vibrant colors",
    types: ["image"],
    tier: "creator",
    badge: "Exclusive",
  },
  {
    value: "df-fantasy",
    label: "DreamForge Fantasy",
    desc: "Epic fantasy art, magical effects, D&D inspired",
    types: ["image"],
    tier: "creator",
    badge: "Exclusive",
  },
  {
    value: "df-product",
    label: "DreamForge Product",
    desc: "Clean studio photography, commercial quality",
    types: ["image"],
    tier: "creator",
    badge: "Exclusive",
  },
  {
    value: "df-abstract",
    label: "DreamForge Abstract",
    desc: "Artistic, painterly, surreal compositions",
    types: ["image"],
    tier: "creator",
    badge: "Exclusive",
  },
];

const PRESET_PROMPTS = [
  "A crystalline dragon perched atop a floating island surrounded by aurora borealis, digital art style",
  "Biomechanical jellyfish drifting through a neon-lit underwater cyberpunk city, volumetric lighting",
  "Ancient mythological temple overgrown with bioluminescent flora, surreal dreamscape",
  "Abstract geometric forms dancing in zero gravity, iridescent metallic surfaces, art nouveau influence",
  "Ethereal forest spirit composed of flowing light particles, impressionist watercolor style",
];

const VIDEO_PRESETS = [
  "A phoenix rising from crystalline flames, cinematic slow motion, particle effects",
  "Ocean waves transforming into liquid mercury under a neon sky, smooth motion",
  "Mechanical clockwork butterfly taking flight from a steampunk garden, fluid animation",
  "Abstract paint strokes flowing and morphing into cosmic nebula patterns, dreamlike motion",
];

/** Survives React Strict Mode remount so onboarding autogen cannot double-fire. */
let workspaceAutogenArmed = false;

export default function Workspace() {
  useEffect(() => {
    track("studio_opened");
  }, []);

  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [prompt, setPrompt] = useState("");

  // Accept prompt from onboarding wizard via URL params. `autogen=1` fires
  // the first generation so skip/finish doesn't dump them on an empty studio.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wizardPrompt = params.get("prompt");
    if (wizardPrompt) setPrompt(wizardPrompt);
    if (params.get("autogen") === "1" && wizardPrompt)
      workspaceAutogenArmed = true;
    if (wizardPrompt || params.get("autogen")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [duration, setDuration] = useState(4);
  const [modelVersion, setModelVersion] = useState(WORKSPACE_AUTO_IMAGE_MODEL);
  const [trainedModelId, setTrainedModelId] = useState<number | undefined>();
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("trainedModelId"));
    if (Number.isSafeInteger(id) && id > 0) setTrainedModelId(id);
  }, []);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitGenId, setSubmitGenId] = useState<number | null>(null);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitDesc, setSubmitDesc] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aspectPreset, setAspectPreset] = useState("1:1");
  const [animateDialogOpen, setAnimateDialogOpen] = useState(false);
  const [animateGenId, setAnimateGenId] = useState<number | null>(null);
  const [uncensored, setUncensored] = useState(false);
  const generationInFlight = useRef(false);
  const generationUser = useRef(user?.id);
  generationUser.current = user?.id;
  const pendingRequestRef = useRef<GenerationRequestIdentity | null>(null);
  const pendingPayloadRef = useRef<WorkspaceGenerationPayload | null>(null);
  const [pendingRequest, setPendingRequest] =
    useState<GenerationRequestIdentity | null>(null);
  const [preparingSubmission, setPreparingSubmission] = useState(false);
  const [draftMatchesPending, setDraftMatchesPending] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<
    "processing" | "review" | "uncertain" | "retry"
  >("uncertain");
  const [retryAvailable, setRetryAvailable] = useState(true);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [entitlementNow, setEntitlementNow] = useState(() => Date.now());

  // Uncensored entitlement (crypto-paid tier). Drives the toggle's enabled
  // state + the "activate" CTA.
  const { data: uncensoredStatus } = trpc.uncensored.status.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    }
  );
  const uncensoredActive = !!uncensoredStatus?.active;

  const imageModelsQuery = trpc.generation.imageModels.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 1,
  });
  const trainedModelsQuery = trpc.training.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 1,
  });
  const trainedModels =
    trainedModelsQuery.data?.filter(model => model.state === "succeeded") ?? [];
  const selectedTrainedModel = trainedModels.find(
    model => model.id === trainedModelId
  );
  let trainedImageCredits = 0;
  try {
    trainedImageCredits = getTrainingImageCredits(width, height);
  } catch {
    /* Invalid dimensions block submission below. */
  }
  const videoModelsQuery = trpc.generation.videoModels.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 1,
  });
  const subscriptionQuery = trpc.pricing.getCurrentSubscription.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      retry: 1,
    }
  );
  const subscriptionInput = useMemo(
    () => ({
      planName: subscriptionQuery.data?.plan?.name,
      status: subscriptionQuery.data?.subscription?.status,
      currentPeriodStart:
        subscriptionQuery.data?.subscription?.currentPeriodStart,
      currentPeriodEnd: subscriptionQuery.data?.subscription?.currentPeriodEnd,
      cancelAtPeriodEnd:
        subscriptionQuery.data?.subscription?.cancelAtPeriodEnd,
    }),
    [subscriptionQuery.data]
  );
  const subscriptionEntitlement = getSubscriptionEntitlement(
    subscriptionInput,
    entitlementNow
  );
  const userTier = subscriptionEntitlement.tier;
  useEffect(() => {
    setEntitlementNow(Date.now());
  }, [subscriptionInput]);
  useEffect(() => {
    if (subscriptionEntitlement.expiresAt === null) return;
    const wait = Math.min(
      2_147_483_647,
      Math.max(1, subscriptionEntitlement.expiresAt - Date.now() + 1)
    );
    const timer = setTimeout(() => setEntitlementNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [subscriptionEntitlement.expiresAt, entitlementNow]);
  useEffect(() => {
    const updateTime = () => setEntitlementNow(Date.now());
    window.addEventListener("focus", updateTime);
    document.addEventListener("visibilitychange", updateTime);
    return () => {
      window.removeEventListener("focus", updateTime);
      document.removeEventListener("visibilitychange", updateTime);
    };
  }, []);
  const planReady =
    subscriptionQuery.isSuccess &&
    !subscriptionQuery.isError &&
    !subscriptionQuery.isFetching;
  const imageCatalogReady =
    imageModelsQuery.isSuccess &&
    !imageModelsQuery.isError &&
    !imageModelsQuery.isFetching;
  const uncensoredEnabled =
    uncensored && uncensoredActive && mediaType === "image" && !trainedModelId;
  const selectedDFPreset = DF_IMAGE_PRESETS.some(
    preset => preset.value === modelVersion
  );
  const selectedImageModel = imageModelsQuery.data?.find(
    model => model.id === modelVersion
  );
  const selectedVideoModel = videoModelsQuery.data?.find(
    model => model.id === modelVersion
  );
  const videoCatalogReady =
    videoModelsQuery.isSuccess && !videoModelsQuery.isFetching;
  const selectVideoModel = (id: string) => {
    setModelVersion(id);
    const model = videoModelsQuery.data?.find(item => item.id === id);
    if (model) setDuration(model.supportedDurations[0]);
  };
  const getCurrentImageSelectionError = (tier = userTier) =>
    mediaType === "video"
      ? workspaceVideoSelectionError({
          catalog: videoModelsQuery.data,
          catalogReady: videoCatalogReady,
          planReady,
          userTier: tier,
          modelId: modelVersion,
          duration,
        })
      : trainedModelId
        ? !planReady || tier !== "agency"
          ? "An active Agency plan is required to use a custom model."
          : !trainedModelsQuery.isSuccess || trainedModelsQuery.isFetching
            ? "Refresh your custom models before generating."
            : !selectedTrainedModel
              ? "This custom model is no longer ready. Choose another model."
              : !trainedImageCredits
                ? "Custom model dimensions must be 256–1,024 in multiples of eight."
                : null
        : uncensoredEnabled
          ? null
          : selectedDFPreset
            ? !planReady
              ? "Your subscription is still being checked. Try again or choose Auto."
              : !hasWorkspaceModelAccess(tier, "creator")
                ? "DreamForge style presets require Creator or higher."
                : null
            : getWorkspaceImageSelectionError({
                modelId: modelVersion,
                catalog: imageModelsQuery.data,
                catalogReady: imageCatalogReady,
                userTier: tier,
                planReady,
                width,
                height,
              });
  const imageSelectionError = getCurrentImageSelectionError();
  const draftPayload = useMemo<WorkspaceGenerationPayload>(
    () => ({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      mediaType,
      width,
      height,
      duration: mediaType === "video" ? duration : undefined,
      modelVersion,
      tagIds:
        selectedTags.length > 0
          ? [...selectedTags].sort((left, right) => left - right)
          : undefined,
      uncensored: uncensoredEnabled,
      ...(trainedModelId && mediaType === "image"
        ? { trainedModelId, expectedCreditCost: trainedImageCredits }
        : {}),
      ...(!trainedModelId &&
      !uncensoredEnabled &&
      !selectedDFPreset &&
      (mediaType === "image" ? selectedImageModel : selectedVideoModel)
        ? {
            expectedCreditCost: (mediaType === "image"
              ? selectedImageModel
              : selectedVideoModel)!.creditCost,
          }
        : {}),
    }),
    [
      prompt,
      negativePrompt,
      mediaType,
      width,
      height,
      duration,
      modelVersion,
      selectedTags,
      uncensoredEnabled,
      trainedModelId,
      trainedImageCredits,
      selectedDFPreset,
      selectedImageModel,
      selectedVideoModel,
    ]
  );

  useEffect(() => {
    const identity = user ? readGenerationRequestIdentity(user.id) : null;
    pendingRequestRef.current = identity;
    pendingPayloadRef.current = null;
    setPendingRequest(identity);
    setPendingStatus("uncertain");
  }, [user?.id]);
  useEffect(() => {
    let current = true;
    setDraftMatchesPending(false);
    if (pendingRequest) {
      fingerprintGenerationInput(draftPayload)
        .then(fingerprint => {
          if (current)
            setDraftMatchesPending(
              isGenerationRequestRetry(
                pendingRequest,
                user?.id ?? 0,
                fingerprint
              )
            );
        })
        .catch(() => {
          if (current) setDraftMatchesPending(false);
        });
    }
    return () => {
      current = false;
    };
  }, [pendingRequest, draftPayload, user?.id]);
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    []
  );

  const clearConfirmedRequest = (requestId: string | undefined) => {
    const identity = pendingRequestRef.current;
    if (!identity || identity.requestId !== requestId) return;
    clearGenerationRequestIdentity(identity);
    pendingRequestRef.current = null;
    pendingPayloadRef.current = null;
    setPendingRequest(null);
    setDraftMatchesPending(false);
    setRetryAvailable(true);
    if (retryTimer.current) clearTimeout(retryTimer.current);
  };

  const { data: tags } = trpc.tags.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: generations, refetch: refetchGens } =
    trpc.generation.list.useQuery(
      { limit: 50, offset: 0 },
      { enabled: isAuthenticated }
    );

  const utils = trpc.useUtils();

  const handleGenerationResult = (
    data: any,
    requestId?: string,
    quiet = false
  ) => {
    if (isTerminalGenerationResult(data)) {
      clearConfirmedRequest(data.requestId ?? requestId);
    }
    if (data.status === "completed") {
      track("generation_completed", {
        source: "workspace",
        mediaType: data.mediaType,
      });
      toast.success(
        `${data.mediaType === "video" ? "Video" : "Image"} generation completed!`
      );
      // Show achievement unlock toasts
      if (data.newAchievements && data.newAchievements.length > 0) {
        data.newAchievements.forEach((a: any) => {
          setTimeout(() => {
            toast.success(`\uD83C\uDFC6 Achievement Unlocked: ${a.name}!`, {
              description: a.description,
              duration: 6000,
            });
          }, 1500);
        });
      }
    } else if (data.status === "failed") {
      toast.error(`Generation failed: ${data.error || "Unknown error"}`);
    } else if (data.status === "generating") {
      setPendingStatus(data.reconciliationRequired ? "review" : "processing");
      setRetryAvailable(false);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      const wait = Number.isFinite(data.retryAfterMs)
        ? Math.max(250, Math.min(data.retryAfterMs, 60_000))
        : 1500;
      retryTimer.current = setTimeout(() => setRetryAvailable(true), wait);
      if (!quiet)
        toast.info(
          data.reconciliationRequired
            ? "This generation needs review before a final result can be confirmed."
            : "Your earlier generation is still processing. Check it again shortly."
        );
    }
    refetchGens();
  };

  const generateMutation = trpc.generation.create.useMutation({
    onSettled: () => {
      generationInFlight.current = false;
    },
    onSuccess: (data: any, variables) => {
      if (isCurrentOperation(pendingRequestRef.current, variables?.requestId, generationUser.current)) handleGenerationResult(data, variables?.requestId);
    },
    onError: (err, variables) => {
      if (!isCurrentOperation(pendingRequestRef.current, variables?.requestId, generationUser.current)) return;
      // These create failures precede reservation. Drop the cached quote so a
      // fresh submission can accept refreshed pricing and eligibility.
      if (isUnclaimedOperationError(err.data?.code)) clearConfirmedRequest(variables?.requestId);
      if (err.data?.code === "PRECONDITION_FAILED") {
        void imageModelsQuery.refetch(); void videoModelsQuery.refetch(); void trainedModelsQuery.refetch();
      }
      setPendingStatus(current =>
        current === "review"
          ? "review"
          : !err.data?.code || err.data.code === "INTERNAL_SERVER_ERROR"
            ? "uncertain"
            : "retry"
      );
      setRetryAvailable(true);
      // Adult prompt on the standard chain — send them to the metered funnel
      // with the prompt intact rather than making them retype it.
      if (isAdultRedirect(err.message)) {
        toast.info("Taking you to Uncensored mode for that one…");
        window.location.href = buildAdultRedirectUrl(prompt);
        return;
      }
      toast.error(err.message, err.data?.code === "PRECONDITION_FAILED" ? { description: "Refresh the page to review current pricing before trying again." } : undefined);
    },
  });

  const customStatusMutation = trpc.training.imageStatus.useMutation({
    onSettled: () => {
      generationInFlight.current = false;
    },
    onSuccess: (data, variables) => {
      if (isCurrentOperation(pendingRequestRef.current, variables.requestId, generationUser.current)) handleGenerationResult(data, variables.requestId, true);
    },
    onError: (_error, variables) => {
      if (!isCurrentOperation(pendingRequestRef.current, variables.requestId, generationUser.current)) return;
      setRetryAvailable(true);
      setPendingStatus("uncertain");
    },
  });
  useEffect(() => {
    if (
      !pendingRequest ||
      !trainedModelId ||
      !draftMatchesPending ||
      pendingRequest.userId !== user?.id ||
      !isAuthenticated ||
      generateMutation.isPending ||
      customStatusMutation.isPending ||
      !retryAvailable
    )
      return;
    const timer = setTimeout(
      () =>
        customStatusMutation.mutate({ requestId: pendingRequest.requestId }),
      5000
    );
    return () => clearTimeout(timer);
  }, [
    pendingRequest?.requestId,
    trainedModelId,
    draftMatchesPending,
    user?.id,
    isAuthenticated,
    generateMutation.isPending,
    customStatusMutation.isPending,
    retryAvailable,
  ]);

  const enhanceMutation = trpc.generation.enhancePrompt.useMutation({
    onSuccess: data => {
      setPrompt(data.enhanced);
      toast.success("Prompt enhanced with AI!");
    },
    onError: () => toast.error("Failed to enhance prompt"),
  });

  const submitMutation = trpc.generation.submitToGallery.useMutation({
    onSuccess: () => {
      toast.success("Submitted for review!");
      setSubmitDialogOpen(false);
      setSubmitTitle("");
      setSubmitDesc("");
      setSubmitGenId(null);
      refetchGens();
    },
    onError: err => toast.error(err.message),
  });

  const handleMediaTypeChange = (type: "image" | "video") => {
    setMediaType(type);
    setTrainedModelId(undefined);
    // Auto-select appropriate model
    if (type === "video") {
      const model = initialWorkspaceVideoModel(videoModelsQuery.data, userTier);
      setModelVersion(model?.id ?? "");
      if (model) setDuration(model.supportedDurations[0]);
    } else {
      setModelVersion(WORKSPACE_AUTO_IMAGE_MODEL);
    }
  };

  const handleGenerate = async () => {
    if (
      generateMutation.isPending ||
      customStatusMutation.isPending ||
      generationInFlight.current
    )
      return;
    if (!user || !isAuthenticated) {
      toast.error("Sign in to generate");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    const actorId = user.id;
    // Guard synchronously: digesting the draft must not open a second click window.
    generationInFlight.current = true;
    setPreparingSubmission(true);
    try {
      const fingerprint = await fingerprintGenerationInput(draftPayload);
      if (generationUser.current !== actorId) {
        generationInFlight.current = false;
        toast.error("Your account changed. Start this generation again.");
        return;
      }
      const previous =
        pendingRequestRef.current ?? readGenerationRequestIdentity(actorId);
      const isRetry = isGenerationRequestRetry(previous, actorId, fingerprint);
      if (isRetry && !retryAvailable) {
        generationInFlight.current = false;
        toast.info(
          "Your generation is still processing. Check it again shortly."
        );
        return;
      }
      // Replays may retrieve a confirmed result after eligibility changes.
      // Only a new logical generation needs current model/plan eligibility.
      if (!isRetry) {
        const currentTier = getSubscriptionEntitlement(
          subscriptionInput,
          Date.now()
        ).tier;
        const selectionError = getCurrentImageSelectionError(currentTier);
        if (selectionError) {
          generationInFlight.current = false;
          toast.error(selectionError);
          return;
        }
      }
      const identity = resolveGenerationRequestIdentity(
        previous,
        actorId,
        fingerprint
      );
      const payload =
        isRetry && pendingPayloadRef.current
          ? pendingPayloadRef.current
          : draftPayload;
      if (previous && !isRetry)
        toast.info(
          "The changed settings start a new generation. The earlier attempt remains unconfirmed."
        );
      pendingRequestRef.current = identity;
      pendingPayloadRef.current = payload;
      persistGenerationRequestIdentity(identity);
      setPendingRequest(identity);
      if (!isRetry) setPendingStatus("uncertain");
      setDraftMatchesPending(true);
      setRetryAvailable(true);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (!isRetry) track("generation_started", { source: "workspace" });
      if (isRetry && payload.trainedModelId)
        customStatusMutation.mutate({ requestId: identity.requestId });
      else
        generateMutation.mutate({ ...payload, requestId: identity.requestId });
    } catch {
      generationInFlight.current = false;
      toast.error("Could not prepare this generation. Try again.");
    } finally {
      setPreparingSubmission(false);
    }
  };

  useEffect(() => {
    if (!workspaceAutogenArmed || authLoading || !isAuthenticated) return;
    if (generateMutation.isPending || generationInFlight.current) return;
    if (
      mediaType === "image" &&
      !draftMatchesPending &&
      (!imageCatalogReady || imageSelectionError)
    )
      return;
    const p = prompt.trim();
    if (p.length < 3) return;
    workspaceAutogenArmed = false;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading,
    isAuthenticated,
    prompt,
    mediaType,
    imageCatalogReady,
    imageSelectionError,
    generateMutation.isPending,
    draftMatchesPending,
  ]);

  useKeyboardShortcuts([
    {
      key: "Enter",
      ctrl: true,
      handler: handleGenerate,
      description: "Generate image or video",
    },
  ]);

  const toggleTag = (tagId: number) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const usePreset = (p: string) => {
    setPrompt(p);
    toast.info("Preset prompt loaded");
  };

  // Compute stats
  const genStats = useMemo(() => {
    if (!generations) return { total: 0, completed: 0, images: 0, videos: 0 };
    return {
      total: generations.length,
      completed: generations.filter((g: any) => g.status === "completed")
        .length,
      images: generations.filter(
        (g: any) => g.mediaType === "image" && g.status === "completed"
      ).length,
      videos: generations.filter(
        (g: any) => g.mediaType === "video" && g.status === "completed"
      ).length,
    };
  }, [generations]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <div className="lg:col-span-3">
              <Skeleton className="h-[500px] rounded-xl" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <div className="max-w-md mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">
              Sign in to Access Workspace
            </h1>
            <p className="text-muted-foreground mb-8">
              The prompt workspace requires authentication. Sign in to begin
              generating synthetic research media.
            </p>
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              size="lg"
              className="glow-primary"
            >
              Sign in to Continue
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const currentPresets = mediaType === "video" ? VIDEO_PRESETS : PRESET_PROMPTS;

  return (
    <PageLayout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]" />
        </div>
        <div className="container relative py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
                <Wand2 className="h-3 w-3" />
                AI Creative Studio
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Create{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Something Amazing
                </span>
              </h1>
              <p className="text-muted-foreground max-w-md">
                Describe your vision and let AI bring it to life — images,
                videos, and animations powered by 30+ AI models.
              </p>
            </div>
            <div className="flex gap-2">
              {[
                "/showcase/gallery-13.jpg",
                "/showcase/gallery-17.jpg",
                "/showcase/gallery-20.jpg",
              ].map((img, i) => (
                <div
                  key={i}
                  className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70"
                >
                  <img
                    src={img}
                    alt="AI generated showcase"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 md:py-10">
        {/* Mini Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Total",
              value: genStats.total,
              icon: Sparkles,
              color: "text-primary",
            },
            {
              label: "Completed",
              value: genStats.completed,
              icon: CheckCircle,
              color: "text-emerald-500",
            },
            {
              label: "Images",
              value: genStats.images,
              icon: Image,
              color: "text-blue-500",
            },
            {
              label: "Videos",
              value: genStats.videos,
              icon: Film,
              color: "text-fuchsia-500",
            },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/50"
            >
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold leading-none">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Panel - Prompt Configuration */}
          <div className="lg:col-span-2 space-y-5">
            {/* Media Type Toggle */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <Tabs
                  value={mediaType}
                  onValueChange={v =>
                    handleMediaTypeChange(v as "image" | "video")
                  }
                >
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="image" className="gap-2">
                      <Image className="h-4 w-4" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="video" className="gap-2">
                      <Video className="h-4 w-4" />
                      Video Clip
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {mediaType === "video" && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Timer className="h-3 w-3" />
                        Duration: {duration}s
                      </Label>
                      <span className="text-[10px] text-muted-foreground">
                        Model-supported durations
                      </span>
                    </div>
                    <Select
                      value={String(duration)}
                      onValueChange={value => setDuration(Number(value))}
                      disabled={!selectedVideoModel}
                    >
                      <SelectTrigger aria-label="Video duration">
                        <SelectValue placeholder="Choose a video model first" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedVideoModel?.supportedDurations.map(value => (
                          <SelectItem key={value} value={String(value)}>
                            {value} seconds
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Film className="h-3 w-3" />
                      Creates a {duration}-second animated video clip
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Selector - Always Visible */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Cpu className="h-3 w-3" />
                  Model
                </Label>
                <Select
                  value={
                    trainedModelId ? `custom:${trainedModelId}` : modelVersion
                  }
                  onValueChange={value => {
                    if (value.startsWith("custom:")) {
                      setTrainedModelId(Number(value.slice(7)));
                      setModelVersion(WORKSPACE_AUTO_IMAGE_MODEL);
                      setUncensored(false);
                      setWidth(768);
                      setHeight(768);
                    } else {
                      setTrainedModelId(undefined);
                      if (mediaType === "video") selectVideoModel(value);
                      else setModelVersion(value);
                    }
                  }}
                  disabled={uncensoredEnabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an available model" />
                  </SelectTrigger>
                  <SelectContent>
                    {mediaType === "image" ? (
                      <>
                        <SelectGroup>
                          <SelectLabel>Image models</SelectLabel>
                          {!imageModelsQuery.data?.some(
                            model => model.id === WORKSPACE_AUTO_IMAGE_MODEL
                          ) && (
                            <SelectItem value={WORKSPACE_AUTO_IMAGE_MODEL}>
                              Auto (Best Available)
                            </SelectItem>
                          )}
                          {modelVersion !== WORKSPACE_AUTO_IMAGE_MODEL &&
                            !selectedDFPreset &&
                            !selectedImageModel && (
                              <SelectItem value={modelVersion} disabled>
                                Selected image model — no longer available
                              </SelectItem>
                            )}
                          {imageModelsQuery.data?.map(model => (
                            <SelectItem
                              key={model.id}
                              value={model.id}
                              disabled={
                                !model.isConfigured ||
                                (model.id !== WORKSPACE_AUTO_IMAGE_MODEL &&
                                  (!imageCatalogReady ||
                                    (model.requiredTier !== "free" &&
                                      !planReady) ||
                                    !hasWorkspaceModelAccess(
                                      userTier,
                                      model.requiredTier
                                    )))
                              }
                            >
                              <div className="flex flex-col gap-0.5 py-0.5">
                                <span>
                                  {model.name}
                                  {!model.isConfigured ? " — unavailable" : ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {model.creditCost} credits ·{" "}
                                  {
                                    getTierConfig(model.requiredTier)
                                      .displayName
                                  }
                                  {model.requiredTier !== "free" ? "+" : ""}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Your custom models · Agency</SelectLabel>
                          {trainedModelId && !selectedTrainedModel && (
                            <SelectItem
                              value={`custom:${trainedModelId}`}
                              disabled
                            >
                              Selected custom model — unavailable
                            </SelectItem>
                          )}
                          {trainedModels.map(model => (
                            <SelectItem
                              key={model.id}
                              value={`custom:${model.id}`}
                              disabled={!planReady || userTier !== "agency"}
                            >
                              {model.name} · {trainedImageCredits || 210}{" "}
                              credits
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>
                            DreamForge style presets · Creator+
                          </SelectLabel>
                          {DF_IMAGE_PRESETS.map(preset => (
                            <SelectItem
                              key={preset.value}
                              value={preset.value}
                              disabled={
                                !planReady ||
                                !hasWorkspaceModelAccess(userTier, "creator")
                              }
                            >
                              <span>{preset.label}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </>
                    ) : (
                      videoModelsQuery.data?.map(model => (
                        <SelectItem
                          key={model.id}
                          value={model.id}
                          disabled={
                            !videoCatalogReady ||
                            !planReady ||
                            !model.isConfigured ||
                            !hasWorkspaceModelAccess(
                              userTier,
                              model.requiredTier
                            )
                          }
                        >
                          <span>
                            {model.name} · {model.creditCost} credits ·{" "}
                            {getTierConfig(model.requiredTier).displayName}+
                            {model.isConfigured ? "" : " · unavailable"}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {mediaType === "video" && (
                  <div className="mt-3 space-y-2 text-xs" role="status">
                    {selectedVideoModel && (
                      <p>
                        {selectedVideoModel.creditCost} credits per render.{" "}
                        {selectedVideoModel.outputInfo}
                      </p>
                    )}
                    {imageSelectionError && (
                      <p className="text-amber-400">{imageSelectionError}</p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void videoModelsQuery.refetch()}
                      disabled={videoModelsQuery.isFetching}
                    >
                      {videoModelsQuery.isError
                        ? "Retry video models"
                        : "Refresh video models"}
                    </Button>
                  </div>
                )}
                {mediaType === "image" && (
                  <div className="mt-2 space-y-2">
                    {trainedModelId ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedTrainedModel?.name ?? "Custom model"} · trigger{" "}
                        {selectedTrainedModel?.triggerWord ?? "unavailable"} ·{" "}
                        {trainedImageCredits || "—"} credits per image. Private
                        output. Maximum 1,024 × 1,024.
                      </p>
                    ) : uncensoredEnabled ? (
                      <p className="text-xs text-muted-foreground">
                        Uncensored mode uses its own image models.
                      </p>
                    ) : selectedDFPreset ? (
                      <p className="text-xs text-muted-foreground">
                        {
                          DF_IMAGE_PRESETS.find(
                            preset => preset.value === modelVersion
                          )?.desc
                        }
                      </p>
                    ) : selectedImageModel ? (
                      <p className="text-xs text-muted-foreground">
                        {selectedImageModel.description}{" "}
                        {"outputInfo" in selectedImageModel &&
                        selectedImageModel.outputInfo
                          ? selectedImageModel.outputInfo
                          : `Max ${selectedImageModel.maxResolution.width} × ${selectedImageModel.maxResolution.height}.`}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="text-xs text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        {imageModelsQuery.isError
                          ? "Could not refresh image models. Auto is available; retry to choose a model."
                          : imageModelsQuery.isFetching
                            ? "Refreshing image models…"
                            : "Models and quoted costs refresh automatically."}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void imageModelsQuery.refetch();
                          void trainedModelsQuery.refetch();
                        }}
                        disabled={imageModelsQuery.isFetching}
                        className="h-7 shrink-0 text-xs"
                      >
                        <RotateCcw
                          className={`mr-1 h-3 w-3 ${imageModelsQuery.isFetching ? "animate-spin" : ""}`}
                        />
                        {imageModelsQuery.isError ? "Retry" : "Refresh"}
                      </Button>
                    </div>
                    {imageSelectionError && (
                      <p className="text-xs text-amber-400" role="status">
                        {imageSelectionError}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Main Prompt Card */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Scene Description
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={
                      mediaType === "video"
                        ? "Describe a motion scene... e.g., 'A phoenix rising from crystalline flames, cinematic slow motion, particle effects'"
                        : "Describe a fictional scene... e.g., 'A crystalline dragon perched atop a floating island surrounded by aurora borealis, digital art style'"
                    }
                    rows={6}
                    className="font-mono text-sm resize-none"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {prompt.length}/2000
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enhanceMutation.mutate({ prompt })}
                      disabled={!prompt.trim() || enhanceMutation.isPending}
                      className="text-xs gap-1.5 text-primary hover:text-primary"
                    >
                      {enhanceMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      Enhance with AI
                    </Button>
                  </div>
                </div>

                {/* Preset Prompts */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {mediaType === "video" ? "Video Presets" : "Quick Presets"}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentPresets.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => usePreset(p)}
                        className="text-[10px] px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
                        title={p}
                      >
                        {p.slice(0, 40)}...
                      </button>
                    ))}
                  </div>
                </div>

                {/* Style Presets */}
                <StylePresets
                  compact
                  onApply={preset => {
                    setPrompt(prev =>
                      prev
                        ? `${prev}, ${preset.promptSuffix}`
                        : preset.promptSuffix
                    );
                    if (preset.negativePrompt)
                      setNegativePrompt(preset.negativePrompt);
                  }}
                />

                {/* Negative Prompt */}
                <div>
                  <Label htmlFor="negative" className="text-sm">
                    Negative Prompt
                  </Label>
                  <Textarea
                    id="negative"
                    value={negativePrompt}
                    onChange={e => setNegativePrompt(e.target.value)}
                    placeholder="Elements to avoid..."
                    rows={2}
                    className="mt-1.5 font-mono text-sm resize-none"
                    maxLength={1000}
                  />
                </div>

                {/* Aspect Ratio Presets */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Aspect Ratio
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { label: "1:1", w: 1024, h: 1024, icon: "■" },
                      { label: "4:3", w: 1024, h: 768, icon: "▬" },
                      { label: "16:9", w: 1024, h: 576, icon: "▬▬" },
                      { label: "3:4", w: 768, h: 1024, icon: "▮" },
                      { label: "9:16", w: 576, h: 1024, icon: "▮▮" },
                    ].map(ar => (
                      <button
                        key={ar.label}
                        onClick={() => {
                          setAspectPreset(ar.label);
                          setWidth(ar.w);
                          setHeight(ar.h);
                        }}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition-all ${
                          aspectPreset === ar.label
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                            : "border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <span>{ar.icon}</span>
                        <span>{ar.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced Settings
                  <span className="ml-auto text-[10px]">
                    {showAdvanced ? "Hide" : "Show"}
                  </span>
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-4"
                    >
                      {/* Dimensions */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm flex items-center gap-1.5">
                            <Maximize className="h-3 w-3" />
                            Width
                          </Label>
                          <Select
                            value={String(width)}
                            onValueChange={v => setWidth(Number(v))}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="512">512px</SelectItem>
                              <SelectItem value="576">576px</SelectItem>
                              <SelectItem value="768">768px</SelectItem>
                              <SelectItem value="1024">1024px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm flex items-center gap-1.5">
                            <Maximize className="h-3 w-3" />
                            Height
                          </Label>
                          <Select
                            value={String(height)}
                            onValueChange={v => setHeight(Number(v))}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="512">512px</SelectItem>
                              <SelectItem value="576">576px</SelectItem>
                              <SelectItem value="768">768px</SelectItem>
                              <SelectItem value="1024">1024px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tags */}
                {tags && tags.length > 0 && (
                  <div>
                    <Label className="text-sm">Research Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map(tag => (
                        <Badge
                          key={tag.id}
                          variant={
                            selectedTags.includes(tag.id)
                              ? "default"
                              : "outline"
                          }
                          className={`cursor-pointer transition-all text-xs ${
                            selectedTags.includes(tag.id)
                              ? "shadow-sm"
                              : "bg-transparent hover:bg-accent"
                          }`}
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uncensored mode (crypto-paid tier).
                    The in-place toggle is image-only — uncensored video runs on
                    the self-hosted GPU path and lives in the /uncensored studio.
                    The CTA itself shows for BOTH media types on purpose: video
                    is where the intent (and the bigger ticket) actually is, and
                    gating the card to images hid the tier from exactly those
                    users. */}
                {uncensoredStatus?.available &&
                  (uncensoredActive ? (
                    mediaType === "image" ? (
                      <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-rose-500" />
                          <div>
                            <Label
                              htmlFor="uncensored-toggle"
                              className="text-sm font-medium cursor-pointer"
                            >
                              Uncensored mode
                            </Label>
                            <p className="text-[11px] text-muted-foreground">
                              No content filter · unfiltered models · private
                              only
                            </p>
                          </div>
                        </div>
                        <Switch
                          id="uncensored-toggle"
                          checked={uncensored}
                          onCheckedChange={setUncensored}
                        />
                      </div>
                    ) : uncensoredStatus?.videoAvailable ? (
                      <a
                        href="/uncensored"
                        className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 transition-colors hover:bg-rose-500/10"
                      >
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-rose-500" />
                          <div>
                            <span className="text-sm font-medium">
                              Uncensored video studio
                            </span>
                            <p className="text-[11px] text-muted-foreground">
                              Your pass is active · text-to-video &amp; animate
                              an image
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-rose-500" />
                      </a>
                    ) : null
                  ) : (
                    <a
                      href="/uncensored"
                      className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 transition-colors hover:bg-rose-500/10"
                    >
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-rose-500" />
                        <div>
                          <span className="text-sm font-medium">
                            {mediaType === "video"
                              ? "Unlock uncensored video"
                              : "Unlock Uncensored mode"}
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {mediaType === "video"
                              ? "No content filter · self-hosted GPU · 3 free previews · 18+"
                              : "No content filter · 3 free previews · Credits or Bitcoin · 18+"}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-rose-500" />
                    </a>
                  ))}

                {/* Generate Button */}
                {pendingRequest &&
                  !generateMutation.isPending &&
                  !preparingSubmission && (
                    <p
                      className="mb-3 text-xs text-muted-foreground"
                      role="status"
                      aria-live="polite"
                    >
                      {pendingStatus === "review"
                        ? "This generation needs review before a final result can be confirmed. Check its status again later."
                        : pendingStatus === "processing"
                          ? "Your previous generation is still processing. Check it again with the same settings."
                          : pendingStatus === "uncertain"
                            ? "The previous generation has not been confirmed. Retry the same settings to check it."
                            : "You can retry this generation with the same settings."}
                      {!draftMatchesPending &&
                        " Changed settings start a new generation."}
                    </p>
                  )}
                <Button
                  onClick={handleGenerate}
                  disabled={
                    !prompt.trim() ||
                    generateMutation.isPending ||
                    preparingSubmission ||
                    (draftMatchesPending
                      ? !retryAvailable
                      : !!imageSelectionError)
                  }
                  className="w-full font-medium h-12 text-base glow-primary"
                  size="lg"
                >
                  {generateMutation.isPending || preparingSubmission ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {preparingSubmission
                        ? "Preparing generation…"
                        : `Generating ${mediaType === "video" ? "Video" : "Image"}...`}
                    </>
                  ) : (
                    <>
                      {mediaType === "video" ? (
                        <Video className="h-5 w-5 mr-2" />
                      ) : (
                        <Sparkles className="h-5 w-5 mr-2" />
                      )}
                      {draftMatchesPending
                        ? pendingStatus === "review"
                          ? "Check status"
                          : pendingStatus === "retry"
                            ? "Retry generation"
                            : "Check generation"
                        : `Generate ${mediaType === "video" ? `${duration}s Video Clip` : "Image"}`}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Generation History */}
          <div className="lg:col-span-3 space-y-4">
            {/* Generation In Progress Banner */}
            <AnimatePresence>
              {generateMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-sm p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 shrink-0">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                        {mediaType === "video" ? (
                          <Video className="h-4 w-4 text-primary" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        Generating {mediaType === "video" ? "Video" : "Image"}
                        ...
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {prompt.slice(0, 80)}
                        {prompt.length > 80 ? "..." : ""}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full animate-pulse"
                          style={{ width: "60%" }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Generation History
                  </CardTitle>
                  {generations && generations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {generations.length} items
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetchGens()}
                        className="h-7 w-7 p-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!generations || generations.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
                      <Image className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="text-sm font-medium mb-1">
                      No generations yet
                    </p>
                    <p className="text-xs max-w-xs mx-auto">
                      Enter a prompt and generate your first synthetic output.
                      Try one of the preset prompts to get started.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {generations.map(gen => (
                        <motion.div
                          key={gen.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group rounded-xl border border-border/50 overflow-hidden hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                        >
                          {/* Media Preview */}
                          <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
                            {gen.status === "completed" && gen.imageUrl ? (
                              <>
                                {gen.mediaType === "video" ? (
                                  <video
                                    src={gen.imageUrl}
                                    controls
                                    preload="metadata"
                                    aria-label="Generated video"
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <img
                                    src={gen.imageUrl}
                                    alt="Synthetic output"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                  />
                                )}
                                {gen.mediaType === "video" && (
                                  <div className="absolute top-2 left-2 video-badge px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Film className="h-3 w-3 text-white" />
                                    <span className="text-[10px] text-white font-medium">
                                      {gen.duration || 4}s
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : gen.status === "generating" ||
                              gen.status === "pending" ? (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                <div className="relative">
                                  <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    {gen.mediaType === "video" ? (
                                      <Video className="h-4 w-4 text-primary/60" />
                                    ) : (
                                      <Sparkles className="h-4 w-4 text-primary/60" />
                                    )}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <span className="text-xs text-muted-foreground capitalize block">
                                    {gen.status}...
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {gen.mediaType === "video"
                                      ? "Rendering video frames"
                                      : "Generating image"}
                                  </span>
                                </div>
                              </div>
                            ) : gen.status === "failed" ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-destructive gap-2">
                                <XCircle className="h-8 w-8" />
                                <span className="text-xs">
                                  Generation Failed
                                </span>
                                {gen.errorMessage && (
                                  <span className="text-[10px] text-muted-foreground max-w-[200px] text-center">
                                    {gen.errorMessage}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Clock className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}

                            {/* Hover overlay */}
                            {gen.status === "completed" &&
                              gen.imageUrl &&
                              gen.mediaType !== "video" && (
                                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    disabled={gen.imageUrl.startsWith("/api/media/")}
                                    onClick={() => {
                                      setSubmitGenId(gen.id);
                                      setSubmitDialogOpen(true);
                                    }}
                                    className="text-xs h-8 gap-1.5"
                                  >
                                    <Send className="h-3 w-3" />
                                    Submit to Gallery
                                  </Button>
                                  {gen.mediaType === "image" && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => {
                                        setAnimateGenId(gen.id);
                                        setAnimateDialogOpen(true);
                                      }}
                                      className="text-xs h-8 gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-0"
                                    >
                                      <Play className="h-3 w-3" />
                                      Animate
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    asChild
                                    className="text-xs h-8 gap-1.5"
                                  >
                                    <a
                                      href={gen.imageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Open
                                    </a>
                                  </Button>
                                  {!gen.imageUrl.startsWith("/api/media/") && <ShareButton
                                    generationId={gen.id}
                                    shareText="Check out this AI image I made on DreamForgeX:"
                                    variant="secondary"
                                    iconOnly
                                    className="text-xs h-8 px-2"
                                  />}
                                </div>
                              )}
                          </div>

                          {/* Info */}
                          <div className="p-3 space-y-2">
                            {gen.status === "completed" &&
                              gen.mediaType === "video" &&
                              gen.imageUrl && (
                                <div className="flex gap-2">
                                  <Button asChild variant="outline" size="sm">
                                    <a
                                      href={gen.imageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Open video
                                    </a>
                                  </Button>
                                  {!gen.imageUrl.startsWith("/api/media/") && <ShareButton
                                    generationId={gen.id}
                                    shareText="Check out this AI video I made on DreamForgeX:"
                                    variant="outline"
                                  />}
                                </div>
                              )}
                            <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                              {gen.prompt}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(gen.createdAt).toLocaleDateString()}
                                </span>
                                {gen.mediaType === "video" && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1.5 bg-transparent border-fuchsia-500/30 text-fuchsia-400"
                                  >
                                    <Film className="h-2.5 w-2.5 mr-0.5" />
                                    {gen.duration || 4}s Video
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {gen.status === "completed" && (
                                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                                )}
                                {gen.status === "generating" && (
                                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                )}
                                {gen.status === "failed" && (
                                  <XCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  {gen.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">
                                {gen.modelVersion}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {gen.width}x{gen.height}
                              </span>
                              {(gen as any).parentGenerationId && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4 px-1.5 bg-transparent border-cyan-500/30 text-cyan-400"
                                >
                                  <Link2 className="h-2.5 w-2.5 mr-0.5" />
                                  Animated
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit to Gallery Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Share to Gallery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Your creation will be reviewed before appearing in the community
              gallery.
            </p>
            <div>
              <Label htmlFor="submit-title">Title</Label>
              <Input
                id="submit-title"
                value={submitTitle}
                onChange={e => setSubmitTitle(e.target.value)}
                placeholder="Give your generation a descriptive title"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="submit-desc">Description (optional)</Label>
              <Textarea
                id="submit-desc"
                value={submitDesc}
                onChange={e => setSubmitDesc(e.target.value)}
                placeholder="Describe the research context or artistic intent..."
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSubmitDialogOpen(false)}
              className="bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!submitGenId || !submitTitle.trim()) {
                  toast.error("Please enter a title");
                  return;
                }
                submitMutation.mutate({
                  generationId: submitGenId,
                  title: submitTitle.trim(),
                  description: submitDesc.trim() || undefined,
                });
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AnimationDialog
        open={animateDialogOpen}
        onOpenChange={setAnimateDialogOpen}
        generationId={animateGenId}
        sourceUrl={
          generations?.find((generation: any) => generation.id === animateGenId)
            ?.imageUrl
        }
        onComplete={() => {
          void refetchGens();
        }}
      />
    </PageLayout>
  );
}
