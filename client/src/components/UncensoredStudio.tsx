"use client";

import { useState } from "react";
import { Flame, Wand2, Paintbrush, LayoutGrid, Shirt, Film, FolderHeart, Zap, Plus, Loader2, Clock, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { UNCENSORED_PLANS } from "@shared/uncensoredPlans";
import UncensoredImageStudio from "./UncensoredImageStudio";
import UncensoredRefineStudio from "./UncensoredRefineStudio";
import UncensoredInpaintStudio from "./UncensoredInpaintStudio";
import UncensoredVideoStudio from "./UncensoredVideoStudio";
import UncensoredSheetStudio from "./UncensoredSheetStudio";
import UncensoredOutfitStudio from "./UncensoredOutfitStudio";
import UncensoredLibrary from "./UncensoredLibrary";

export type UncensoredStudioTab = "create" | "refine" | "inpaint" | "sheet" | "outfit" | "video" | "library";
type Tab = UncensoredStudioTab;

const TABS: { id: Tab; label: string; icon: typeof Flame }[] = [
  { id: "create", label: "Create", icon: Flame },
  { id: "refine", label: "Refine & Relight", icon: Wand2 },
  { id: "inpaint", label: "Inpaint", icon: Paintbrush },
  { id: "sheet", label: "4-View Sheet", icon: LayoutGrid },
  { id: "outfit", label: "Outfit Swap", icon: Shirt },
  { id: "video", label: "Animate Video", icon: Film },
  { id: "library", label: "Library", icon: FolderHeart },
];

const QUICK_TOPUP_PACKS = [
  { id: "pack-500", label: "+500 cr", price: "$4.99" },
  { id: "pack-2500", label: "+2,500 cr", price: "$19.99" },
  { id: "pack-7500", label: "+7,500 cr", price: "$49.99" },
] as const;

function formatPassRemaining(untilDate: Date | null): { text: string; urgent: boolean } | null {
  if (!untilDate) return null;
  const diffMs = untilDate.getTime() - Date.now();
  if (diffMs <= 0) return { text: "Expired", urgent: true };
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days >= 2) return { text: `${days}d ${hours}h left`, urgent: false };
  if (days === 1) return { text: `1d ${hours}h left`, urgent: false };
  if (totalHours >= 1) return { text: `${totalHours}h left`, urgent: true };
  const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return { text: `${mins}m left`, urgent: true };
}

/**
 * Paid uncensored workspace. Tabs share a focused generation id so Create →
 * Refine / Inpaint / Animate is one click instead of re-picking the image.
 */
export default function UncensoredStudio({
  until,
  initialTab,
  initialFocusId,
}: {
  until: Date | string | null;
  initialTab?: UncensoredStudioTab;
  initialFocusId?: number | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "create");
  const [focusId, setFocusId] = useState<number | null>(initialFocusId ?? null);
  const [recreateId, setRecreateId] = useState<number | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [showExtendPass, setShowExtendPass] = useState(false);

  const utils = trpc.useUtils();
  const { data: status } = trpc.uncensored.status.useQuery();
  const { data: referralData } = trpc.referral.getMyReferral.useQuery();
  const purchaseCredits = trpc.pricing.purchaseCredits.useMutation({
    onSuccess: (res) => {
      if (res.url) {
        track("checkout_redirected", { kind: "credit_pack", surface: "uncensored-studio" });
        window.location.href = res.url;
      } else toast.error("Couldn't open checkout.");
    },
    onError: (e) => toast.error(e.message),
  });
  const extendWithCredits = trpc.uncensored.unlockWithCredits.useMutation({
    onSuccess: (res) => {
      const newDate = res.until ? new Date(res.until).toLocaleDateString() : "extended";
      toast.success(`Pass extended until ${newDate}! (${res.creditsRemaining.toLocaleString()} credits remaining)`);
      setShowExtendPass(false);
      utils.uncensored.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const effectiveUntil = status?.until ? new Date(status.until) : until ? new Date(until) : null;
  const remaining = formatPassRemaining(effectiveUntil);
  const creditBalance = status?.creditBalance ?? 0;

  const go = (next: Tab, id?: number) => {
    if (typeof id === "number") setFocusId(id);
    setTab(next);
  };

  const handleCopyReferral = async () => {
    const code = referralData?.code;
    const url = code
      ? `${window.location.origin}/uncensored?ref=${encodeURIComponent(code)}`
      : `${window.location.origin}/uncensored`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Referral link copied! You get +100 credits & your friend gets +50 credits on signup.");
    } catch {
      toast.error("Couldn't copy link.");
    }
  };

  return (
    <div className="mt-10 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/5 via-card/30 to-card/20 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <h2 className="text-xl font-bold sm:text-2xl">Uncensored Pro Studio</h2>
            {remaining && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  remaining.urgent
                    ? "border border-amber-500/40 bg-amber-500/15 text-amber-300"
                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <Clock className="h-3 w-3" />
                {remaining.text}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Pass active until {effectiveUntil ? effectiveUntil.toLocaleDateString() : "—"} · Private · Unfiltered · Zero Watermark
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-black/30 px-3.5 py-1.5 text-xs font-semibold text-rose-100">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>{creditBalance.toLocaleString()} credits</span>
          </div>
          <button
            type="button"
            onClick={handleCopyReferral}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
            title="Share your referral link: you earn +100 credits and your friend gets +50 credits"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Refer (+100 Cr)
          </button>
          <button
            type="button"
            onClick={() => {
              setShowExtendPass((v) => !v);
              setShowTopUp(false);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-3.5 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/25"
          >
            <Clock className="h-3.5 w-3.5 text-rose-300" /> Extend Pass
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTopUp((v) => !v);
              setShowExtendPass(false);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Top Up Credits
          </button>
        </div>
      </div>

      {showExtendPass && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-black/35 p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-rose-100">
                Stack extra pass time onto your active Uncensored Pass (no time lost):
              </p>
              <p className="text-[11px] text-muted-foreground">
                Use existing credits in 1 click, or pay with Card / Apple Pay to top up and auto-extend.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {UNCENSORED_PLANS.map((plan) => {
                const hasEnough = creditBalance >= plan.creditPrice;
                const busy = extendWithCredits.isPending || purchaseCredits.isPending;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (hasEnough) {
                        extendWithCredits.mutate({ planId: plan.id });
                      } else {
                        purchaseCredits.mutate({
                          packId: plan.creditPackId,
                          origin: window.location.origin,
                          returnPath: `/uncensored?auto_unlock=${encodeURIComponent(plan.id)}`,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-amber-400" />
                    )}
                    +{plan.durationDays === 1 ? "24h" : `${plan.durationDays}d`} ({plan.label}) ·{" "}
                    {hasEnough ? `${plan.creditPrice.toLocaleString()} cr` : `$${plan.creditPackPriceUsd} Card/Pay`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showTopUp && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-black/30 p-3">
          <span className="text-xs text-muted-foreground">
            Instant credit top-up (Card / Apple Pay / Google Pay):
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_TOPUP_PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={purchaseCredits.isPending}
                onClick={() =>
                  purchaseCredits.mutate({
                    packId: p.id,
                    origin: window.location.origin,
                    returnPath: "/uncensored",
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/25 disabled:opacity-50"
              >
                {purchaseCredits.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 text-amber-400" />}
                {p.label} · {p.price}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5 rounded-xl border border-border/60 bg-black/25 p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                tab === t.id
                  ? "bg-gradient-to-r from-rose-500/25 to-orange-500/20 text-rose-100 ring-1 ring-rose-500/40"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${tab === t.id ? "text-rose-400" : "opacity-70"}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="text-left">
        {tab === "create" && (
          <UncensoredImageStudio
            focusCharacterId={focusId}
            recreateId={recreateId}
            onRefine={(id) => go("refine", id)}
            onInpaint={(id) => go("inpaint", id)}
            onAnimate={(id) => go("video", id)}
            onSheet={(id) => go("sheet", id)}
            onOutfit={(id) => go("outfit", id)}
          />
        )}
        {tab === "refine" && (
          <UncensoredRefineStudio
            focusGenerationId={focusId}
            onInpaint={(id) => go("inpaint", id)}
            onOutfit={(id) => go("outfit", id)}
            onSheet={(id) => go("sheet", id)}
            onAnimate={(id) => go("video", id)}
            onUseCharacter={(id) => go("create", id)}
          />
        )}
        {tab === "inpaint" && (
          <UncensoredInpaintStudio
            focusGenerationId={focusId}
            onRefine={(id) => go("refine", id)}
            onOutfit={(id) => go("outfit", id)}
            onSheet={(id) => go("sheet", id)}
            onAnimate={(id) => go("video", id)}
            onUseCharacter={(id) => go("create", id)}
          />
        )}
        {tab === "sheet" && (
          <UncensoredSheetStudio
            focusGenerationId={focusId}
            onRefine={(id) => go("refine", id)}
            onInpaint={(id) => go("inpaint", id)}
            onOutfit={(id) => go("outfit", id)}
            onAnimate={(id) => go("video", id)}
            onUseCharacter={(id) => go("create", id)}
          />
        )}
        {tab === "outfit" && (
          <UncensoredOutfitStudio
            focusGenerationId={focusId}
            onRefine={(id) => go("refine", id)}
            onInpaint={(id) => go("inpaint", id)}
            onSheet={(id) => go("sheet", id)}
            onAnimate={(id) => go("video", id)}
            onUseCharacter={(id) => go("create", id)}
          />
        )}
        {tab === "video" && <UncensoredVideoStudio focusGenerationId={focusId} />}
        {tab === "library" && (
          <UncensoredLibrary
            onRefine={(id) => go("refine", id)}
            onInpaint={(id) => go("inpaint", id)}
            onAnimate={(id) => go("video", id)}
            onUseCharacter={(id) => {
              setRecreateId(null);
              go("create", id);
            }}
            onRecreate={(id) => {
              setFocusId(null);
              setRecreateId(id);
              setTab("create");
            }}
            onSheet={(id) => go("sheet", id)}
            onOutfit={(id) => go("outfit", id)}
          />
        )}
      </div>
    </div>
  );
}

