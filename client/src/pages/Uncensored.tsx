"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame,
  Lock,
  Shield,
  Bitcoin,
  Loader2,
  ArrowRight,
  Wallet,
  QrCode,
  Zap,
  ExternalLink,
  X,
  Film,
  Sparkles,
  Shirt,
  UserCheck,
  Wand2,
  Shuffle,
  Paintbrush,
  Grid2x2,
  Images,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { track } from "@/lib/analytics";
import { UNCENSORED_FAQ } from "@shared/uncensoredFaq";
import { UNCENSORED_SILO_LINKS } from "@shared/uncensoredLanding";
import { UNCENSORED_PLANS } from "@shared/uncensoredPlans";
import UncensoredStudio, { type UncensoredStudioTab } from "@/components/UncensoredStudio";
import {
  UNCENSORED_ASPECTS,
  UNCENSORED_SCENE_RECIPES,
  UNCENSORED_CHARACTER_ARCHETYPES,
  DEFAULT_UNCENSORED_ASPECT,
  enhanceUncensoredPrompt,
  pickRandomUncensoredSceneRecipe,
} from "@shared/uncensoredStudio";
import RenderWaitHint, { newRequestId } from "@/components/RenderWaitHint";

const VALID_STUDIO_TABS: UncensoredStudioTab[] = [
  "create",
  "refine",
  "inpaint",
  "sheet",
  "outfit",
  "video",
  "library",
];

const STUDIO_SHOWCASE_TOOLS: {
  tab: UncensoredStudioTab;
  icon: typeof Sparkles;
  title: string;
  badge: string;
  previewImg: string;
  desc: string;
  upsellLabel: string;
}[] = [
  {
    tab: "create",
    icon: Sparkles,
    title: "Create & Face Lock",
    badge: "IP-Adapter Identity",
    previewImg: "/showcase/uncensored-char-valentina-glam.jpg",
    desc: "Save any generated character and lock her face across brand-new scenes, poses, cameras & lighting.",
    upsellLabel: "Create with IP-Adapter Face Lock & 60+ director chips",
  },
  {
    tab: "refine",
    icon: Wand2,
    title: "Refine & Relight",
    badge: "8 Presets + 4K",
    previewImg: "/showcase/tool-relight.jpg",
    desc: "1-click Fix Hands, 8K Face & Eyes, Dewy Skin, Penthouse/Beach backgrounds, Relight, Cutout & 4× Upscale.",
    upsellLabel: "Refine, relight & 4K upscale in the Uncensored Studio",
  },
  {
    tab: "inpaint",
    icon: Paintbrush,
    title: "Brush Inpaint",
    badge: "Feathered Mask",
    previewImg: "/showcase/tool-inpaint.jpg",
    desc: "Paint over any region to swap wardrobe, add tattoos/jewelry, or fix details with interactive split comparison.",
    upsellLabel: "Brush inpaint & edit regions in the Uncensored Studio",
  },
  {
    tab: "outfit",
    icon: Shirt,
    title: "Virtual Outfit Swap",
    badge: "10 Presets + Try-On",
    previewImg: "/showcase/tool-virtual-tryon.jpg",
    desc: "Swap into Silk Lace, Latex Catsuit, Velvet Gown, Cyberpunk Armor, or copy any reference garment photo.",
    upsellLabel: "Swap outfits & restyle wardrobe in 1 click",
  },
  {
    tab: "sheet",
    icon: Grid2x2,
    title: "4-View Character Sheet",
    badge: "Parallel 2×2 PNG",
    previewImg: "/showcase/tool-character-sheet.jpg",
    desc: "Render front, 3/4, profile & full-body turnaround views in parallel + download a stitched 2×2 master PNG.",
    upsellLabel: "Generate 4-view character turnaround sheets",
  },
  {
    tab: "video",
    icon: Film,
    title: "Uncensored Video (Wan 2.1)",
    badge: "5–10s Motion Clips",
    previewImg: "/showcase/tool-i2v.jpg",
    desc: "Animate any uncensored character or text prompt into smooth 5–10s video clips with 6 camera & 12 motion presets.",
    upsellLabel: "Animate characters into 5–10s uncensored video clips",
  },
  {
    tab: "library",
    icon: Images,
    title: "100% Private Vault & Darkroom",
    badge: "Zero Public Feed",
    previewImg: "/showcase/demo-upscale-after.jpg",
    desc: "Full-screen Darkroom Lightbox, multi-select bulk download, character filter & 1-click seed recreate.",
    upsellLabel: "Unlock your private Uncensored Studio vault",
  },
];

/**
 * /uncensored — the crypto-paid Uncensored Pass landing + checkout.
 *
 * Why this exists: real user demand on DreamForgeX skews heavily adult, and
 * the standard (SFW) generation chain rejects it. This tier monetizes that
 * demand on crypto rails ONLY — Stripe's AUP bans adult content, so the SFW
 * plans keep Stripe and this never touches it.
 *
 * Flow: 18+ attestation → "Pay with crypto" → BTCPay invoice embedded INLINE
 * (iframe — no new tab, no popup blocker, QR right on the page) → webhook
 * settles → entitlement live → toggle unlocks in Workspace.
 */
// Shared ladder (shared/uncensoredPlans.ts) — same IDs/prices the server bills.
const FALLBACK_PLANS = UNCENSORED_PLANS;

export default function Uncensored() {
  const [ageChecked, setAgeChecked] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("uncensored-30d");

  // Intent carried back through sign-in (see shared/returnTo.ts). Visitors used
  // to authenticate from this page and land in the SFW studio, losing the thing
  // they came for; now they return here, to the exact card they clicked.
  const conversionCardRef = useRef<HTMLDivElement | null>(null);
  const checkoutCardRef = useRef<HTMLDivElement | null>(null);
  const freePromptRef = useRef<HTMLTextAreaElement | null>(null);
  const [returnIntent, setReturnIntent] = useState<"free" | "buy" | null>(null);
  const restoredIntent = useRef(false);
  const [autoUnlockPlanId, setAutoUnlockPlanId] = useState<string | null>(null);
  const autoUnlockedRef = useRef(false);
  const [studioIntent, setStudioIntent] = useState<{
    tab: UncensoredStudioTab;
    focusId: number | null;
    label: string;
  } | null>(null);
  const [selectedPreviewId, setSelectedPreviewId] = useState<number | null>(null);

  const { data: me, isLoading: meLoading } = trpc.auth.me.useQuery();
  const isAuthed = !!me;

  const { data: status, refetch } = trpc.uncensored.status.useQuery(undefined, {
    enabled: isAuthed,
    refetchInterval: (q) => (q.state.data?.active ? false : autoUnlockPlanId ? 2500 : 8000),
  });

  const myImages = trpc.uncensored.myUncensoredImages.useQuery(undefined, {
    enabled: isAuthed && !!status?.ageConfirmed && !status?.active,
  });

  const confirmAge = trpc.uncensored.confirmAge.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Unlocked — your 3 free previews are ready.");
    },
    onError: (e) => toast.error(e.message),
  });

  // Inline embedded BTCPay invoice (iframe). Replaces the old new-tab
  // window.open flow — popup blockers ate it and mobile users lost the page.
  const [inlineInvoice, setInlineInvoice] = useState<{ checkoutLink: string; invoiceId: string } | null>(null);

  const checkout = trpc.uncensored.createCheckout.useMutation({
    onSuccess: (data) => {
      track("checkout_started", { kind: "uncensored", plan: selectedPlanId });
      setInlineInvoice({ checkoutLink: data.checkoutLink, invoiceId: data.invoiceId });
      toast.success("Invoice ready — pay below. This page unlocks as soon as the payment is seen.");
    },
    onError: (e) => toast.error(e.message),
  });

  const unlockWithCredits = trpc.uncensored.unlockWithCredits.useMutation({
    onSuccess: () => {
      track("checkout_started", { kind: "uncensored_credits", plan: selectedPlanId });
      setAutoUnlockPlanId(null);
      refetch();
      toast.success("Uncensored Pass unlocked! Entering the Studio…");
    },
    onError: (e) => toast.error(e.message),
  });

  const purchaseCredits = trpc.pricing.purchaseCredits.useMutation({
    onSuccess: (res) => {
      if (res.url) {
        window.location.href = res.url;
      } else {
        toast.error("Couldn't open checkout. Please try again.");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  // BTCPay's embedded checkout posts status messages to the parent window
  // (same protocol its official modal uses). Use them to refetch entitlement
  // immediately on payment instead of waiting for the next 8s poll tick.
  useEffect(() => {
    if (!inlineInvoice) return;
    let origin = "";
    try {
      origin = new URL(inlineInvoice.checkoutLink).origin;
    } catch {
      return;
    }
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      const status = typeof ev.data === "string" ? ev.data : ev.data?.status;
      if (status === "complete" || status === "paid" || status === "confirmed" || status === "processing") {
        refetch();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [inlineInvoice, refetch]);

  const [freePrompt, setFreePrompt] = useState("");
  const [freeStyle, setFreeStyle] = useState("realistic");
  const [freeAspect, setFreeAspect] = useState(DEFAULT_UNCENSORED_ASPECT);
  const [freeResultUrl, setFreeResultUrl] = useState<string | null>(null);
  // The preview renders on our own GPU as a background job: the click returns
  // a generationId in ~1s and we poll freeStatus until it lands. Holding one
  // request open for the whole render (up to minutes) got silently re-sent
  // by the browser and ran the same prompt twice — costing the visitor two of
  // their three free previews for one click.
  const [pendingFreeId, setPendingFreeId] = useState<number | null>(null);
  const [freeStartedAt, setFreeStartedAt] = useState<number | null>(null);
  const freeGen = trpc.uncensored.freeGenerate.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setFreeResultUrl(data.url);
        setSelectedPreviewId(data.generationId);
        setFreeStartedAt(null);
        refetch();
        myImages.refetch();
        track("generation_completed", { kind: "uncensored_free" });
        toast.success("Done — that's a free preview.");
        return;
      }
      if (data.status === "failed") {
        setFreeStartedAt(null);
        toast.error("Generation failed — please try again.");
        return;
      }
      setPendingFreeId(data.generationId);
    },
    onError: (e) => {
      setFreeStartedAt(null);
      toast.error(e.message);
    },
  });
  const freeStatus = trpc.uncensored.freeStatus.useQuery(
    { generationId: pendingFreeId ?? 0 },
    {
      enabled: pendingFreeId != null,
      refetchInterval: (q) => (q.state.data && q.state.data.status !== "processing" ? false : 3000),
    },
  );
  useEffect(() => {
    const d = freeStatus.data;
    if (!d || pendingFreeId == null || d.status === "processing") return;
    const finishedId = pendingFreeId;
    setPendingFreeId(null);
    setFreeStartedAt(null);
    refetch();
    myImages.refetch();
    if (d.status === "completed" && d.url) {
      setFreeResultUrl(d.url);
      setSelectedPreviewId(finishedId);
      track("generation_completed", { kind: "uncensored_free" });
      toast.success("Done — that's a free preview.");
    } else {
      toast.error("Generation failed — that preview wasn't counted. Please try again.");
    }
  }, [freeStatus.data, pendingFreeId, refetch, myImages]);
  const freeBusy = freeGen.isPending || pendingFreeId != null;

  const plans = status?.plans ?? FALLBACK_PLANS;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans[plans.length - 1];
  const active = !!status?.active;
  const ageConfirmed = !!status?.ageConfirmed;
  const freeLimit = status?.freeLimit ?? 3;
  const freeRemaining = status ? status.freeRemaining : freeLimit;
  const previewHistory = myImages.data ?? [];
  const activePreviewItem =
    previewHistory.find((img) => img.id === selectedPreviewId) ?? previewHistory[0] ?? null;
  const displayPreviewUrl = activePreviewItem?.imageUrl ?? freeResultUrl;
  const displayPreviewId = activePreviewItem?.id ?? selectedPreviewId;

  const triggerStudioUpsell = (tab: UncensoredStudioTab, label: string) => {
    setStudioIntent({ tab, focusId: displayPreviewId ?? null, label });
    track("paywall_viewed", { surface: "uncensored", upsellTab: tab });
    checkoutCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Warm the GPU worker the moment we know this visitor can render (pass
  // holder, or a free preview left), so the ~1-2 minute weight load happens
  // while they type instead of after they click. Once per page load; the
  // server rate-limits it globally and never errors back.
  const warm = trpc.uncensored.warm.useMutation();
  const warmedRef = useRef(false);
  useEffect(() => {
    if (warmedRef.current || !isAuthed || !status) return;
    if (!ageConfirmed) return;
    if (!active && freeRemaining <= 0) return;
    warmedRef.current = true;
    warm.mutate(undefined, { onError: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, status, ageConfirmed, active, freeRemaining]);

  // Read the intent the sign-in or Stripe round-trip carried back.
  useEffect(() => {
    track("paywall_viewed", { surface: "uncensored" });
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    if (plan && UNCENSORED_PLANS.some((p) => p.id === plan)) setSelectedPlanId(plan);
    const tabParam = params.get("tab") as UncensoredStudioTab | null;
    const focusParam = params.get("focus");
    if (tabParam && VALID_STUDIO_TABS.includes(tabParam)) {
      const toolLabel = STUDIO_SHOWCASE_TOOLS.find((t) => t.tab === tabParam)?.title ?? "Uncensored Studio";
      const parsedFocus = focusParam ? Number(focusParam) : null;
      setStudioIntent({
        tab: tabParam,
        focusId: parsedFocus && Number.isFinite(parsedFocus) ? parsedFocus : null,
        label: `Open ${toolLabel} in Uncensored Studio`,
      });
    }
    const autoUnlock = params.get("auto_unlock");
    if (autoUnlock && UNCENSORED_PLANS.some((p) => p.id === autoUnlock)) {
      setSelectedPlanId(autoUnlock);
      setAutoUnlockPlanId(autoUnlock);
      setReturnIntent("buy");
      if (params.get("credit_success") === "true") {
        track("checkout_completed", { kind: "credit_pack", surface: "uncensored" });
        toast.success("Credits added! Unlocking your Uncensored Pass…");
      }
    }
    // A prompt handed over from the Workspace or demo (see shared/adultRouting)
    // — carry it in so they don't retype what they already wrote.
    const carried = params.get("prompt");
    if (carried) setFreePrompt(carried.slice(0, 1000));
    if (params.get("start") === "1") setReturnIntent("free");
    else if (plan || tabParam) setReturnIntent("buy");
  }, []);

  // Automatically unlock the pass once Stripe webhook settles the credit pack.
  useEffect(() => {
    if (!autoUnlockPlanId || autoUnlockedRef.current || !isAuthed || !status || active) return;
    if (!status.ageConfirmed) return;
    const targetPlan = plans.find((p) => p.id === autoUnlockPlanId);
    if (!targetPlan) return;
    if ((status.creditBalance ?? 0) >= targetPlan.creditPrice && !unlockWithCredits.isPending) {
      autoUnlockedRef.current = true;
      unlockWithCredits.mutate({ planId: autoUnlockPlanId });
    }
  }, [autoUnlockPlanId, isAuthed, status, active, plans, unlockWithCredits]);

  // Once entitlement has loaded, put the visitor ON the free preview — that is
  // the leak: 21 age-confirmed accounts never generated because the hero sat
  // above the fold and the prompt never got focus. Skip only if they came
  // back specifically to buy (plan= in the URL).
  useEffect(() => {
    if (restoredIntent.current) return;
    if (!isAuthed || !status || active) return;
    if (returnIntent === "buy") return;
    if (!ageConfirmed || freeRemaining <= 0) return;
    restoredIntent.current = true;
    conversionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => freePromptRef.current?.focus(), 400);
  }, [returnIntent, isAuthed, status, active, ageConfirmed, freeRemaining]);

  /**
   * Sign-in URL that comes back to THIS page with everything intact.
   *
   * Keeps whatever is already in the query — above all a `prompt` handed over
   * from the Workspace or demo — so a visitor who has to authenticate first
   * doesn't lose what they typed on the way in.
   */
  const loginUrlKeepingIntent = (extra?: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
    return getLoginUrl(`/uncensored?${params.toString()}`);
  };

  const handleAgeConfirm = async () => {
    if (!isAuthed) {
      window.location.href = loginUrlKeepingIntent({ start: "1" });
      return;
    }
    if (!ageChecked) {
      toast.error("Please confirm you are 18 or older.");
      return;
    }
    await confirmAge.mutateAsync({ confirmed: true });
  };

  const handleFreeGenerate = (promptOverride?: string, styleOverride?: string, aspectOverride?: string) => {
    const p = (promptOverride ?? freePrompt).trim();
    if (p.length < 3) {
      toast.error("Describe what you want to create.");
      return;
    }
    const chosenStyle = styleOverride ?? freeStyle;
    const chosenAspect = aspectOverride ?? freeAspect;
    if (promptOverride) setFreePrompt(promptOverride);
    if (styleOverride) setFreeStyle(styleOverride);
    if (aspectOverride) setFreeAspect(aspectOverride);
    setFreeResultUrl(null);
    setFreeStartedAt(Date.now());
    track("generation_started", { kind: "uncensored_free" });
    freeGen.mutate({ prompt: p, style: chosenStyle, aspect: chosenAspect, requestId: newRequestId() });
  };

  const handleStart = async () => {
    if (!isAuthed) {
      const extra: Record<string, string> = { plan: selectedPlanId };
      if (studioIntent?.tab) extra.tab = studioIntent.tab;
      if (studioIntent?.focusId) extra.focus = String(studioIntent.focusId);
      window.location.href = loginUrlKeepingIntent(extra);
      return;
    }
    if (!ageConfirmed) {
      if (!ageChecked) {
        toast.error("Please confirm you are 18 or older.");
        return;
      }
      await confirmAge.mutateAsync({ confirmed: true });
    }
    checkout.mutate({ planId: selectedPlanId });
  };

  const creditBalance = status?.creditBalance ?? 0;
  const requiredCredits = selectedPlan?.creditPrice ?? 2000;
  const hasEnoughCredits = creditBalance >= requiredCredits;

  const handleUnlockWithCredits = async () => {
    if (!isAuthed) {
      const extra: Record<string, string> = { plan: selectedPlanId };
      if (studioIntent?.tab) extra.tab = studioIntent.tab;
      if (studioIntent?.focusId) extra.focus = String(studioIntent.focusId);
      window.location.href = loginUrlKeepingIntent(extra);
      return;
    }
    if (!ageConfirmed) {
      if (!ageChecked) {
        toast.error("Please confirm you are 18 or older.");
        return;
      }
      await confirmAge.mutateAsync({ confirmed: true });
    }
    if (!hasEnoughCredits) {
      const packId = selectedPlan?.creditPackId ?? "pack-2500";
      track("checkout_started", { kind: "credit_pack", pack: packId, surface: "uncensored", plan: selectedPlanId });
      const returnParams = new URLSearchParams({ auto_unlock: selectedPlanId });
      if (studioIntent?.tab) returnParams.set("tab", studioIntent.tab);
      if (studioIntent?.focusId) returnParams.set("focus", String(studioIntent.focusId));
      purchaseCredits.mutate({
        packId,
        origin: window.location.origin,
        returnPath: `/uncensored?${returnParams.toString()}`,
      });
      return;
    }
    unlockWithCredits.mutate({ planId: selectedPlanId });
  };

  return (
    <PageLayout>
      <div className={`mx-auto px-4 py-16 ${active ? "max-w-6xl" : "max-w-5xl"}`}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/30">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Uncensored AI Image &amp; Video Studio
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            No content filter. 7 unfiltered open-source tools — Image Studio, 5–10s Video,
            Character Sheet, Outfit Swap, Brush Inpaint, Refine &amp; 4K Upscale — private by
            default. Unlock instantly with Card / Apple Pay (via Credits) or Bitcoin.
          </p>
        </motion.div>

        {active ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <UncensoredStudio
              until={status?.until ?? null}
              initialTab={studioIntent?.tab}
              initialFocusId={studioIntent?.focusId ?? displayPreviewId}
            />
          </motion.div>
        ) : (
          <>
            {/* ── Hero 4-Style Interactive Visual Showcase Strip ── */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  title: "Photoreal Boudoir",
                  badge: "85mm f/1.4 · Realistic",
                  img: "/showcase/uncensored-char-aria-nordic.jpg",
                  style: "realistic",
                  prompt: UNCENSORED_SCENE_RECIPES[0]!.prompt,
                },
                {
                  title: "Neon Cyber Siren",
                  badge: "Anamorphic · Cinematic",
                  img: "/showcase/uncensored-char-sora-cyber.jpg",
                  style: "cinematic",
                  prompt: UNCENSORED_SCENE_RECIPES[1]!.prompt,
                },
                {
                  title: "Dark Fantasy Empress",
                  badge: "Arcane Light · Fantasy",
                  img: "/showcase/uncensored-char-nyx-fantasy.jpg",
                  style: "fantasy",
                  prompt: UNCENSORED_SCENE_RECIPES[5]!.prompt,
                },
                {
                  title: "Uncensored Anime",
                  badge: "Cel-Shaded · Anime",
                  img: "/showcase/uncensored-char-kaia-anime.jpg",
                  style: "anime",
                  prompt: UNCENSORED_SCENE_RECIPES[6]!.prompt,
                },
              ].map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => {
                    setFreePrompt(card.prompt);
                    setFreeStyle(card.style);
                    if (ageConfirmed && freeRemaining > 0 && !freeBusy) {
                      handleFreeGenerate(card.prompt, card.style, "portrait");
                    } else {
                      conversionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                      toast.info(`Loaded "${card.title}" style — unlock free previews below to render.`);
                    }
                  }}
                  className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-rose-500/30 bg-black text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-rose-500 hover:shadow-rose-500/20"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.img}
                    alt={card.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                  <span className="absolute top-2.5 left-2.5 rounded-full border border-rose-500/40 bg-black/70 px-2.5 py-0.5 text-[10px] font-semibold text-rose-200 backdrop-blur-sm">
                    {card.badge}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <div className="text-sm font-bold text-white">{card.title}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-rose-300">
                      <Sparkles className="h-3 w-3" /> Try this look free →
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* ── Free taste — the conversion hook ──────────────────────────── */}
            <div className="mt-8" ref={conversionCardRef}>
              {!ageConfirmed ? (
                <div className="rounded-2xl border border-rose-500/30 bg-card/40 p-6 text-center">
                  <h2 className="text-lg font-semibold">Try it free — {freeLimit} uncensored previews</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Free account · no card · watermarked &amp; private. Confirm you&apos;re 18+ to unlock.
                  </p>
                  <label className="mt-4 flex items-center justify-center gap-2 text-sm">
                    <Checkbox checked={ageChecked} onCheckedChange={(v) => setAgeChecked(!!v)} />
                    I confirm I am 18 years of age or older.
                  </label>
                  <Button
                    onClick={handleAgeConfirm}
                    disabled={confirmAge.isPending || meLoading}
                    className="mt-4 bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
                  >
                    {confirmAge.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unlocking…</>
                    ) : isAuthed ? (
                      "Unlock free previews"
                    ) : (
                      <><Lock className="mr-2 h-4 w-4" /> Sign in to start free</>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-500/30 bg-card/40 p-6">
                  {freeRemaining > 0 ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold">Free uncensored preview</h2>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={freeBusy}
                            onClick={() => {
                              const recipe = pickRandomUncensoredSceneRecipe();
                              setFreePrompt(recipe.prompt);
                              setFreeStyle(recipe.style);
                              setFreeAspect(recipe.aspect);
                              toast.success(`Loaded "${recipe.label}" scene recipe`);
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-foreground disabled:opacity-40"
                          >
                            <Shuffle className="h-3 w-3 text-rose-400" /> Surprise me
                          </button>
                          <button
                            type="button"
                            disabled={freeBusy || freePrompt.trim().length < 3}
                            onClick={() => {
                              setFreePrompt(enhanceUncensoredPrompt(freePrompt, freeStyle));
                              toast.success("Prompt enhanced with studio lighting & lens direction.");
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
                          >
                            <Wand2 className="h-3 w-3 text-rose-400" /> Enhance prompt
                          </button>
                          <span className="text-xs text-muted-foreground">{freeRemaining} of {freeLimit} left</span>
                        </div>
                      </div>
                      <Textarea
                        ref={freePromptRef}
                        value={freePrompt}
                        onChange={(e) => setFreePrompt(e.target.value)}
                        placeholder="Describe what you want to create…"
                        rows={3}
                        maxLength={1000}
                        disabled={freeBusy}
                        className="mt-3 resize-none"
                      />
                      <div className="mt-3">
                        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                          1-Click Scene Recipes (sets prompt, style &amp; aspect + renders free):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {UNCENSORED_SCENE_RECIPES.map((recipe) => (
                            <button
                              key={recipe.id}
                              type="button"
                              disabled={freeBusy}
                              onClick={() => handleFreeGenerate(recipe.prompt, recipe.style, recipe.aspect)}
                              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 py-1 pr-3 pl-1 text-left text-xs text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={recipe.imageUrl}
                                alt={recipe.label}
                                className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-rose-500/40"
                              />
                              <span className="font-medium text-foreground/90">{recipe.label}</span>
                              <span className="hidden text-[10px] opacity-70 sm:inline">· {recipe.style}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Aspect:</span>
                        {UNCENSORED_ASPECTS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setFreeAspect(a.id)}
                            disabled={freeBusy}
                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${freeAspect === a.id ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-border/60 text-muted-foreground hover:border-rose-500/40"}`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                      {(status?.styles?.length ?? 0) > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Style:</span>
                          {status!.styles.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setFreeStyle(s.id)}
                              disabled={freeBusy}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${freeStyle === s.id ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-border/60 text-muted-foreground hover:border-rose-500/40"}`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <Button
                        onClick={() => handleFreeGenerate()}
                        disabled={freeBusy || freePrompt.trim().length < 3}
                        className="mt-3 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
                      >
                        {freeBusy ? (
                          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
                        ) : (
                          <><Flame className="mr-2 h-5 w-5" /> Generate (free)</>
                        )}
                      </Button>
                      {freeBusy && <RenderWaitHint startedAt={freeStartedAt} />}
                    </>
                  ) : (
                    <div className="text-center">
                      <Flame className="mx-auto h-8 w-8 text-rose-500" />
                      <h2 className="mt-2 text-lg font-semibold">You&apos;ve used your {freeLimit} free previews</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Grab a pass below to unlock unlimited full-resolution renders, 5s video animation, face lock, and outfit swap on your creations.
                      </p>
                    </div>
                  )}

                  {displayPreviewUrl && (
                    <div className="mt-5 rounded-xl border border-rose-500/30 bg-black/25 p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={displayPreviewUrl}
                        alt="Your uncensored preview"
                        className="mx-auto max-h-[420px] rounded-xl border border-border/60"
                      />
                      {previewHistory.length > 1 && (
                        <div className="mt-3 flex items-center justify-center gap-2">
                          {previewHistory.slice(0, 6).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSelectedPreviewId(item.id);
                                if (item.imageUrl) setFreeResultUrl(item.imageUrl);
                              }}
                              className={`overflow-hidden rounded-lg border transition-all ${
                                displayPreviewId === item.id
                                  ? "border-rose-500 ring-2 ring-rose-500/40"
                                  : "border-border/60 opacity-70 hover:opacity-100"
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.imageUrl ?? ""} alt="" className="h-12 w-12 object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-4">
                        <p className="text-center text-xs font-medium text-rose-300">
                          Continue with this creation in the Uncensored Studio:
                        </p>
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => triggerStudioUpsell("video", "Animate this image into a 5s video")}
                            className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
                          >
                            <span className="flex items-center gap-2">
                              <Film className="h-4 w-4 text-rose-400" />
                              Animate into 5s Video
                            </span>
                            <Lock className="h-3.5 w-3.5 text-rose-300/80" />
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerStudioUpsell("sheet", "Lock this character's face for new scenes")}
                            className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
                          >
                            <span className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-rose-400" />
                              Lock Character Face
                            </span>
                            <Lock className="h-3.5 w-3.5 text-rose-300/80" />
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerStudioUpsell("outfit", "Change outfit or restyle this image")}
                            className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
                          >
                            <span className="flex items-center gap-2">
                              <Shirt className="h-4 w-4 text-rose-400" />
                              Change Outfit / Edit
                            </span>
                            <Lock className="h-3.5 w-3.5 text-rose-300/80" />
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerStudioUpsell("refine", "Render unwatermarked full-HD & refine")}
                            className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-xs font-medium text-rose-200 transition-colors hover:bg-rose-500/20"
                          >
                            <span className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-rose-400" />
                              Remove Watermark &amp; HD
                            </span>
                            <Lock className="h-3.5 w-3.5 text-rose-300/80" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    No filter · private · watermarked. A pass unlocks unlimited, full-resolution, no-watermark generation.
                  </p>
                </div>
              )}
            </div>

            {/* 8 Signature Character Archetypes Visual Roster */}
            <div className="mt-12 rounded-2xl border border-rose-500/25 bg-card/30 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
                    <UserCheck className="h-3 w-3 text-rose-400" /> 8 Signature Studio Characters
                  </span>
                  <h2 className="mt-2 text-lg font-bold">
                    Spawn any character in 1 click — then lock her face across new scenes &amp; videos
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Click any portrait to try free or unlock Face Lock →
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {UNCENSORED_CHARACTER_ARCHETYPES.map((arch) => (
                  <button
                    key={arch.id}
                    type="button"
                    onClick={() => {
                      setFreePrompt(arch.prompt);
                      setFreeStyle(arch.style);
                      if (ageConfirmed && freeRemaining > 0 && !freeBusy) {
                        handleFreeGenerate(arch.prompt, arch.style, "portrait");
                      } else {
                        triggerStudioUpsell("create", `Spawn ${arch.name} (${arch.tagline}) with Face Lock`);
                      }
                    }}
                    className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border/60 bg-black text-left transition-all hover:-translate-y-0.5 hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/15"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={arch.imageUrl}
                      alt={arch.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                    <span className="absolute top-2 left-2 rounded-full border border-rose-500/40 bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-rose-200">
                      {arch.style}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="text-sm font-bold text-white">{arch.name}</div>
                      <div className="text-[11px] text-zinc-300">{arch.tagline}</div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-rose-300">
                        <Sparkles className="h-3 w-3" />
                        {ageConfirmed && freeRemaining > 0 ? "Render free →" : "Unlock Face Lock →"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive 7-Tool Studio Showcase */}
            <div className="mt-12 rounded-2xl border border-rose-500/25 bg-card/30 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
                    <Sparkles className="h-3 w-3 text-rose-400" /> 7-Tool Uncensored Pro Suite
                  </span>
                  <h2 className="mt-2 text-lg font-bold">
                    Everything unlocked with any Uncensored Pass
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">
                  Click any tool to unlock &amp; open directly →
                </span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {STUDIO_SHOWCASE_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isSelected = studioIntent?.tab === tool.tab;
                  return (
                    <button
                      key={tool.tab}
                      type="button"
                      onClick={() => triggerStudioUpsell(tool.tab, `Open ${tool.title} in Uncensored Studio`)}
                      className={`group flex flex-col justify-between overflow-hidden rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-rose-500 bg-rose-500/15 ring-1 ring-rose-500/40"
                          : "border-border/60 bg-background/40 hover:border-rose-500/50 hover:bg-rose-500/10"
                      }`}
                    >
                      <div className="relative h-36 w-full overflow-hidden bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tool.previewImg}
                          alt={tool.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                        <span className="absolute top-2.5 right-2.5 rounded-full border border-rose-500/40 bg-black/75 px-2.5 py-0.5 text-[10px] font-semibold text-rose-200 backdrop-blur-sm">
                          {tool.badge}
                        </span>
                        <div className="absolute bottom-2.5 left-3 flex items-center gap-2 text-sm font-bold text-white">
                          <Icon className="h-4 w-4 text-rose-400" />
                          {tool.title}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-4">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {tool.desc}
                        </p>
                        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
                          Unlock &amp; launch {tool.title} →
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feature row */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Flame, title: "Zero content filter", body: "Unfiltered open-source Flux, Wan 2.1 video & PuLID models — prompts standard tools reject just work." },
                { icon: Shield, title: "Private by default", body: "Uncensored creations never enter the public gallery, feeds, or share links." },
                { icon: Bitcoin, title: "Card, Credits or Bitcoin", body: "Unlock instantly with Card / Apple Pay (via Credits) from $4.99, or pay anonymously with Bitcoin." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border/60 bg-card/40 p-5">
                  <f.icon className="h-6 w-6 text-rose-500" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>

            {/* Pricing ladder + CTA — swaps to the inline embedded invoice
                once checkout starts (BTCPay checkout is iframe-embeddable;
                same mechanism as its official modal). */}
            <div
              ref={checkoutCardRef}
              className="mt-10 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/10 to-transparent p-6 sm:p-8"
            >
              {studioIntent && (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
                  <span className="flex items-center gap-2 font-medium">
                    <Sparkles className="h-4 w-4 shrink-0 text-rose-400" />
                    Unlocking pass to: {studioIntent.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStudioIntent(null)}
                    className="text-xs text-rose-300/80 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              )}
              {inlineInvoice ? (
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Complete your payment</h2>
                    <button
                      type="button"
                      onClick={() => setInlineInvoice(null)}
                      className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-foreground"
                      aria-label="Close invoice and go back to plans"
                    >
                      <X className="h-3.5 w-3.5" /> Back to plans
                    </button>
                  </div>
                  <iframe
                    src={inlineInvoice.checkoutLink}
                    title="BTCPay crypto invoice"
                    allow="clipboard-write"
                    className="mt-4 h-[660px] w-full rounded-xl border border-border/60 bg-white"
                  />
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Scan the QR or copy the Bitcoin address. The pass unlocks as soon as
                    the payment is seen — usually seconds after you send. Invoice stays
                    open 3 hours.
                  </p>
                  <p className="mt-2 text-center text-xs">
                    <a
                      href={inlineInvoice.checkoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-rose-300 hover:underline"
                    >
                      Trouble seeing the invoice? Open it in a new tab
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              ) : (
                <>
              <div className="grid gap-3 sm:grid-cols-3">
                {plans.map((p) => {
                  const isSelected = p.id === selectedPlanId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`relative rounded-xl border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/40"
                          : "border-border/60 bg-card/40 hover:border-rose-500/40"
                      }`}
                    >
                      {p.highlight && (
                        <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Best value
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-2xl font-bold">${p.priceUsd}</span>
                        <span className="text-xs font-medium text-rose-300">or {p.creditPrice} cr</span>
                      </div>
                      <div className="mt-1 text-sm font-medium">{p.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.durationDays} day{p.durationDays > 1 ? "s" : ""} · +{p.bonusCredits} bonus cr w/ BTC
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground/80">{p.tagline}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                One-time pass, no auto-renew. Unlock in 1 click with Card / Apple Pay (via DreamForgeX credit pack — includes leftover Studio credits) or pay anonymously with Bitcoin for +{selectedPlan?.bonusCredits ?? 500} bonus credits.
              </p>

              {!active && !ageConfirmed && (
                <label className="mt-5 flex items-center justify-center gap-2 text-sm">
                  <Checkbox checked={ageChecked} onCheckedChange={(v) => setAgeChecked(!!v)} />
                  I confirm I am 18 years of age or older.
                </label>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button
                  onClick={handleUnlockWithCredits}
                  disabled={unlockWithCredits.isPending || purchaseCredits.isPending || confirmAge.isPending || meLoading}
                  size="lg"
                  className="w-full bg-gradient-to-r from-rose-500 to-orange-500 text-sm font-semibold hover:opacity-90"
                >
                  {unlockWithCredits.isPending || confirmAge.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unlocking…</>
                  ) : purchaseCredits.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</>
                  ) : !isAuthed ? (
                    <><Lock className="mr-2 h-4 w-4" /> Sign in to unlock</>
                  ) : hasEnoughCredits ? (
                    <><Sparkles className="mr-2 h-4 w-4" /> Unlock with {requiredCredits} Credits (You have {creditBalance})</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Unlock w/ Card / Apple Pay · ${selectedPlan?.creditPackPriceUsd ?? 19.99}</>
                  )}
                </Button>

                <Button
                  onClick={handleStart}
                  disabled={checkout.isPending || confirmAge.isPending || meLoading || status?.available === false}
                  variant="outline"
                  size="lg"
                  className="w-full border-rose-500/40 bg-rose-500/10 text-sm font-semibold text-rose-100 hover:bg-rose-500/20"
                >
                  {checkout.isPending || confirmAge.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating invoice…</>
                  ) : !isAuthed ? (
                    <><Bitcoin className="mr-2 h-4 w-4" /> Sign in for Bitcoin</>
                  ) : (
                    <><Bitcoin className="mr-2 h-4 w-4" /> Pay ${selectedPlan?.priceUsd ?? 19} BTC (+{selectedPlan?.bonusCredits ?? 500} cr)</>
                  )}
                </Button>
              </div>

              {status?.available === false && (
                <p className="mt-3 text-center text-xs text-amber-500">
                  Crypto checkout is temporarily unavailable — use Credits above to unlock immediately.
                </p>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Credits unlock the Studio immediately. Bitcoin payments unlock as soon as seen on-chain or Lightning.
              </p>
                </>
              )}
            </div>

            {/* Dual-rail payment explainer — Card / Apple Pay (via Stripe Credits) + Anonymous Bitcoin */}
            <div className="mt-14">
              <h2 className="text-center text-xl font-semibold">
                Two ways to unlock — Card / Apple Pay in 30s or Anonymous Bitcoin
              </h2>
              <p className="mx-auto mt-1.5 max-w-2xl text-center text-sm text-muted-foreground">
                Choose instant Visa / Mastercard / Apple Pay checkout via universal DreamForgeX Studio credits, or pay 100% anonymously with Bitcoin for bonus credits.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Sparkles,
                    step: "A",
                    title: "Card / Apple Pay (30 Seconds)",
                    body: "Tap 'Unlock w/ Card / Apple Pay' above. Stripe bills a standard DreamForgeX compute credit pack (discreet 'DREAMFORGEX AI' descriptor), auto-unlocks your pass on return, and keeps leftover credits in your wallet.",
                  },
                  {
                    icon: QrCode,
                    step: "B",
                    title: "Or Scan Bitcoin QR (Anonymous)",
                    body: "Prefer zero card or bank footprint? Tap 'Pay BTC' above — the BTCPay invoice appears inline with a QR code. Pay from Cash App, Strike, Coinbase, or any Lightning / on-chain wallet.",
                  },
                  {
                    icon: Zap,
                    step: "✓",
                    title: "Instant Studio Activation",
                    body: "Card / Credit unlocks are immediate. Bitcoin unlocks as soon as seen on Lightning or in the mempool (usually seconds) and includes up to +500 bonus Studio credits.",
                  },
                ].map((s) => (
                  <div key={s.step} className="relative rounded-xl border border-border/60 bg-card/40 p-5">
                    <div className="absolute -top-3 left-5 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-500 text-xs font-bold text-white">
                      {s.step}
                    </div>
                    <s.icon className="mt-2 h-6 w-6 text-rose-500" />
                    <h3 className="mt-3 font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ — same content is emitted as FAQPage JSON-LD from app/uncensored/page.tsx */}
            <div className="mt-14">
              <h2 className="text-center text-xl font-semibold">Frequently asked questions</h2>
              <div className="mx-auto mt-6 max-w-2xl space-y-3">
                {UNCENSORED_FAQ.map((f) => (
                  <details key={f.q} className="group rounded-xl border border-border/60 bg-card/40 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                      {f.q}
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    </summary>
                    <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* SEO silo internal links — give the /uncensored/* landers crawl
                equity from this indexed page (descriptive anchor text). */}
            <div className="mt-14">
              <h2 className="text-center text-xl font-semibold">Explore uncensored generators</h2>
              <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
                {UNCENSORED_SILO_LINKS.map((l) => (
                  <a
                    key={l.slug}
                    href={`/uncensored/${l.slug}`}
                    className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-300"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            <p className="mt-12 text-center text-xs text-muted-foreground">
              All content is AI-generated and fictional. No real individuals are depicted.
              You are responsible for complying with the laws of your jurisdiction.{" "}
              <a href="/takedown" className="underline underline-offset-2 hover:text-foreground">
                Report content
              </a>
              .
            </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
