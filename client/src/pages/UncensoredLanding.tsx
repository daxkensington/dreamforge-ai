"use client";

import { motion } from "framer-motion";
import { Flame, Bitcoin, Shield, ArrowRight, Check } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { UncensoredLanding as Landing } from "@shared/uncensoredLanding";
import {
  FREE_UNCENSORED_PREVIEWS,
  UNCENSORED_ENTRY_PLAN,
  UNCENSORED_PLANS,
} from "@shared/uncensoredPlans";

/**
 * Renders one /uncensored/<slug> SEO landing page from registry data. All copy
 * is data-driven (shared/uncensoredLanding.ts) so the silo scales without new
 * components. Each page funnels into the free previews on /uncensored,
 * with the full pass ladder priced from shared/uncensoredPlans.ts.
 */
export default function UncensoredLanding({ page }: { page: Landing }) {
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        {/* 18+ / compliance band */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-rose-300">
            18+
          </span>
          100% AI-generated · fictional characters only · no real individuals
        </div>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/30">
            <Flame className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{page.h1}</h1>
        </motion.div>

        {/* Intro */}
        <div className="mt-6 space-y-4 text-lg text-muted-foreground">
          {page.intro.split("\n").map((p) => p.trim()).filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        {/* Value bullets */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {page.bullets.map((b) => (
            <div key={b} className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/40 p-4">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <span className="text-sm">{b}</span>
            </div>
          ))}
        </div>

        {/* Pricing CTA — the whole ladder, led by the free taste.
            These landers are the site's best-ranking non-brand pages, and they
            used to show a hardcoded "$19 / 30 days": the most expensive plan,
            with no mention of the cheaper way in or of the free previews.
            Priced from the shared ladder so this can never drift from what
            checkout actually bills. */}
        <div className="mt-10 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-500/10 to-transparent p-8 text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-muted-foreground">from</span>
            <span className="text-4xl font-bold">${UNCENSORED_ENTRY_PLAN.priceUsd}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            No content filter · private by default · pay anonymously with crypto.
          </p>

          <div className="mt-5 flex flex-wrap items-stretch justify-center gap-2">
            {UNCENSORED_PLANS.map((p) => (
              <div
                key={p.id}
                className={`min-w-[9rem] flex-1 rounded-xl border px-3 py-2.5 text-left ${
                  p.highlight ? "border-rose-500/50 bg-rose-500/10" : "border-border/60 bg-card/40"
                }`}
              >
                <div className="text-sm font-semibold">${p.priceUsd}</div>
                <div className="text-xs text-muted-foreground">{p.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.durationDays} {p.durationDays === 1 ? "day" : "days"} · {p.bonusCredits} credits
                </div>
              </div>
            ))}
          </div>

          <Button
            asChild
            size="lg"
            className="mt-6 w-full max-w-sm bg-gradient-to-r from-rose-500 to-orange-500 text-base font-semibold hover:opacity-90"
          >
            {/* Lead with the free taste, not the checkout — reaching the
                paywall is the hard part; everyone who gets there converts. */}
            <Link href="/uncensored?start=1">
              <Flame className="mr-2 h-5 w-5" /> Try {FREE_UNCENSORED_PREVIEWS} free previews
            </Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            No card needed. Or{" "}
            <Link href="/uncensored" className="underline underline-offset-2 hover:text-rose-400">
              <Bitcoin className="mr-1 inline h-3 w-3" />
              get the pass now
            </Link>
            .
          </p>
        </div>

        {/* Sample concepts */}
        {page.sampleConcepts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-center text-xl font-semibold">What you can create</h2>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {page.sampleConcepts.map((c) => (
                <span key={c} className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trust row */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Flame, t: "No filter", b: "Prompts other tools reject just work — unfiltered open-source models on our own GPUs." },
            { icon: Shield, t: "Private by default", b: "Your generations never enter a public gallery or a share link." },
            { icon: Bitcoin, t: "Pay with crypto", b: "Bitcoin via BTCPay. No card, discreet billing, anonymous." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-border/60 bg-card/40 p-5">
              <f.icon className="h-6 w-6 text-rose-500" />
              <h3 className="mt-3 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.b}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        {page.faq.length > 0 && (
          <div className="mt-12">
            <h2 className="text-center text-xl font-semibold">Frequently asked questions</h2>
            <div className="mx-auto mt-6 max-w-2xl space-y-3">
              {page.faq.map((f) => (
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
        )}

        {/* Compliance footer + funnel link */}
        <p className="mt-12 text-center text-xs text-muted-foreground">
          All content is AI-generated and fictional. No real individuals are depicted. You must be 18 or
          older and responsible for complying with the laws of your jurisdiction.{" "}
          <Link href="/uncensored" className="underline underline-offset-2 hover:text-rose-400">
            Uncensored Pass details →
          </Link>
        </p>
      </div>
    </PageLayout>
  );
}
