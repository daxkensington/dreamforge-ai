import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import PageLayout from "@/components/PageLayout";
import {
  Check,
  X,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Star,
  Users,
  Shield,
  Headphones,
  Gem,
  Package,
  Mail,
  ChevronDown,
  Building2,
  Rocket,
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { CREDIT_PACKS } from "@shared/creditCosts";

/* -- Animation variants -- */
const fadeUp = {
  hidden: (i: number) => ({ opacity: 0, y: 24, transition: { duration: 0.5, delay: i * 0.1 } }),
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const scaleIn = {
  hidden: (i: number) => ({ opacity: 0, scale: 0.95, transition: { duration: 0.4, delay: i * 0.12 } }),
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.4, delay: i * 0.12 } }),
};

type BillingPeriod = "monthly" | "yearly";

/* -- Plan card data -- */
const plans = [
  {
    name: "Explorer",
    tier: "free",
    icon: Sparkles,
    description: "50 credits/day, free models only. Watermarked, non-commercial.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: "50/day",
    gradient: "from-slate-500 to-zinc-400",
    borderColor: "border-border/50",
    popular: false,
    cta: "Start Free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Creator",
    tier: "creator",
    icon: Zap,
    description: "No watermarks, commercial rights, standard models. For hobbyists who share.",
    monthlyPrice: 9,
    yearlyPrice: 86,
    credits: "3,000",
    gradient: "from-cyan-500 to-blue-400",
    borderColor: "border-cyan-500/30",
    popular: false,
    cta: "Go Creator",
    ctaVariant: "default" as const,
  },
  {
    name: "Pro",
    tier: "pro",
    icon: Crown,
    description: "Quality + premium models, 1080p, priority queue. For serious creators.",
    monthlyPrice: 19,
    yearlyPrice: 182,
    credits: "10,000",
    gradient: "from-violet-500 to-fuchsia-400",
    borderColor: "border-violet-500/50",
    popular: true,
    cta: "Go Pro",
    ctaVariant: "default" as const,
  },
  {
    name: "Studio",
    tier: "studio",
    icon: Gem,
    description: "All models, 4K, stems, marketplace selling. For professional studios.",
    monthlyPrice: 39,
    yearlyPrice: 374,
    credits: "30,000",
    gradient: "from-purple-500 to-pink-400",
    borderColor: "border-purple-500/30",
    popular: false,
    cta: "Go Studio",
    ctaVariant: "outline" as const,
  },
  {
    name: "Business",
    tier: "business",
    icon: Building2,
    description: "API access, 10 team seats, 90% marketplace rev share. For companies.",
    monthlyPrice: 79,
    yearlyPrice: 758,
    credits: "100,000",
    gradient: "from-cyan-500 to-purple-500",
    borderColor: "border-cyan-500/30",
    popular: false,
    cta: "Go Business",
    ctaVariant: "outline" as const,
  },
  {
    name: "Agency",
    tier: "agency",
    icon: Rocket,
    description: "White-label, custom LoRAs, 25 seats, dedicated support. For agencies.",
    monthlyPrice: 149,
    yearlyPrice: 1430,
    credits: "300,000",
    gradient: "from-amber-500 to-orange-500",
    borderColor: "border-amber-500/30",
    popular: false,
    cta: "Go Agency",
    ctaVariant: "outline" as const,
  },
];

/* -- Feature comparison rows -- */
const comparisonFeatures: { label: string; values: (string | boolean)[] }[] = [
  { label: "Credits", values: ["50/day", "3,000/mo", "10,000/mo", "30,000/mo", "100,000/mo", "300,000/mo"] },
  { label: "Watermark-free", values: [false, true, true, true, true, true] },
  { label: "Commercial rights", values: [false, true, true, true, true, true] },
  { label: "AI models", values: ["Free only", "+ Standard", "+ Quality/Premium", "All + Ultra", "All", "All"] },
  { label: "Image resolution", values: ["1024px", "1536px", "2048px", "4096px", "4096px", "4096px"] },
  { label: "Video exports", values: ["480p", "720p", "1080p", "4K", "4K", "4K"] },
  { label: "Songs / month", values: ["5/day", "100", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Music videos / mo", values: ["1/day", "10", "Unlimited", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Song stems + MIDI", values: [false, false, false, true, true, true] },
  { label: "Batch generation", values: [false, "Up to 5", "Up to 15", "Up to 30", "Up to 50", "Up to 100"] },
  { label: "Brand kits", values: [false, "1", "3", "10", "Unlimited", "Unlimited"] },
  { label: "Team seats", values: [false, false, false, "3", "10", "25"] },
  { label: "Credit rollover", values: [false, "500", "3,000", "15,000", "50,000", "200,000"] },
  { label: "Marketplace", values: ["Browse", "Browse", "Buy", "Buy + Sell (85%)", "Buy + Sell (90%)", "Buy + Sell (90%)"] },
  { label: "API access", values: [false, false, false, false, "5K req/hr", "20K req/hr"] },
  { label: "Priority queue", values: [false, false, true, true, true, true] },
  { label: "White-label exports", values: [false, false, false, false, false, true] },
  { label: "Custom LoRAs", values: [false, false, false, false, false, "3 included"] },
  { label: "Dedicated support", values: [false, false, false, false, false, true] },
];

/* -- FAQ data -- */
const faqs = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you get immediate access to the new features and a prorated credit top-up. When downgrading, the change takes effect at the end of your billing period.",
  },
  {
    q: "What are credits and how do they work?",
    a: "Credits are the universal currency for all AI operations on DreamForgeX. Different models cost different amounts -- a free-tier image costs 2 credits, a standard model costs 5, quality 10, premium 15, and ultra models cost 25 credits. Video generation ranges from 10 to 200 credits depending on the model.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Yes! Each plan includes credit rollover. Creator rolls over up to 500, Pro up to 3,000, Studio up to 15,000, Business up to 50,000, and Agency up to 200,000 credits. Purchased credit packs never expire.",
  },
  {
    q: "Can I buy extra credits without upgrading?",
    a: "Absolutely! Credit Packs are one-time purchases available to any plan, including Free. They're perfect for when you need a boost without committing to a higher tier.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and PayPal. Business and Agency customers can also pay via invoice with net-30 terms.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "The Free plan itself is a great way to try DreamForgeX with 50 credits per day (~1,500/month). No credit card required. When you're ready for more, upgrade instantly.",
  },
  {
    q: "What's included in the commercial license?",
    a: "Creator and above plans include a commercial license that lets you use all AI-generated content for business purposes -- marketing materials, client work, merchandise, and more.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, cancel anytime from your account settings. You'll keep access to your plan's features until the end of the current billing period. Your generated content remains yours forever.",
  },
  {
    q: "What models can I use on the free tier?",
    a: "Free tier includes Gemini Imagen, Together AI, Cloudflare Workers AI for images, Veo 3 for video, and Edge TTS for speech. These are high-quality models that cost us nothing to run.",
  },
];

/* -- Credit pack helpers -- */
function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function packSavingsPercent(idx: number): string | null {
  if (idx === 0) return null;
  const basePer = CREDIT_PACKS[0].price / CREDIT_PACKS[0].credits;
  const thisPer = CREDIT_PACKS[idx].price / CREDIT_PACKS[idx].credits;
  const pct = Math.round((1 - thisPer / basePer) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

/* ====================================================== */
export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageLayout>
      {/* ======= HERO ======= */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-16 left-[15%] w-64 h-64 bg-violet-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-[10%] w-80 h-80 bg-cyan-500/8 rounded-full blur-[110px] animate-[pulse_5s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 right-[30%] w-48 h-48 bg-fuchsia-500/8 rounded-full blur-[80px] animate-[pulse_7s_ease-in-out_infinite]" />
        <div className="container relative text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm mb-8"
          >
            <Star className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-muted-foreground">Simple, transparent pricing</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            Plans for Every{" "}
            <span className="bg-gradient-to-r from-primary via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Creator
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-lg text-muted-foreground max-w-xl mx-auto mb-10"
          >
            Start free with 50 credits/day. Upgrade when you need more power. Save 20% with annual billing.
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
            className="inline-flex items-center gap-3 p-1.5 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm"
          >
            <button
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                SAVE 20%
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ======= PLAN CARDS ======= */}
      <section className="pb-24 relative">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {plans.map((plan, i) => {
              const monthlyPrice = plan.monthlyPrice;
              const annualMonthly = plan.yearlyPrice > 0 ? +(plan.yearlyPrice / 12).toFixed(2) : 0;
              const displayPrice = billing === "yearly" ? annualMonthly : monthlyPrice;

              return (
                <motion.div
                  key={plan.name}
                  initial="hidden"
                  animate="visible"
                  variants={scaleIn}
                  custom={i}
                  className={`relative rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col ${
                    plan.popular
                      ? "border-violet-500/50 ring-2 ring-violet-500/30 shadow-[0_0_40px_-10px_rgba(139,92,246,0.4)]"
                      : plan.borderColor
                  }`}
                >
                  {/* Popular gradient top bar */}
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
                  )}

                  <div className="p-6 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${plan.gradient} shadow-lg`}
                        >
                          <plan.icon className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                      </div>
                      {plan.popular && (
                        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wider">
                          Most Popular
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">{plan.description}</p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">${billing === "yearly" ? Math.round(displayPrice) : displayPrice}</span>
                        {displayPrice > 0 && <span className="text-muted-foreground text-sm">/ month</span>}
                      </div>
                      {billing === "yearly" && plan.yearlyPrice > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="line-through text-muted-foreground/60">${plan.monthlyPrice}</span>{" "}
                          billed as ${plan.yearlyPrice}/year
                        </p>
                      )}
                      {billing === "monthly" && plan.monthlyPrice > 0 && (
                        <p className="text-xs text-emerald-400 mt-1">
                          Save ${plan.monthlyPrice * 12 - plan.yearlyPrice}/yr with annual billing
                        </p>
                      )}
                      {displayPrice === 0 && <p className="text-xs text-emerald-400 mt-1">Free forever</p>}
                    </div>

                    {/* Credits badge */}
                    <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-semibold">{plan.credits}</span>
                      <span className="text-xs text-muted-foreground">credits{plan.tier === "free" ? "" : " / month"}</span>
                    </div>

                    {/* CTA -- pushed to bottom */}
                    <div className="mt-auto">
                      {plan.name === "Agency" ? (
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full gap-2 bg-transparent"
                            onClick={() => {
                              if (!isAuthenticated) {
                                window.location.href = getLoginUrl();
                              }
                            }}
                          >
                            Go Agency
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <a
                            href="mailto:hello@dreamforgex.ai?subject=Agency%20Plan%20Inquiry"
                            className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            or contact sales
                          </a>
                        </div>
                      ) : plan.popular ? (
                        <Button
                          className="w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white border-0 shadow-lg shadow-violet-500/25"
                          onClick={() => {
                            if (!isAuthenticated) {
                              window.location.href = getLoginUrl();
                            }
                          }}
                        >
                          {plan.cta}
                          <Zap className="h-4 w-4" />
                        </Button>
                      ) : plan.tier === "free" ? (
                        isAuthenticated ? (
                          <Button asChild variant="outline" className="w-full gap-2 bg-transparent">
                            <Link href="/workspace">
                              Start Creating
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full gap-2 bg-transparent"
                            onClick={() => (window.location.href = getLoginUrl())}
                          >
                            {plan.cta}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full gap-2 bg-transparent"
                          onClick={() => {
                            if (!isAuthenticated) {
                              window.location.href = getLoginUrl();
                            }
                          }}
                        >
                          {plan.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Feature checklist */}
                  <div className="border-t border-border/50 p-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                      What's included
                    </p>
                    <ul className="space-y-3">
                      {(plan.tier === "free"
                        ? [
                            "50 credits / day (~1,500/mo)",
                            "Free models only (Gemini, Together, Cloudflare, Veo 3)",
                            "5 songs / day (watermarked)",
                            "1 music video / day",
                            "1024px images / 480p video",
                            "Browse marketplace",
                            "Non-commercial use only",
                          ]
                        : plan.tier === "creator"
                          ? [
                              "3,000 credits / month",
                              "No watermarks",
                              "Commercial use rights",
                              "Standard + Free models",
                              "1536px images / 720p video",
                              "100 songs / month",
                              "10 music videos / month",
                              "1 brand kit",
                              "Batch gen (up to 5)",
                              "500 credit rollover",
                            ]
                          : plan.tier === "pro"
                            ? [
                                "10,000 credits / month",
                                "Everything in Creator",
                                "Quality + Premium models",
                                "2048px images / 1080p video",
                                "Unlimited songs & music videos",
                                "Priority queue",
                                "Marketplace buying",
                                "3 brand kits",
                                "Batch gen (up to 15)",
                                "3,000 credit rollover",
                              ]
                            : plan.tier === "studio"
                              ? [
                                  "30,000 credits / month",
                                  "Everything in Pro",
                                  "All models including Ultra",
                                  "4K video exports",
                                  "Song stems + MIDI export",
                                  "Marketplace selling (85%)",
                                  "3 team seats",
                                  "10 brand kits",
                                  "Batch gen (up to 30)",
                                  "15,000 credit rollover",
                                ]
                              : plan.tier === "business"
                                ? [
                                    "100,000 credits / month",
                                    "Everything in Studio",
                                    "API access (5,000 req/hr)",
                                    "10 team seats",
                                    "Marketplace selling (90%)",
                                    "Unlimited brand kits",
                                    "Batch gen (up to 50)",
                                    "50,000 credit rollover",
                                  ]
                                : [
                                    "300,000 credits / month",
                                    "Everything in Business",
                                    "API access (20,000 req/hr)",
                                    "25 team seats",
                                    "White-label exports",
                                    "3 custom LoRAs included",
                                    "Batch gen (up to 100)",
                                    "200,000 credit rollover",
                                    "Dedicated support",
                                  ]
                      ).map((feat) => (
                        <li key={feat} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                            <Check className="h-3 w-3 text-emerald-400" />
                          </div>
                          <span className="text-sm text-foreground">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Enterprise banner */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="mt-12 max-w-7xl mx-auto rounded-2xl border border-border/50 bg-gradient-to-r from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-sm p-8 md:p-12 text-center"
          >
            <h3 className="text-2xl md:text-3xl font-bold mb-3">Need even more?</h3>
            <p className="text-muted-foreground max-w-lg mx-auto mb-6">
              Custom plans with unlimited credits, SLA, and dedicated infrastructure.
            </p>
            <Button
              size="lg"
              className="gap-2 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0"
              onClick={() => {
                window.location.href = "mailto:hello@dreamforgex.ai?subject=Custom%20Plan%20Inquiry";
              }}
            >
              <Mail className="h-5 w-5" />
              Contact Sales
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ======= MODEL CREDIT COSTS ======= */}
      <section className="py-24 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Model-Based{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Credit Costs
              </span>
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground max-w-lg mx-auto"
            >
              Credits are charged based on which AI model you select, not just the tool you use
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Image credits */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scaleIn}
              custom={0}
              className="rounded-2xl bg-white/5 border border-white/10 p-6"
            >
              <h3 className="text-lg font-bold mb-4">Image Generation</h3>
              <div className="space-y-3">
                {[
                  { tier: "Free", models: "Gemini, Together, Cloudflare", credits: 2, color: "text-emerald-400" },
                  { tier: "Standard", models: "Grok, fal Schnell, RunPod", credits: 5, color: "text-cyan-400" },
                  { tier: "Quality", models: "fal Dev, Replicate, Seedream", credits: 10, color: "text-blue-400" },
                  { tier: "Premium", models: "DALL-E 3, Flux Pro, Kontext Pro", credits: 15, color: "text-violet-400" },
                  { tier: "Ultra", models: "DALL-E 3 HD, Flux Pro Ultra", credits: 25, color: "text-fuchsia-400" },
                ].map((row) => (
                  <div key={row.tier} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <span className={`text-sm font-semibold ${row.color}`}>{row.tier}</span>
                      <p className="text-xs text-muted-foreground">{row.models}</p>
                    </div>
                    <span className="text-sm font-bold">{row.credits} cr</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Video credits */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={scaleIn}
              custom={1}
              className="rounded-2xl bg-white/5 border border-white/10 p-6"
            >
              <h3 className="text-lg font-bold mb-4">Video Generation</h3>
              <div className="space-y-3">
                {[
                  { tier: "Free", models: "Veo 3", credits: 10, color: "text-emerald-400" },
                  { tier: "Standard", models: "fal Wan 2.5", credits: 40, color: "text-cyan-400" },
                  { tier: "Quality", models: "Kling 1.6, fal Kling", credits: 50, color: "text-blue-400" },
                  { tier: "Premium", models: "Kling 2.0", credits: 75, color: "text-violet-400" },
                  { tier: "Ultra", models: "Runway Gen-4.5, Gen-4 Turbo", credits: 200, color: "text-fuchsia-400" },
                ].map((row) => (
                  <div key={row.tier} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <span className={`text-sm font-semibold ${row.color}`}>{row.tier}</span>
                      <p className="text-xs text-muted-foreground">{row.models}</p>
                    </div>
                    <span className="text-sm font-bold">{row.credits} cr</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ======= FEATURE COMPARISON TABLE ======= */}
      <section className="py-24 border-t border-border/50 bg-card/20">
        <div className="container">
          <div className="text-center mb-16">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Compare Plans in Detail
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground max-w-lg mx-auto"
            >
              A detailed breakdown of what each plan offers so you can pick the right one.
            </motion.p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="max-w-7xl mx-auto"
          >
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-4 pr-4 font-medium text-muted-foreground w-1/7">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.name} className="text-center py-4 px-2 font-semibold">
                      <div className="flex items-center justify-center gap-1.5">
                        <plan.icon className="h-3.5 w-3.5" />
                        <span className={plan.popular ? "text-violet-400" : ""} style={{ fontSize: "0.8rem" }}>{plan.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((row) => (
                  <tr key={row.label} className="border-b border-border/30">
                    <td className="py-3 pr-4 text-muted-foreground">{row.label}</td>
                    {row.values.map((val, ci) => (
                      <td key={ci} className="py-3 px-2 text-center">
                        {val === true ? (
                          <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                        ) : val === false ? (
                          <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                        ) : (
                          <span className="text-xs">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ======= CREDIT PACKS ======= */}
      <section className="py-24 border-t border-border/50">
        <div className="container">
          <div className="text-center mb-16">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Need a{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Boost
              </span>
              ?
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground max-w-lg mx-auto"
            >
              One-time credit packs available on any plan. Purchased credits never expire.
            </motion.p>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-sm text-emerald-400 mt-2"
            >
              One-time purchases. Available on any plan, including Free. Never expire.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {CREDIT_PACKS.map((pack, i) => {
              const savings = packSavingsPercent(i);
              return (
                <motion.div
                  key={pack.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={scaleIn}
                  custom={i}
                  className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-cyan-500/30 transition-all duration-300 group"
                >
                  {savings && (
                    <span className="absolute -top-3 right-4 text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      {savings}
                    </span>
                  )}

                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 shadow-lg mb-4 group-hover:shadow-cyan-500/20 transition-shadow">
                    <Package className="h-6 w-6 text-white" />
                  </div>

                  <p className="text-2xl font-bold mb-1">{pack.credits.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mb-4">credits</p>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold">{formatPrice(pack.price)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">{pack.perCredit} per credit</p>

                  <Button
                    variant="outline"
                    className="w-full bg-transparent hover:bg-cyan-500/10 hover:border-cyan-500/30"
                    onClick={() => {
                      if (!isAuthenticated) {
                        window.location.href = getLoginUrl();
                      }
                    }}
                  >
                    Buy Credits
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======= FAQ ======= */}
      <section className="py-24 border-t border-border/50 bg-card/20">
        <div className="container">
          <div className="text-center mb-16">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Frequently Asked Questions
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground max-w-lg mx-auto"
            >
              Everything you need to know about our plans and pricing.
            </motion.p>
          </div>

          <div className="max-w-2xl mx-auto space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <motion.div
                  key={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i % 4}
                  className="rounded-xl border border-border/50 bg-card/50 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex items-center justify-between w-full cursor-pointer px-6 py-4 text-sm font-medium text-left hover:bg-accent/50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`ml-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ======= TRUST BADGES ======= */}
      <section className="py-16 border-t border-border/50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { icon: Shield, label: "Secure & Private", desc: "Your creations are yours" },
              { icon: Zap, label: "Fast Rendering", desc: "Results in seconds" },
              { icon: Users, label: "Instant Access", desc: "Start creating in seconds" },
              { icon: Headphones, label: "Support", desc: "Help when you need it" },
            ].map((badge, i) => (
              <motion.div
                key={badge.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mx-auto mb-3">
                  <badge.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-semibold">{badge.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= AGENCY CTA ======= */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="container relative">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm mb-8">
              <Crown className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">Agency</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Need More?{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Let's Talk.
              </span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Custom credit allocations, unlimited team seats, SLA guarantees, dedicated support, and white-label
              deployment options for organizations of any size.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="font-medium gap-2 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0"
                onClick={() => {
                  window.location.href = "mailto:hello@dreamforgex.ai?subject=Agency%20Plan%20Inquiry";
                }}
              >
                <Mail className="h-5 w-5" />
                Contact Sales
              </Button>
              {!isAuthenticated && (
                <Button
                  variant="outline"
                  size="lg"
                  className="font-medium gap-2 px-8 bg-transparent"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
              {isAuthenticated && (
                <Button asChild variant="outline" size="lg" className="font-medium gap-2 px-8 bg-transparent">
                  <Link href="/workspace">
                    Open Studio
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </PageLayout>
  );
}
