"use client";

import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  Hammer,
  Shield,
  Type,
  Search,
  Mail,
  Layers,
  Paintbrush,
} from "lucide-react";

type EntryKind = "tools" | "resilience" | "auth" | "seo" | "infra" | "content";

type Entry = {
  date: string;           // "April 18, 2026"
  kind: EntryKind;
  title: string;
  summary: string;
  highlights: string[];
  cta?: { label: string; href: string };
};

const KIND_META: Record<EntryKind, { icon: any; color: string; label: string }> = {
  tools: { icon: Hammer, color: "from-cyan-500 to-blue-500", label: "New tools" },
  resilience: { icon: Shield, color: "from-emerald-500 to-teal-500", label: "Reliability" },
  auth: { icon: Mail, color: "from-purple-500 to-fuchsia-500", label: "Auth & accounts" },
  seo: { icon: Search, color: "from-amber-500 to-orange-500", label: "SEO & discovery" },
  infra: { icon: Layers, color: "from-rose-500 to-pink-500", label: "Infrastructure" },
  content: { icon: Paintbrush, color: "from-lime-500 to-green-500", label: "Content & marketing" },
};

const ENTRIES: Entry[] = [
  {
    date: "April 18, 2026",
    kind: "seo",
    title: "Use-case landing pages + schema.org JSON-LD",
    summary:
      "Opened a new SEO surface with curated pages for 8 audiences and wired every tool page for Google rich-result snippets.",
    highlights: [
      "/for/etsy-sellers, /for/podcasters, /for/real-estate-agents, /for/cosplayers, /for/indie-devs, /for/authors, /for/restaurants, /for/tattoo-artists",
      "Each curates 6-9 relevant tools with buyer-intent copy",
      "SoftwareApplication + FAQPage + HowTo + BreadcrumbList schemas on every tool page — eligible for FAQ accordions and how-to steps in SERPs",
    ],
    cta: { label: "Browse use-case pages", href: "/for/etsy-sellers" },
  },
  {
    date: "April 18, 2026",
    kind: "content",
    title: "40,000 words of SEO copy across 98 tool pages",
    summary:
      "Every tool page now has a structured below-fold section with intro, step-by-step usage, use cases, and FAQ.",
    highlights: [
      "Tools went from thin prompt forms to 400-word intent-matched pages",
      "Generated via structured JSON output, edited for consistency",
      "Homepage and About copy refreshed to reflect the 100+ current tool count across 6 i18n languages",
    ],
    cta: { label: "Browse all tools", href: "/tools" },
  },
  {
    date: "April 18, 2026",
    kind: "resilience",
    title: "Multi-provider fallback chains closed",
    summary:
      "Every external-provider tool now has a backup. A fal.ai or Runway outage no longer takes any tool down.",
    highlights: [
      "Relighting: fal.ai IC-Light v2 → Flux img2img fallback",
      "3D generator: fal.ai Trellis → Replicate firtoz/trellis fallback",
      "Image-to-video: Veo 3 → Runway → Kling → Replicate Minimax chain",
      "Failure telemetry flows to auto-degrade — tools flip to 'degraded' banner after sustained errors",
    ],
  },
  {
    date: "April 18, 2026",
    kind: "auth",
    title: "Magic-link sign-in via Resend is live",
    summary:
      "Email-link authentication joined Google and GitHub. Adapter-backed with JWT sessions — no password required.",
    highlights: [
      "@auth/drizzle-adapter wired with dedicated auth_users / auth_accounts / auth_sessions / verification_tokens tables",
      "Resend sending domain verified, RESEND_FROM_ADDRESS set in prod",
      "New /auth/verify-request check-your-inbox page",
      "Existing app continues to bridge via email — no downstream code changes",
    ],
    cta: { label: "Try sign-in", href: "/auth/signin" },
  },
  {
    date: "April 17, 2026",
    kind: "tools",
    title: "33 new tools shipped in three waves",
    summary:
      "Creator / commerce / niche tool catalog expanded from 68 to 101. Each tool has a Grok-generated showcase, SEO metadata, and auto-gated credit costs via the kill-switch chokepoints.",
    highlights: [
      "Wave 1 (13 tools): pixel-art, coloring-book, tattoo-design, cover-maker, pose-turnaround, photo-colorize, podcast-cover, listing-photos, real-estate-twilight, fashion-lookbook, meme-template, yt-thumbnails, ig-carousel",
      "Wave 2 (10 tools): sticker-pack, recipe-card, invitation, business-card, pet-portrait, tarot-card, movie-poster, trading-card, menu-design, greeting-card",
      "Wave 3 (10 tools): emoji-creator, brand-style-guide, event-flyer, certificate, bookmark, zine-spread, concert-poster, architecture-concept, cosplay-reference, travel-postcard",
    ],
    cta: { label: "Browse all 100+ tools", href: "/tools" },
  },
  {
    date: "April 17, 2026",
    kind: "infra",
    title: "Meta Pixel conversion tracking wired",
    summary:
      "Signup and purchase events now flow to Meta for ad attribution and lookalike audiences.",
    highlights: [
      "Lead + CompleteRegistration fire on first-auth per browser (deduped via localStorage)",
      "Purchase fires on Stripe success with value, currency, and credit package as content_ids",
      "success_url template updated to embed price server-side so client doesn't need an extra API roundtrip",
    ],
  },
  {
    date: "April 17, 2026",
    kind: "seo",
    title: "GSC sitemap programmatically submitted",
    summary:
      "All 104 URLs submitted to Google Search Console via the Webmasters API.",
    highlights: [
      "Service-account path used because Google deprecated the /ping endpoint (returns 404)",
      "Sitemap includes all tool, use-case, and core routes",
      "0 errors, 0 warnings on initial crawl — 71 URLs queued for indexing",
    ],
  },
  {
    date: "April 16, 2026",
    kind: "content",
    title: "Facebook page launched",
    summary:
      "facebook.com/dreamforgex live with full branding, 4 native videos, 6 albums of showcase art, and pinned launch post.",
    highlights: [
      "12-panel holographic futuristic command-center cover image",
      "Meta Pixel installed via NEXT_PUBLIC_META_PIXEL_ID",
      "Linked to YouTube @DreamForgeX_ai and X @dreamforgex_ai",
    ],
  },
  {
    date: "Earlier",
    kind: "infra",
    title: "Self-hosted RunPod worker",
    summary:
      "Our own GPU fleet handles 9 task types, cutting per-generation cost by 75-97% vs. API providers.",
    highlights: [
      "Flux dev/schnell/img2img with LoRA + seed support",
      "Real-ESRGAN upscaling, RMBG-2.0 background removal",
      "CatVTON virtual try-on, MusicGen stereo-large, AudioGen, Bark TTS",
      "CogVideoX-5B image-to-video",
    ],
  },
];

export default function WhatsNew() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 md:py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-300 text-xs font-medium mb-6">
              <Sparkles className="h-3 w-3" /> Changelog
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">What's new</h1>
            <p className="text-lg text-foreground/70">
              Every shipped phase, grouped by date. We build in public.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        {ENTRIES.map((e, i) => {
          const meta = KIND_META[e.kind];
          const Icon = meta.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3) }}
              className="relative rounded-2xl border border-border/30 bg-card/30 p-6 md:p-8 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 size-12 rounded-xl bg-gradient-to-br ${meta.color} shadow-lg flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                        {meta.label}
                      </span>
                      <span className="text-foreground/30">·</span>
                      <time className="text-xs text-foreground/50">{e.date}</time>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold">{e.title}</h2>
                  </div>
                </div>
              </div>

              <p className="text-foreground/75 leading-relaxed mb-5">{e.summary}</p>

              <ul className="space-y-2 mb-5">
                {e.highlights.map((h, j) => (
                  <li key={j} className="flex gap-3 text-sm">
                    <span className="flex-shrink-0 mt-2 size-1.5 rounded-full bg-cyan-400/70" />
                    <span className="text-foreground/70 leading-relaxed">{h}</span>
                  </li>
                ))}
              </ul>

              {e.cta && (
                <Link href={e.cta.href}>
                  <Button variant="outline" size="sm" className="gap-2">
                    {e.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </motion.div>
          );
        })}
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <p className="text-sm text-foreground/60">
          Want to see what's next?{" "}
          <Link href="/tools">
            <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer">Browse all 100+ tools →</span>
          </Link>
        </p>
      </section>
    </PageLayout>
  );
}
