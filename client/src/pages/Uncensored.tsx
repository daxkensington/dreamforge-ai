"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Lock, Shield, Bitcoin, CheckCircle2, Loader2, ArrowRight, Wallet, QrCode, Zap, ExternalLink, X } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { UNCENSORED_FAQ } from "@shared/uncensoredFaq";
import UncensoredVideoStudio from "@/components/UncensoredVideoStudio";

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
// Fallback so the ladder renders before the status query resolves; the server
// (server/_core/btcpay.ts UNCENSORED_PLANS) is the source of truth at checkout.
const FALLBACK_PLANS = [
  { id: "uncensored-day", label: "Day Pass", priceUsd: 4.99, bonusCredits: 60, durationDays: 1, tagline: "Dip in for 24 hours", highlight: false },
  { id: "uncensored-week", label: "Week Pass", priceUsd: 12, bonusCredits: 250, durationDays: 7, tagline: "A week, no commitment", highlight: false },
  { id: "uncensored-30d", label: "30-Day Pass", priceUsd: 19, bonusCredits: 500, durationDays: 30, tagline: "Best value", highlight: true },
];

export default function Uncensored() {
  const [ageChecked, setAgeChecked] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("uncensored-30d");

  const { data: me, isLoading: meLoading } = trpc.auth.me.useQuery();
  const isAuthed = !!me;

  const { data: status, refetch } = trpc.uncensored.status.useQuery(undefined, {
    enabled: isAuthed,
    refetchInterval: (q) => (q.state.data?.active ? false : 8000), // poll until settled
  });

  const confirmAge = trpc.uncensored.confirmAge.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  // Inline embedded BTCPay invoice (iframe). Replaces the old new-tab
  // window.open flow — popup blockers ate it and mobile users lost the page.
  const [inlineInvoice, setInlineInvoice] = useState<{ checkoutLink: string; invoiceId: string } | null>(null);

  const checkout = trpc.uncensored.createCheckout.useMutation({
    onSuccess: (data) => {
      setInlineInvoice({ checkoutLink: data.checkoutLink, invoiceId: data.invoiceId });
      toast.success("Invoice ready — pay below. This page unlocks once payment confirms.");
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
  const [freeResultUrl, setFreeResultUrl] = useState<string | null>(null);
  const freeGen = trpc.uncensored.freeGenerate.useMutation({
    onSuccess: (data) => {
      if (data.url) setFreeResultUrl(data.url);
      refetch();
      toast.success("Done — that's a free preview.");
    },
    onError: (e) => toast.error(e.message),
  });

  const plans = status?.plans ?? FALLBACK_PLANS;
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? plans[plans.length - 1];
  const active = !!status?.active;
  const ageConfirmed = !!status?.ageConfirmed;
  const freeLimit = status?.freeLimit ?? 3;
  const freeRemaining = status ? status.freeRemaining : freeLimit;

  const handleAgeConfirm = async () => {
    if (!isAuthed) {
      window.location.href = getLoginUrl();
      return;
    }
    if (!ageChecked) {
      toast.error("Please confirm you are 18 or older.");
      return;
    }
    await confirmAge.mutateAsync({ confirmed: true });
  };

  const handleFreeGenerate = () => {
    const p = freePrompt.trim();
    if (p.length < 3) {
      toast.error("Describe what you want to create.");
      return;
    }
    setFreeResultUrl(null);
    freeGen.mutate({ prompt: p, style: freeStyle });
  };

  const handleStart = async () => {
    if (!isAuthed) {
      window.location.href = getLoginUrl();
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

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/30">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Uncensored AI Image Generator
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            No content filter. Unfiltered open-source models running on our own GPUs.
            Pay anonymously with crypto, and your generations stay private — never
            shown in the public gallery or shared anywhere.
          </p>
        </motion.div>

        {active ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-2xl font-semibold">Your Uncensored Pass is active</h2>
            <p className="mt-2 text-muted-foreground">
              Active until{" "}
              {status?.until ? new Date(status.until).toLocaleDateString() : "—"}. Flip on
              "Uncensored mode" in the Studio.
            </p>
            <Button asChild className="mt-6" size="lg">
              <a href="/workspace">
                Open Studio <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <div className="mt-2 text-left">
              <UncensoredVideoStudio />
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Free taste — the conversion hook ──────────────────────────── */}
            <div className="mt-10">
              {!ageConfirmed ? (
                <div className="rounded-2xl border border-rose-500/30 bg-card/40 p-6 text-center">
                  <h2 className="text-lg font-semibold">Try it free — {freeLimit} uncensored previews</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Watermarked &amp; private. Confirm you&apos;re an adult to unlock.
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
              ) : freeRemaining > 0 ? (
                <div className="rounded-2xl border border-rose-500/30 bg-card/40 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Free uncensored preview</h2>
                    <span className="text-xs text-muted-foreground">{freeRemaining} of {freeLimit} left</span>
                  </div>
                  <Textarea
                    value={freePrompt}
                    onChange={(e) => setFreePrompt(e.target.value)}
                    placeholder="Describe what you want to create…"
                    rows={3}
                    maxLength={1000}
                    disabled={freeGen.isPending}
                    className="mt-3 resize-none"
                  />
                  {(status?.styles?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">Style:</span>
                      {status!.styles.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setFreeStyle(s.id)}
                          disabled={freeGen.isPending}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${freeStyle === s.id ? "border-rose-500 bg-rose-500/10 text-rose-300" : "border-border/60 text-muted-foreground hover:border-rose-500/40"}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button
                    onClick={handleFreeGenerate}
                    disabled={freeGen.isPending || freePrompt.trim().length < 3}
                    className="mt-3 w-full bg-gradient-to-r from-rose-500 to-orange-500 font-semibold hover:opacity-90"
                  >
                    {freeGen.isPending ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating…</>
                    ) : (
                      <><Flame className="mr-2 h-5 w-5" /> Generate (free)</>
                    )}
                  </Button>
                  {freeResultUrl && (
                    <div className="mt-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={freeResultUrl}
                        alt="Your uncensored preview"
                        className="mx-auto max-h-[420px] rounded-xl border border-border/60"
                      />
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Watermarked preview · private. Get a pass below for full resolution, no watermark.
                      </p>
                    </div>
                  )}
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    No filter · private · watermarked. A pass unlocks unlimited, full-resolution, no-watermark generation.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/10 to-transparent p-6 text-center">
                  <Flame className="mx-auto h-8 w-8 text-rose-500" />
                  <h2 className="mt-2 text-lg font-semibold">You&apos;ve used your free previews</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Grab a pass below for unlimited, full-resolution, watermark-free generation.
                  </p>
                </div>
              )}
            </div>

            {/* Feature row */}
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Flame, title: "No filter", body: "Prompts the standard models reject just work." },
                { icon: Shield, title: "Private by default", body: "Uncensored creations can't enter the gallery or share links." },
                { icon: Bitcoin, title: "Pay with crypto", body: "Bitcoin via BTCPay. No card, no name on a statement, discreet billing." },
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
            <div className="mt-10 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/10 to-transparent p-6 sm:p-8">
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
                    Scan the QR or copy the address from the invoice above. After the
                    payment confirms on-chain, this page unlocks automatically.
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
                      <div className="text-2xl font-bold">${p.priceUsd}</div>
                      <div className="mt-1 text-sm font-medium">{p.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.durationDays} day{p.durationDays > 1 ? "s" : ""} · {p.bonusCredits} credits
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground/80">{p.tagline}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                One-time payment, no auto-renew. Pay anonymously with Bitcoin.
              </p>

              {!active && !ageConfirmed && (
                <label className="mt-5 flex items-center justify-center gap-2 text-sm">
                  <Checkbox checked={ageChecked} onCheckedChange={(v) => setAgeChecked(!!v)} />
                  I confirm I am 18 years of age or older.
                </label>
              )}

              <Button
                onClick={handleStart}
                disabled={checkout.isPending || confirmAge.isPending || meLoading || status?.available === false}
                size="lg"
                className="mt-5 w-full bg-gradient-to-r from-rose-500 to-orange-500 text-base font-semibold hover:opacity-90"
              >
                {checkout.isPending || confirmAge.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating invoice…</>
                ) : !isAuthed ? (
                  <><Lock className="mr-2 h-5 w-5" /> Sign in to continue</>
                ) : (
                  <><Bitcoin className="mr-2 h-5 w-5" /> Pay ${selectedPlan?.priceUsd ?? 19} with crypto</>
                )}
              </Button>

              {status?.available === false && (
                <p className="mt-3 text-center text-xs text-amber-500">
                  Crypto checkout is temporarily unavailable. Check back shortly.
                </p>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                After payment confirms on-chain, this page unlocks automatically.
              </p>
                </>
              )}
            </div>

            {/* How crypto payment works — kills the "I don't know how to pay" objection */}
            <div className="mt-14">
              <h2 className="text-center text-xl font-semibold">Pay with crypto in about 2 minutes</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Wallet, step: "1", title: "Get a little Bitcoin", body: "A few dollars in any wallet or app works — Cash App, Strike, Coinbase, or an exchange you already use." },
                  { icon: QrCode, step: "2", title: "Scan the invoice", body: "Tap the crypto button and the invoice appears right here with a QR code. Scan it or copy the Bitcoin address into your wallet." },
                  { icon: Zap, step: "3", title: "Unlock automatically", body: "Once the payment confirms, this page unlocks on its own — usually within minutes. No waiting on support." },
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
              <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                {[
                  { slug: "no-filter", label: "AI image generator — no filter" },
                  { slug: "unfiltered", label: "Unfiltered AI image generator" },
                  { slug: "no-restrictions", label: "No restrictions" },
                  { slug: "private-crypto", label: "Private — pay with crypto" },
                  { slug: "flux-uncensored", label: "Flux uncensored online" },
                  { slug: "realistic", label: "Realistic" },
                  { slug: "anime", label: "Anime" },
                  { slug: "fantasy", label: "Fantasy" },
                  { slug: "cyberpunk", label: "Cyberpunk" },
                  { slug: "midjourney-nsfw-alternative", label: "Midjourney NSFW alternative" },
                  { slug: "civitai-alternative-online", label: "Civitai alternative (online)" },
                  { slug: "stable-diffusion-no-filter-online", label: "Stable Diffusion no filter online" },
                  { slug: "ai-video-generator-uncensored", label: "Uncensored AI video generator" },
                  { slug: "nsfw-ai-video-generator", label: "NSFW AI video generator" },
                  { slug: "image-to-video-nsfw", label: "Image to video (NSFW)" },
                ].map((l) => (
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
