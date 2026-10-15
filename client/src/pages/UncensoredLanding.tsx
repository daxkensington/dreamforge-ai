"use client";

import { motion } from "framer-motion";
import {
  Flame,
  Bitcoin,
  Shield,
  ArrowRight,
  Check,
  Sparkles,
  Wand2,
  Paintbrush,
  Grid2x2,
  Shirt,
  Film,
  Images,
  Coins,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { UNCENSORED_SILO_LINKS, type UncensoredLanding as Landing } from "@shared/uncensoredLanding";
import {
  FREE_UNCENSORED_PREVIEWS,
  UNCENSORED_ENTRY_PLAN,
  UNCENSORED_PLANS,
} from "@shared/uncensoredPlans";
import { UNCENSORED_CHARACTER_ARCHETYPES } from "@shared/uncensoredStudio";

const STUDIO_TOOLS = [
  { icon: Sparkles, name: "Create & Face Lock", previewImg: "/showcase/uncensored-char-valentina-glam.jpg", desc: "Photoreal, anime, dark fantasy & 60+ director chips with IP-Adapter identity lock." },
  { icon: Wand2, name: "Refine & Relight", previewImg: "/showcase/tool-relight.jpg", desc: "Img2img polish + 8 instant lighting presets, 4K upscale & background removal." },
  { icon: Paintbrush, name: "Brush Inpaint", previewImg: "/showcase/tool-inpaint.jpg", desc: "Paint over any region to swap wardrobe, fix hands, or restyle details with feathered blending." },
  { icon: Grid2x2, name: "4-View Character Sheet", previewImg: "/showcase/tool-character-sheet.jpg", desc: "Parallel front, 3/4, side & back turnaround views + 1-click 2×2 master PNG export." },
  { icon: Shirt, name: "Virtual Outfit Swap", previewImg: "/showcase/tool-virtual-tryon.jpg", desc: "10 one-click wardrobe presets or copy any garment reference photo onto your character." },
  { icon: Film, name: "Uncensored Video (Wan 2.1)", previewImg: "/showcase/tool-i2v.jpg", desc: "Turn any still or prompt into smooth 5–10s unfiltered motion clips on dedicated GPUs." },
  { icon: Images, name: "100% Private Vault", previewImg: "/showcase/demo-upscale-after.jpg", desc: "Never indexed or shared publicly. Recreate any image's exact seed & settings in 1 click." },
];

/**
 * Renders one /uncensored/<slug> SEO landing page from registry data. All copy
 * is data-driven (shared/uncensoredLanding.ts) so the silo scales without new
 * components. Each page funnels into the free previews on /uncensored,
 * with the full pass ladder priced from shared/uncensoredPlans.ts.
 */
export default function UncensoredLanding({ page }: { page: Landing }) {
  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl px-4 py-16">
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

        {/* 4-Card Hero Visual Showcase */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {UNCENSORED_CHARACTER_ARCHETYPES.slice(0, 4).map((arch) => (
            <Link
              key={arch.id}
              href={`/uncensored?start=1&prompt=${encodeURIComponent(arch.prompt)}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-rose-500/30 bg-black text-left shadow-lg transition-all hover:-translate-y-0.5 hover:border-rose-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={arch.imageUrl}
                alt={arch.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
              <span className="absolute top-2.5 left-2.5 rounded-full border border-rose-500/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
                {arch.style}
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="text-sm font-bold text-white">{arch.name}</div>
                <div className="text-[11px] text-zinc-300">{arch.tagline}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-rose-300">
                  <Sparkles className="h-3 w-3" /> Try free →
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Intro */}
        <div className="mt-8 space-y-4 text-lg text-muted-foreground">
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
            <span className="text-xs text-muted-foreground">or {UNCENSORED_ENTRY_PLAN.creditPrice} credits</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            No content filter · private by default · unlock instantly with Card / Apple Pay (Credits) or Bitcoin.
          </p>

          <div className="mt-5 flex flex-wrap items-stretch justify-center gap-2">
            {UNCENSORED_PLANS.map((p) => (
              <div
                key={p.id}
                className={`min-w-[9rem] flex-1 rounded-xl border px-3 py-2.5 text-left ${
                  p.highlight ? "border-rose-500/50 bg-rose-500/10" : "border-border/60 bg-card/40"
                }`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-sm font-semibold">${p.priceUsd}</span>
                  <span className="text-[10px] text-rose-300">{p.creditPrice} cr</span>
                </div>
                <div className="text-xs text-muted-foreground">{p.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {p.durationDays} {p.durationDays === 1 ? "day" : "days"} · +{p.bonusCredits} bonus cr
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
            No card needed for free previews. Ready for the full 7-tool studio?{" "}
            <Link href="/uncensored" className="underline underline-offset-2 hover:text-rose-400">
              <Coins className="mr-1 inline h-3 w-3 text-rose-400" />
              Unlock with Credits or Bitcoin →
            </Link>
          </p>
        </div>

        {/* Sample concepts — clickable 1-click triggers into /uncensored?start=1&prompt=... */}
        {page.sampleConcepts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-center text-xl font-semibold">Click any concept to generate free</h2>
            <p className="mt-1 text-center text-xs text-muted-foreground">
              Opens the Uncensored generator with this prompt pre-loaded — {FREE_UNCENSORED_PREVIEWS} free renders included
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {page.sampleConcepts.map((c) => (
                <Link
                  key={c}
                  href={`/uncensored?start=1&prompt=${encodeURIComponent(c)}`}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-card/50 px-3.5 py-1.5 text-sm text-foreground/85 transition-all hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-200"
                >
                  <Flame className="h-3.5 w-3.5 text-rose-400 transition-transform group-hover:scale-110" />
                  <span>{c}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-300 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 7 Pro Studio Tools Included */}
        <div className="mt-12">
          <div className="text-center">
            <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
              Full 7-Tool Suite
            </span>
            <h2 className="mt-2 text-xl font-semibold">Everything included in the Uncensored Studio</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every pass unlocks all 7 specialized unfiltered workflows in one private workspace
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {STUDIO_TOOLS.map((t) => (
              <Link
                key={t.name}
                href="/uncensored"
                className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3.5 transition-colors hover:border-rose-500/40 hover:bg-rose-500/5"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-rose-500/30 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.previewImg}
                    alt={t.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-rose-300">
                      <t.icon className="h-3.5 w-3.5 text-rose-400" />
                      {t.name}
                    </h3>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Flame, t: "No filter", b: "Prompts other tools reject just work — unfiltered open-source models on dedicated GPUs." },
            { icon: Shield, t: "Private by default", b: "Your generations never enter a public gallery or a share link." },
            { icon: Bitcoin, t: "Card, Credits or Crypto", b: "Unlock in 1 click with Credits (Visa, Mastercard, Apple Pay) or pay anonymously with Bitcoin." },
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

        {/* Silo cross-linking cloud so all /uncensored/* landers pass crawl equity */}
        <div className="mt-14">
          <h2 className="text-center text-lg font-semibold">Explore more uncensored studio tools</h2>
          <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
            {UNCENSORED_SILO_LINKS.filter((l) => l.slug !== page.slug).map((l) => (
              <a
                key={l.slug}
                href={`/uncensored/${l.slug}`}
                className="rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-300"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>

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
