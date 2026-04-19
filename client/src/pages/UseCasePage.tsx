"use client";

import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { UseCase } from "../../../shared/useCaseData";
import { TOOL_SEO_COPY } from "../../../shared/toolSeoCopy";

export default function UseCasePage({ useCase }: { useCase: UseCase }) {
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
              <Sparkles className="h-3 w-3" /> Built for {useCase.audience}
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              {useCase.title}
            </h1>
            <p className="text-lg md:text-xl text-foreground/70 mb-8 max-w-3xl">{useCase.tagline}</p>
            <div className="flex gap-4 flex-wrap">
              <Link href="/tools">
                <Button size="lg" className="gap-2 font-semibold">
                  Browse all tools <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="gap-2">
                  See pricing
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intro + pain points */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-5 gap-12">
          <div className="md:col-span-3 space-y-5 text-base leading-relaxed text-foreground/80">
            {useCase.intro.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
          <div className="md:col-span-2">
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/60 mb-4">
                  Common pain points
                </h3>
                <ul className="space-y-3">
                  {useCase.painPoints.map((pp, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="flex-shrink-0 mt-1 text-rose-400">✕</span>
                      <span className="text-foreground/75">{pp}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Tool grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Your toolkit</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-2">Tools picked for {useCase.audience}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {useCase.tools.map((t) => {
            const copy = TOOL_SEO_COPY[t.slug];
            const title = copy?.title || t.slug.replace(/-/g, " ");
            return (
              <Link key={t.slug} href={`/tools/${t.slug}`}>
                <div className="group relative rounded-2xl overflow-hidden border border-border/30 bg-card/30 hover:border-cyan-500/40 transition-all duration-300 h-full">
                  <div className="aspect-[4/3] overflow-hidden bg-muted/30">
                    <img
                      loading="lazy"
                      src={`/showcase/tool-${t.slug}.jpg`}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => ((e.target as HTMLImageElement).src = "/showcase/gallery-4.jpg")}
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      {title}
                      <ArrowRight className="h-4 w-4 text-foreground/30 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-sm text-foreground/60 leading-relaxed">{t.why}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Outcome */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5">
          <CardContent className="p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-cyan-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">What you can ship in a day</h2>
            </div>
            <p className="text-lg leading-relaxed text-foreground/80">{useCase.outcome}</p>
            <div className="mt-8 flex gap-3 flex-wrap">
              <Link href="/tools">
                <Button size="lg" className="gap-2">
                  Start free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline">
                  See pricing
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Cross-link to other use cases */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Also serving</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {["etsy-sellers", "podcasters", "real-estate-agents", "cosplayers", "indie-devs", "authors", "restaurants", "tattoo-artists"]
            .filter((s) => s !== useCase.slug)
            .map((s) => (
              <Link key={s} href={`/for/${s}`}>
                <span className="px-4 py-2 rounded-full text-sm border border-border/30 bg-card/30 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all cursor-pointer text-foreground/80">
                  {s.replace(/-/g, " ")}
                </span>
              </Link>
            ))}
        </div>
      </section>
    </PageLayout>
  );
}
