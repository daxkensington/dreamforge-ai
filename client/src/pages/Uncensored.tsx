"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Flame, Lock, Shield, Bitcoin, CheckCircle2, Loader2, ArrowRight, Wallet, QrCode, Zap } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { UNCENSORED_FAQ } from "@shared/uncensoredFaq";

/**
 * /uncensored — the crypto-paid Uncensored Pass landing + checkout.
 *
 * Why this exists: real user demand on DreamForgeX skews heavily adult, and
 * the standard (SFW) generation chain rejects it. This tier monetizes that
 * demand on crypto rails ONLY — Stripe's AUP bans adult content, so the SFW
 * plans keep Stripe and this never touches it.
 *
 * Flow: 18+ attestation → "Pay with crypto" → BTCPay invoice (new tab) →
 * webhook settles → entitlement live → toggle unlocks in Workspace.
 */
export default function Uncensored() {
  const [ageChecked, setAgeChecked] = useState(false);

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

  const checkout = trpc.uncensored.createCheckout.useMutation({
    onSuccess: (data) => {
      window.open(data.checkoutLink, "_blank", "noopener");
      toast.success("Invoice opened in a new tab. This page updates once payment confirms.");
    },
    onError: (e) => toast.error(e.message),
  });

  const plan = status?.plan;
  const active = !!status?.active;
  const ageConfirmed = !!status?.ageConfirmed;

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
    checkout.mutate();
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
          </motion.div>
        ) : (
          <>
            {/* Feature row */}
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { icon: Flame, title: "No filter", body: "Prompts the standard models reject just work." },
                { icon: Shield, title: "Private by default", body: "Uncensored creations can't enter the gallery or share links." },
                { icon: Bitcoin, title: "Pay with crypto", body: "Bitcoin / Lightning via BTCPay. No card, discreet billing." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border/60 bg-card/40 p-5">
                  <f.icon className="h-6 w-6 text-rose-500" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>

            {/* Pricing / CTA */}
            <div className="mt-10 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/10 to-transparent p-8">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-bold">${plan?.priceUsd ?? 19}</span>
                <span className="text-muted-foreground">/ {plan?.durationDays ?? 30} days</span>
              </div>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Includes <strong>{plan?.bonusCredits ?? 500} bonus credits</strong>. One-time
                payment, no auto-renew.
              </p>

              {!active && !ageConfirmed && (
                <label className="mt-6 flex items-center justify-center gap-2 text-sm">
                  <Checkbox checked={ageChecked} onCheckedChange={(v) => setAgeChecked(!!v)} />
                  I confirm I am 18 years of age or older.
                </label>
              )}

              <Button
                onClick={handleStart}
                disabled={checkout.isPending || confirmAge.isPending || meLoading || status?.available === false}
                size="lg"
                className="mt-6 w-full bg-gradient-to-r from-rose-500 to-orange-500 text-base font-semibold hover:opacity-90"
              >
                {checkout.isPending || confirmAge.isPending ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Creating invoice…</>
                ) : !isAuthed ? (
                  <><Lock className="mr-2 h-5 w-5" /> Sign in to continue</>
                ) : (
                  <><Bitcoin className="mr-2 h-5 w-5" /> Pay with crypto</>
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
            </div>

            {/* How crypto payment works — kills the "I don't know how to pay" objection */}
            <div className="mt-14">
              <h2 className="text-center text-xl font-semibold">Pay with crypto in about 2 minutes</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  { icon: Wallet, step: "1", title: "Get a little Bitcoin", body: "A few dollars in any wallet or app works — Cash App, Strike, Coinbase, or an exchange you already use." },
                  { icon: QrCode, step: "2", title: "Scan the invoice", body: "Tap the crypto button and we generate a BTCPay invoice with a QR code. Pay on-chain or over Lightning." },
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

            <p className="mt-12 text-center text-xs text-muted-foreground">
              All content is AI-generated and fictional. No real individuals are depicted.
              You are responsible for complying with the laws of your jurisdiction.
            </p>
          </>
        )}
      </div>
    </PageLayout>
  );
}
