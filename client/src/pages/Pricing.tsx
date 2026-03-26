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
} from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { CREDIT_PACKS } from "@shared/creditCosts";

/* ── Animation variants ── */
const fadeUp = {
  hidden: (i: number) => ({ opacity: 0, y: 24, transition: { duration: 0.5, delay: i * 0.1 } }),
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const scaleIn = {
  hidden: (i: number) => ({ opacity: 0, scale: 0.95, transition: { duration: 0.4, delay: i * 0.12 } }),
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.4, delay: i * 0.12 } }),
};

type BillingPeriod = "monthly" | "yearly";

/* ── Plan card data ── */
const plans = [
  {
    name: "Explorer",
    icon: Sparkles,
    description: "100 free images/day, 5 songs, 3 videos. Watermarked outputs, non-commercial.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: "100/day",
    gradient: "from-slate-500 to-zinc-400",
    borderColor: "border-border/50",
    popular: false,
    cta: "Start Free",
    ctaVariant: "outline" as const,
  },
  {
    name: "Pro",
    icon: Zap,
    description: "No watermarks, commercial rights, HD exports. For creators who post content.",
    monthlyPrice: 12,
    yearlyPrice: 115,
    credits: "5,000",
    gradient: "from-cyan-500 to-blue-400",
    borderColor: "border-cyan-500/30",
    popular: true,
    cta: "Go Pro",
    ctaVariant: "default" as const,
  },
  {
    name: "Studio",
    icon: Crown,
    description: "Unlimited music videos, song stems, MIDI export. Sell on marketplace.",
    monthlyPrice: 29,
    yearlyPrice: 276,
    credits: "15,000",
    gradient: "from-violet-500 to-fuchsia-400",
    borderColor: "border-violet-500/50",
    popular: false,
    cta: "Go Studio",
    ctaVariant: "outline" as const,
  },
  {
    name: "Enterprise",
    icon: Gem,
    description: "API access, 5 team seats, white-label exports. For agencies and businesses.",
    monthlyPrice: 79,
    yearlyPrice: 756,
    credits: "50,000",
    gradient: "from-cyan-500 to-purple-500",
    borderColor: "border-cyan-500/30",
    popular: false,
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
  },
];

/* ── Feature comparison rows ── */
const comparisonFeatures: { label: string; values: (string | boolean)[] }[] = [
  { label: "Credits", values: ["100/day", "5,000/mo", "15,000/mo", "50,000/mo"] },
  { label: "Watermark-free", values: [false, true, true, true] },
  { label: "Commercial rights", values: [false, true, true, true] },
  { label: "AI models", values: ["Free models", "All 20 models", "All 20 models", "All + priority"] },
  { label: "Image resolution", values: ["1024px", "2048px (HD)", "4096px (4K)", "4096px (4K)"] },
  { label: "Video exports", values: ["480p watermarked", "1080p HD", "4K", "4K"] },
  { label: "Song creation", values: ["5/day watermarked", "100/mo", "Unlimited", "Unlimited"] },
  { label: "Song stems + MIDI", values: [false, false, true, true] },
  { label: "Music Video Studio", values: ["1/day", "10/mo", "Unlimited", "Unlimited"] },
  { label: "Social templates", values: ["Watermarked", true, true, true] },
  { label: "Marketplace selling", values: [false, false, "85% rev share", "85% rev share"] },
  { label: "API access", values: [false, false, false, "2,000 req/hr"] },
  { label: "Team seats", values: [false, false, false, "5 seats"] },
  { label: "Batch generation", values: [false, true, "Up to 20", "Up to 50"] },
  { label: "Brand kits", values: [false, "1", "5", "Unlimited"] },
  { label: "Priority queue", values: [false, true, true, true] },
  { label: "White-label exports", values: [false, false, false, true] },
];

/* ── FAQ data ── */
const faqs = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you get immediate access to the new features and a prorated credit top-up. When downgrading, the change takes effect at the end of your billing period.",
  },
  {
    q: "What are credits and how do they work?",
    a: "Credits are the universal currency for all AI operations on DreamForgeX. Different tasks cost different amounts — a basic image costs 5 credits, an HD image costs 10, and video generation starts at 50 credits. Your credits refresh each billing cycle.",
  },
  {
    q: "Do unused credits roll over?",
    a: "Subscription credits do not roll over to the next month. However, credits purchased from Credit Packs never expire and are always available in your account.",
  },
  {
    q: "Can I buy extra credits without upgrading?",
    a: "Absolutely! Credit Packs are one-time purchases available to any plan, including Free. They're perfect for when you need a boost without committing to a higher tier.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and PayPal. Enterprise customers can also pay via invoice with net-30 terms.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "The Free plan itself is a great way to try DreamForgeX with 1,500 credits per month. No credit card required. When you're ready for more, upgrade instantly.",
  },
  {
    q: "What's included in the commercial license?",
    a: "Creator, Pro, and Studio plans include a commercial license that lets you use all AI-generated content for business purposes — marketing materials, client work, merchandise, and more.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, cancel anytime from your account settings. You'll keep access to your plan's features until the end of the current billing period. Your generated content remains yours forever.",
  },
];

/* ── Credit pack helpers ── */
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

/* ══════════════════════════════════════════════════════ */
export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <PageLayout>
      {/* ═══════ HERO ═══════ */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />
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
            Start free with 1,500 credits. Upgrade when you need more power. No hidden fees, cancel anytime.
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

      {/* ═══════ PLAN CARDS ═══════ */}
      <section className="pb-24 relative">
        <div className="container">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.map((plan, i) => {
              const monthlyPrice = plan.monthlyPrice;
              const annualMonthly = plan.yearlyPrice > 0 ? Math.round(plan.yearlyPrice / 12) : 0;
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
                        <span className="text-4xl font-bold">${displayPrice}</span>
                        {displayPrice > 0 && <span className="text-muted-foreground text-sm">/ month</span>}
                      </div>
                      {billing === "yearly" && plan.yearlyPrice > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">${plan.yearlyPrice} billed annually</p>
                      )}
                      {displayPrice === 0 && <p className="text-xs text-emerald-400 mt-1">Free forever</p>}
                    </div>

                    {/* Credits badge */}
                    <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm font-semibold">{plan.credits}</span>
                      <span className="text-xs text-muted-foreground">credits / month</span>
                    </div>

                    {/* CTA — pushed to bottom */}
                    <div className="mt-auto">
                      {plan.name === "Studio" ? (
                        <Button
                          variant="outline"
                          className="w-full gap-2 bg-transparent"
                          onClick={() => {
                            window.location.href = "mailto:hello@dreamforgex.ai?subject=Studio%20Plan%20Inquiry";
                          }}
                        >
                          <Mail className="h-4 w-4" />
                          {plan.cta}
                        </Button>
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
                      ) : plan.name === "Free" ? (
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
                      {(plan.name === "Explorer"
                        ? [
                            "100 free images / day",
                            "5 songs / day (watermarked)",
                            "3 videos / day (480p, watermarked)",
                            "1 music video / day",
                            "All 58+ tools (with limits)",
                            "Community gallery access",
                            "Non-commercial use only",
                          ]
                        : plan.name === "Pro"
                          ? [
                              "5,000 credits / month",
                              "No watermarks on any output",
                              "Commercial use rights",
                              "All 20 AI models",
                              "HD exports (2048px / 1080p)",
                              "100 songs / month",
                              "10 music videos / month",
                              "Priority queue",
                              "1 brand kit",
                              "Batch generation",
                            ]
                          : plan.name === "Studio"
                            ? [
                                "15,000 credits / month",
                                "Everything in Pro",
                                "4K video exports",
                                "Unlimited music videos",
                                "Song stems + MIDI export",
                                "Sell on marketplace (85%)",
                                "5 brand kits",
                                "Batch generation (up to 20)",
                                "Credit rollover (10,000)",
                                "Priority support",
                              ]
                            : [
                                "50,000 credits / month",
                                "Everything in Studio",
                                "API access (2,000 req/hr)",
                                "5 team seats",
                                "White-label exports",
                                "Unlimited brand kits",
                                "Batch generation (up to 50)",
                                "Credit rollover (30,000)",
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
        </div>
      </section>

      {/* ═══════ TIER SHOWCASE — What Each Plan Creates ═══════ */}
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
              See What Each Tier{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Creates
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
              Higher tiers unlock better models, higher resolution, and more creative tools
            </motion.p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                tier: "Free",
                gradient: "from-slate-500 to-zinc-400",
                label: "Standard Quality",
                images: ["/showcase/gallery-13.jpg", "/showcase/gallery-15.jpg"],
              },
              {
                tier: "Creator",
                gradient: "from-cyan-500 to-blue-400",
                label: "HD Quality",
                images: ["/showcase/gallery-14.jpg", "/showcase/tool-headshot.jpg", "/showcase/gallery-16.jpg"],
              },
              {
                tier: "Pro",
                gradient: "from-violet-500 to-fuchsia-400",
                label: "Ultra HD + Video",
                images: ["/showcase/gallery-17.jpg", "/showcase/tool-style-transfer.jpg", "/showcase/gallery-18.jpg"],
              },
              {
                tier: "Studio",
                gradient: "from-cyan-500 to-purple-500",
                label: "Custom Models",
                images: ["/showcase/gallery-19.jpg", "/showcase/tool-charsheet.jpg", "/showcase/gallery-20.jpg"],
              },
            ].map((col, i) => (
              <motion.div
                key={col.tier}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="space-y-3"
              >
                <div className="text-center mb-4">
                  <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${col.gradient} text-white`}>
                    {col.tier}
                  </span>
                  <p className="text-xs text-muted-foreground mt-2">{col.label}</p>
                </div>
                {col.images.map((img, j) => (
                  <div key={j} className="rounded-xl overflow-hidden group">
                    <img
                      src={img}
                      alt={`${col.tier} tier example`}
                      className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ BEFORE/AFTER DEMO ═══════ */}
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
              The{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                DreamForge
              </span>{" "}
              Difference
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground max-w-lg mx-auto"
            >
              Pro and Studio users get access to 4x upscaling, style transfer, and 58+ AI tools
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { label: "4x AI Upscaler", before: "/showcase/demo-upscale-before.jpg", after: "/showcase/demo-upscale-after.jpg" },
              { label: "Style Transfer", before: "/showcase/demo-style-before.jpg", after: "/showcase/demo-style-after.jpg" },
              { label: "Background Replace", before: "/showcase/demo-bg-before.jpg", after: "/showcase/demo-bg-after.jpg" },
            ].map((demo, i) => (
              <motion.div
                key={demo.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-0.5 p-0.5">
                  <div className="relative aspect-square overflow-hidden rounded-tl-xl">
                    <img src={demo.before} alt="Before" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-black/60 text-white/80">BEFORE</span>
                  </div>
                  <div className="relative aspect-square overflow-hidden rounded-tr-xl">
                    <img src={demo.after} alt="After" className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/80 text-black">AFTER</span>
                  </div>
                </div>
                <div className="p-4 text-center">
                  <p className="text-sm font-semibold">{demo.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">Available on Creator, Pro & Studio</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURE COMPARISON TABLE ═══════ */}
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
            className="max-w-5xl mx-auto overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-4 pr-4 font-medium text-muted-foreground w-1/4">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.name} className="text-center py-4 px-3 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <plan.icon className="h-4 w-4" />
                        <span className={plan.popular ? "text-violet-400" : ""}>{plan.name}</span>
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
                      <td key={ci} className="py-3 px-3 text-center">
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
          </motion.div>
        </div>
      </section>

      {/* ═══════ CREDIT PACKS ═══════ */}
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

      {/* ═══════ FAQ ═══════ */}
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

      {/* ═══════ TRUST BADGES ═══════ */}
      <section className="py-16 border-t border-border/50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { icon: Shield, label: "Secure & Private", desc: "Your creations are yours" },
              { icon: Zap, label: "Fast Rendering", desc: "Results in seconds" },
              { icon: Users, label: "10K+ Creators", desc: "Growing community" },
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

      {/* ═══════ ENTERPRISE CTA ═══════ */}
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
              <span className="text-sm font-medium text-cyan-300">Enterprise</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Need More?{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Let's Talk.
              </span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Custom credit allocations, unlimited team seats, SLA guarantees, dedicated support, and on-premise
              deployment options for organizations of any size.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="font-medium gap-2 px-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0"
                onClick={() => {
                  window.location.href = "mailto:hello@dreamforgex.ai?subject=Enterprise%20Plan%20Inquiry";
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
