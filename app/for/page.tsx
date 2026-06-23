"use client";

import PageLayout from "@/components/PageLayout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { USE_CASES } from "../../shared/useCaseData";

// Hub for every /for/<audience> landing page. Exists so the audience pages
// are internally linked (they were orphaned — only in the sitemap), which is
// what lets them get crawled and indexed instead of stranded.
export default function ForHub() {
  const cases = Object.values(USE_CASES);
  return (
    <PageLayout>
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-300 text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" /> Built for your work
            </span>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
              AI tools built for what you actually do
            </h1>
            <p className="text-lg md:text-xl text-foreground/70 max-w-3xl mx-auto">
              Stop renting five separate apps. Each guide below curates the exact DreamForgeX
              tools for your line of work — with commercial use included on paid plans.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((uc) => (
            <Link
              key={uc.slug}
              href={`/for/${uc.slug}`}
              className="group rounded-2xl border border-border/40 bg-card/30 p-6 transition-colors hover:border-cyan-500/40 hover:bg-card/50"
            >
              <h2 className="text-lg font-semibold capitalize flex items-center justify-between gap-3">
                For {uc.audience}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-cyan-400" />
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/65 line-clamp-3 normal-case">
                {uc.tagline}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
