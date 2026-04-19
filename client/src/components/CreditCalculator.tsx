import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SUBSCRIPTION_PLANS, MODEL_CREDIT_COSTS } from "@shared/creditCosts";
import { Calculator, Sparkles } from "lucide-react";

/**
 * Credit calculator: prospects translate "I want X images + Y videos / month"
 * into the cheapest plan that covers their usage. Removes the most-asked
 * pre-purchase question ("how many images do I get?") from the funnel.
 *
 * Pure-frontend, no backend coupling. Uses the same MODEL_CREDIT_COSTS the
 * server uses for deduction so the math stays honest.
 */

// Use STANDARD-tier costs for the estimate — matches what most paid users
// will pick by default. Premium users can read the badge and adjust.
const COST_PER_IMAGE = MODEL_CREDIT_COSTS.image.standard; // 5
const COST_PER_VIDEO = MODEL_CREDIT_COSTS.video.standard; // 40
const COST_PER_TOOL = 8; // average across TOOL_CREDIT_COSTS (5-15 typical)

const PLANS_BY_PRICE = [...SUBSCRIPTION_PLANS]
  .filter((p) => p.price > 0)
  .sort((a, b) => a.price - b.price);

const MAX_PLAN = SUBSCRIPTION_PLANS[SUBSCRIPTION_PLANS.length - 1];

function dollars(cents: number) {
  return cents % 100 === 0
    ? `$${cents / 100}`
    : `$${(cents / 100).toFixed(2)}`;
}

export function CreditCalculator() {
  const [images, setImages] = useState(50);
  const [videos, setVideos] = useState(2);
  const [tools, setTools] = useState(20);

  const breakdown = useMemo(
    () => [
      { label: `${images} image${images === 1 ? "" : "s"}`, credits: images * COST_PER_IMAGE, perUnit: `${COST_PER_IMAGE} cr each` },
      { label: `${videos} video${videos === 1 ? "" : "s"}`, credits: videos * COST_PER_VIDEO, perUnit: `${COST_PER_VIDEO} cr each` },
      { label: `${tools} tool use${tools === 1 ? "" : "s"}`, credits: tools * COST_PER_TOOL, perUnit: `~${COST_PER_TOOL} cr each` },
    ],
    [images, videos, tools],
  );
  const totalCredits = breakdown.reduce((sum, row) => sum + row.credits, 0);

  const recommended = useMemo(() => {
    const fit = PLANS_BY_PRICE.find((p) => p.monthlyCredits >= totalCredits);
    return fit ?? MAX_PLAN;
  }, [totalCredits]);

  const overage = Math.max(0, totalCredits - recommended.monthlyCredits);
  const headroom = Math.max(0, recommended.monthlyCredits - totalCredits);
  const costPerCredit = recommended.price > 0
    ? recommended.price / 100 / recommended.monthlyCredits
    : 0;

  return (
    <section className="py-20 border-t border-border/50 bg-card/20">
      <div className="container">
        <div className="text-center mb-10">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
          >
            Which plan do I need?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.05 }}
            className="text-muted-foreground max-w-xl mx-auto"
          >
            Drag the sliders to match your typical month — we'll point you at the
            cheapest plan that covers it.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Inputs */}
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur">
            <div className="flex items-center gap-2 mb-5 text-sm font-medium text-muted-foreground">
              <Calculator className="h-4 w-4" />
              Your monthly usage
            </div>

            <Slider
              label="Images"
              value={images}
              onChange={setImages}
              min={0}
              max={1000}
              step={10}
              hint={`${images * COST_PER_IMAGE} credits`}
            />
            <Slider
              label="Videos (10-15s)"
              value={videos}
              onChange={setVideos}
              min={0}
              max={50}
              step={1}
              hint={`${videos * COST_PER_VIDEO} credits`}
            />
            <Slider
              label="Tool uses (upscale, headshot, etc.)"
              value={tools}
              onChange={setTools}
              min={0}
              max={500}
              step={5}
              hint={`~${tools * COST_PER_TOOL} credits`}
            />

            <div className="mt-6 pt-5 border-t border-border/40 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Estimated monthly credits</span>
              <span className="text-2xl font-bold tabular-nums">
                {totalCredits.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 p-6 backdrop-blur relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-cyan-300">
                <Sparkles className="h-4 w-4" />
                Recommended plan
              </div>

              <h3 className="text-3xl font-bold mb-1">{recommended.displayName}</h3>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-4xl font-bold tabular-nums">{dollars(recommended.price)}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
                {recommended.yearlyPrice > 0 && (
                  <span className="ml-2 text-xs text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    or {dollars(recommended.yearlyPrice)}/yr — save 20%
                  </span>
                )}
              </div>

              <div className="space-y-3 text-sm mb-6">
                <Row label="Plan credits" value={recommended.monthlyCredits.toLocaleString() + " / mo"} />
                <Row label="Your estimated need" value={totalCredits.toLocaleString()} />
                {overage > 0 ? (
                  <Row
                    label="Over plan limit by"
                    value={`+${overage.toLocaleString()} credits`}
                    accent="warn"
                  />
                ) : (
                  <Row
                    label="Headroom"
                    value={`${headroom.toLocaleString()} credits left`}
                    accent="ok"
                  />
                )}
                {recommended.price > 0 && (
                  <Row
                    label="Effective rate"
                    value={`$${costPerCredit.toFixed(4)} per credit`}
                  />
                )}
              </div>

              <a
                href="#plans"
                className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition"
              >
                See full {recommended.displayName} plan details ↑
              </a>

              <p className="text-xs text-muted-foreground/80 mt-4 leading-relaxed">
                Estimates use standard-tier model costs. Premium ({MODEL_CREDIT_COSTS.image.premium} cr/image, {MODEL_CREDIT_COSTS.video.premium} cr/video) and ultra cost more; free models cost less. Tool costs vary 0-25 credits per use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint: string;
}) {
  return (
    <label className="block mb-5 last:mb-0">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          <span className="text-foreground font-semibold">{value}</span>
          <span className="mx-1.5 opacity-60">·</span>
          <span>{hint}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "ok" | "warn";
}) {
  const valueClass =
    accent === "ok"
      ? "text-emerald-300"
      : accent === "warn"
        ? "text-amber-300"
        : "text-foreground";
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
