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
  Infinity,
  Shield,
  Headphones,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";

const fadeUp = {
  hidden: (i: number) => ({ opacity: 0, y: 24, transition: { duration: 0.5, delay: i * 0.1 } }),
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const scaleIn = {
  hidden: (i: number) => ({ opacity: 0, scale: 0.95, transition: { duration: 0.4, delay: i * 0.12 } }),
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.4, delay: i * 0.12 } }),
};

type BillingPeriod = "monthly" | "yearly";

const plans = [
  {
    name: "Free",
    icon: Sparkles,
    description: "Get started with AI creation. Perfect for exploring and casual use.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    gradient: "from-slate-500 to-zinc-400",
    borderColor: "border-border/50",
    popular: false,
    cta: "Get Started Free",
    ctaVariant: "outline" as const,
    features: {
      "Image generations / month": "25",
      "Video generations / month": "5",
      "Image-to-Video animations": "3 / month",
      "AI Tools access": "Basic (Prompt Builder only)",
      "Max resolution": "512 × 768",
      "Model versions": "Standard",
      "Batch processing": false,
      "Priority rendering": false,
      "Gallery submissions": "5 / month",
      "Private generations": false,
      "API access": false,
      "Priority support": false,
    },
  },
  {
    name: "Pro",
    icon: Zap,
    description: "For serious creators who need more power and flexibility.",
    monthlyPrice: 19,
    yearlyPrice: 190,
    gradient: "from-violet-500 to-fuchsia-400",
    borderColor: "border-violet-500/50",
    popular: true,
    cta: "Upgrade to Pro",
    ctaVariant: "default" as const,
    features: {
      "Image generations / month": "500",
      "Video generations / month": "100",
      "Image-to-Video animations": "50 / month",
      "AI Tools access": "All Tools (Upscaler, Style Transfer, Background, Prompt Builder)",
      "Max resolution": "1024 × 1536",
      "Model versions": "Standard + HD",
      "Batch processing": "Up to 10 at once",
      "Priority rendering": true,
      "Gallery submissions": "Unlimited",
      "Private generations": true,
      "API access": false,
      "Priority support": false,
    },
  },
  {
    name: "Enterprise",
    icon: Crown,
    description: "Unlimited creation for teams and businesses. Custom everything.",
    monthlyPrice: 79,
    yearlyPrice: 790,
    gradient: "from-amber-500 to-orange-400",
    borderColor: "border-amber-500/50",
    popular: false,
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
    features: {
      "Image generations / month": "Unlimited",
      "Video generations / month": "Unlimited",
      "Image-to-Video animations": "Unlimited",
      "AI Tools access": "All Tools + Priority Queue",
      "Max resolution": "2048 × 2048",
      "Model versions": "All (Standard, HD, Ultra)",
      "Batch processing": "Up to 50 at once",
      "Priority rendering": true,
      "Gallery submissions": "Unlimited",
      "Private generations": true,
      "API access": true,
      "Priority support": true,
    },
  },
];

const faqs = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll get immediate access to the new features. When downgrading, the change takes effect at the end of your billing period.",
  },
  {
    q: "What happens when I hit my generation limit?",
    a: "You'll receive a notification when you're approaching your limit. Once reached, you can wait for the next billing cycle or upgrade to a higher plan for more generations.",
  },
  {
    q: "Do unused generations roll over?",
    a: "Unused generations do not roll over to the next month. Each billing cycle starts fresh with your plan's full allocation.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "New users automatically start on the Free plan, which gives you a great way to try DreamForge. You can upgrade to Pro anytime to unlock the full creative suite.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and PayPal. Enterprise customers can also pay via invoice.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Absolutely. You can cancel your subscription at any time from your profile settings. You'll retain access to your plan's features until the end of the current billing period.",
  },
];

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  const featureKeys = Object.keys(plans[0].features);

  return (
    <PageLayout>
      {/* Hero */}
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
            <Star className="h-4 w-4 text-amber-400" />
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
            Start free, upgrade when you need more. No hidden fees, no surprises.
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
              Yearly
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                SAVE 17%
              </span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-24 relative">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => {
              const price = billing === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
              const perMonth = billing === "yearly" && plan.yearlyPrice > 0
                ? Math.round(plan.yearlyPrice / 12)
                : plan.monthlyPrice;

              return (
                <motion.div
                  key={plan.name}
                  initial="hidden"
                  animate="visible"
                  variants={scaleIn}
                  custom={i}
                  className={`relative rounded-2xl border ${plan.borderColor} bg-card/50 backdrop-blur-sm overflow-hidden ${
                    plan.popular ? "ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/10" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-400" />
                  )}

                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${plan.gradient} shadow-lg`}>
                          <plan.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">{plan.name}</h3>
                        </div>
                      </div>
                      {plan.popular && (
                        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wider">
                          Most Popular
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 min-h-[40px]">
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">
                          ${price === 0 ? "0" : perMonth}
                        </span>
                        <span className="text-muted-foreground text-sm">/ month</span>
                      </div>
                      {billing === "yearly" && price > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ${price} billed annually
                        </p>
                      )}
                      {price === 0 && (
                        <p className="text-xs text-emerald-400 mt-1">Free forever</p>
                      )}
                    </div>

                    {/* CTA */}
                    {plan.name === "Enterprise" ? (
                      <Button
                        variant={plan.ctaVariant}
                        className="w-full gap-2 bg-transparent"
                        onClick={() => {
                          const { toast } = require("sonner");
                          toast.info("Enterprise plans coming soon! Contact us for early access.");
                        }}
                      >
                        {plan.cta}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : plan.name === "Pro" ? (
                      <Button
                        className="w-full gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white border-0"
                        onClick={() => {
                          const { toast } = require("sonner");
                          toast.info("Pro plan coming soon! You'll be notified when it's available.");
                        }}
                      >
                        {plan.cta}
                        <Zap className="h-4 w-4" />
                      </Button>
                    ) : (
                      isAuthenticated ? (
                        <Button asChild variant={plan.ctaVariant} className="w-full gap-2 bg-transparent">
                          <Link href="/workspace">
                            Start Creating
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant={plan.ctaVariant}
                          className="w-full gap-2 bg-transparent"
                          onClick={() => (window.location.href = getLoginUrl())}
                        >
                          {plan.cta}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )
                    )}
                  </div>

                  {/* Feature List */}
                  <div className="border-t border-border/50 p-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                      What's included
                    </p>
                    <ul className="space-y-3">
                      {featureKeys.map((key) => {
                        const value = (plan.features as Record<string, string | boolean>)[key];
                        const isIncluded = value !== false;
                        return (
                          <li key={key} className="flex items-start gap-3">
                            {isIncluded ? (
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                                <Check className="h-3 w-3 text-emerald-400" />
                              </div>
                            ) : (
                              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/30">
                                <X className="h-3 w-3 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${isIncluded ? "text-foreground" : "text-muted-foreground/50"}`}>
                                {key}
                              </span>
                              {typeof value === "string" && (
                                <span className="block text-xs text-muted-foreground mt-0.5">
                                  {value}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
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
              Compare Plans
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground max-w-lg mx-auto"
            >
              A detailed breakdown of what each plan offers.
            </motion.p>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="max-w-4xl mx-auto overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-4 pr-4 font-medium text-muted-foreground w-1/3">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.name} className="text-center py-4 px-4 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <plan.icon className="h-4 w-4" />
                        {plan.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureKeys.map((key) => (
                  <tr key={key} className="border-b border-border/30">
                    <td className="py-3 pr-4 text-muted-foreground">{key}</td>
                    {plans.map((plan) => {
                      const value = (plan.features as Record<string, string | boolean>)[key];
                      return (
                        <td key={plan.name} className="py-3 px-4 text-center">
                          {value === true ? (
                            <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                          ) : value === false ? (
                            <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                          ) : (
                            <span className="text-xs">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* Trust Badges */}
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

      {/* FAQ */}
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
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            {faqs.map((faq, i) => (
              <motion.details
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="group rounded-xl border border-border/50 bg-card/50 overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-sm font-medium hover:bg-accent/50 transition-colors list-none">
                  {faq.q}
                  <span className="ml-4 text-muted-foreground group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-6 pb-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="container relative text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-3xl md:text-4xl font-bold tracking-tight mb-6"
          >
            Start Creating Today
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-muted-foreground mb-8 max-w-md mx-auto"
          >
            Join thousands of creators using DreamForge to bring their ideas to life. No credit card required.
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
          >
            {isAuthenticated ? (
              <Button asChild size="lg" className="font-medium gap-2 px-10">
                <Link href="/workspace">
                  Open Studio
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className="font-medium gap-2 px-10"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
          </motion.div>
        </div>
      </section>
    </PageLayout>
  );
}
