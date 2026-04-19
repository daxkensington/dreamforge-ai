"use client";

import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, X, Sparkles, Star, AlertCircle } from "lucide-react";
import type { Comparison } from "../../../shared/comparisonData";

/**
 * Renders a /vs/<competitor> comparison page from a Comparison config.
 * Pattern mirrors UseCasePage from Phase 36 — single template, data-driven.
 *
 * SEO play: targets "<competitor> alternative" and "<competitor> vs ___"
 * which the generic landing page can't compete for. Honest "where they win"
 * section is intentional: builds trust + matches how Google ranks
 * comparison content (E-E-A-T).
 */
export default function ComparisonPage({ data }: { data: Comparison }) {
  return (
    <PageLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-300 text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" /> Comparison
            </span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 leading-tight">
              DreamForgeX vs {data.competitorName}
            </h1>
            <p className="text-lg md:text-xl text-foreground/70 mb-8 max-w-3xl leading-relaxed">
              {data.heroSubtext}
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/demo/text-to-image">
                <Button size="lg" className="gap-2 font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                  Try free — no signup <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  See pricing
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intro paragraphs */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <div className="space-y-5 text-foreground/80 leading-relaxed">
          {data.introParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p className="text-sm text-muted-foreground italic">
            <strong>Pricing reference:</strong> {data.pricingSummary}
          </p>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
          Feature-by-feature
        </h2>
        <div className="rounded-2xl border border-border/50 overflow-hidden">
          <div className="grid grid-cols-3 bg-card/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/50">
            <div>Feature</div>
            <div className="text-center">{data.competitorName}</div>
            <div className="text-center text-cyan-300">DreamForgeX</div>
          </div>
          {data.comparisonRows.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 px-4 py-3 text-sm ${i % 2 === 0 ? "bg-background/40" : "bg-card/30"} border-b border-border/30 last:border-b-0`}
            >
              <div className="font-medium">{row.feature}</div>
              <div className="text-center text-muted-foreground">{row.competitor}</div>
              <div className="text-center text-foreground">{row.dreamforgex}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why DFX wins */}
      <section className="max-w-4xl mx-auto px-6 py-14">
        <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
          <Star className="h-6 w-6 text-cyan-400" />
          Where DreamForgeX wins
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.whyDfxWins.map((point) => (
            <div
              key={point}
              className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-card/40"
            >
              <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{point}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honest concessions */}
      {data.whereTheyWin.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-14">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-amber-400" />
            Where {data.competitorName} wins
          </h2>
          <p className="text-muted-foreground text-sm mb-5">
            We're not going to pretend they don't have real strengths.
          </p>
          <div className="space-y-3">
            {data.whereTheyWin.map((point) => (
              <div
                key={point}
                className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-card/40"
              >
                <X className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            See it for yourself
          </h2>
          <p className="text-muted-foreground mb-6">{data.ctaCopy}</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/demo/text-to-image">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                Generate a free image <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                Compare plans
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
