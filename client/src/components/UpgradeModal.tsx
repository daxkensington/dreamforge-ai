/**
 * Upgrade modal — shown when free users hit limits or try premium features.
 * The #1 conversion mechanism.
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "watermark" | "limit" | "premium-model" | "commercial" | "stems" | "api" | "general";
  feature?: string;
}

const REASONS: Record<string, { title: string; subtitle: string }> = {
  watermark: {
    title: "Remove Watermarks",
    subtitle: "Upgrade to Pro to download clean, watermark-free outputs you can share anywhere.",
  },
  limit: {
    title: "Daily Limit Reached",
    subtitle: "You've used all your free generations for today. Upgrade for 5,000+ credits per month.",
  },
  "premium-model": {
    title: "Premium Model",
    subtitle: "This AI model is available on Pro and above. Upgrade to access all 20 models.",
  },
  commercial: {
    title: "Commercial Use",
    subtitle: "Free tier is for personal use only. Upgrade to Pro for full commercial rights.",
  },
  stems: {
    title: "Song Stems & MIDI",
    subtitle: "Export individual tracks and MIDI files with a Studio plan.",
  },
  api: {
    title: "API Access",
    subtitle: "Integrate DreamForgeX into your apps with our REST API on the Enterprise plan.",
  },
  general: {
    title: "Unlock More Power",
    subtitle: "Get more credits, premium models, and professional features.",
  },
};

export function UpgradeModal({ open, onClose, reason = "general", feature }: UpgradeModalProps) {
  const { title, subtitle } = REASONS[reason] || REASONS.general;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-background border-white/10">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">{title}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        {feature && (
          <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 mb-2">
            <p className="text-xs text-cyan-400">You tried to use: <span className="font-semibold">{feature}</span></p>
          </div>
        )}

        {/* Plan comparison */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pro */}
          <div className="rounded-xl bg-white/5 border border-cyan-500/30 p-4 relative">
            <Badge className="absolute -top-2 right-3 bg-cyan-500 text-white border-0 text-[10px]">Popular</Badge>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-sm">Pro</span>
            </div>
            <p className="text-2xl font-bold mb-1">$12<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            <ul className="space-y-1.5 mt-3">
              {["No watermarks", "Commercial rights", "All 20 AI models", "5,000 credits/mo", "HD exports"].map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Check className="h-3 w-3 text-cyan-400 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/pricing">
              <Button className="w-full mt-4 gap-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs h-8">
                Go Pro <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {/* Studio */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-purple-400" />
              <span className="font-bold text-sm">Studio</span>
            </div>
            <p className="text-2xl font-bold mb-1">$29<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            <ul className="space-y-1.5 mt-3">
              {["Everything in Pro", "Unlimited music videos", "Song stems + MIDI", "Sell on marketplace", "4K exports"].map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Check className="h-3 w-3 text-purple-400 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link href="/pricing">
              <Button variant="outline" className="w-full mt-4 gap-1 bg-transparent text-xs h-8">
                Go Studio <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-2">
          Cancel anytime. All plans include a 7-day money-back guarantee.
        </p>
      </DialogContent>
    </Dialog>
  );
}
