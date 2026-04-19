import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, ArrowRight, Eye } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ToolSEOBlock } from "@/components/ToolSEOBlock";
import { ToolPageSchemas } from "@/components/ToolPageSchemas";
import { CreditCostBadge } from "@/components/CreditCostBadge";
import type { LucideIcon } from "lucide-react";

interface ToolPageLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  children: React.ReactNode;
  /**
   * Optional: explicit tool key (e.g. "pixel-art") to look up credit cost.
   * If omitted, the layout derives it from the URL slug, which works for the
   * majority of tools whose route slug matches their TOOL_CREDIT_COSTS key.
   */
  toolKey?: string;
  /** Optional: override credit cost when no static key fits. */
  costCredits?: number;
}

export default function ToolPageLayout({
  title,
  description,
  icon: Icon,
  gradient,
  children,
  toolKey,
  costCredits,
}: ToolPageLayoutProps) {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();
  // Auto-derive toolKey from "/tools/<slug>" so we don't have to touch
  // every individual tool page. CreditCostBadge silently no-ops if the
  // slug isn't in TOOL_CREDIT_COSTS (e.g., model-tier-aware tools).
  const derivedKey = toolKey ?? location.match(/^\/tools\/([\w-]+)/)?.[1];

  return (
    <PageLayout>
      <div className="min-h-[calc(100vh-4rem)]">
        {/* Header */}
        <section className="border-b border-border/50 bg-card/30">
          <div className="container py-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Link href="/tools">
                <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  All Tools
                </Button>
              </Link>

              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <CreditCostBadge toolKey={derivedKey} costCredits={costCredits} />
                  </div>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Prominent anon gate — the thin strip that used to live here was
             easy to miss, so users filled out forms then hit a failed submit.
             Now it's an unmissable full-width CTA card. Tool content below
             stays visible so the SEO copy is still crawlable and users see
             what the tool does — but the gate makes clear it needs login. */}
        {!isAuthenticated && (
          <section className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-b border-cyan-500/30">
            <div className="container py-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                    <Lock className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-base mb-0.5">Sign in free to use this tool</p>
                    <p className="text-sm text-muted-foreground">
                      50 credits / day on the free plan — no credit card required. You'll need an account before the Generate button below will work.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 w-full md:w-auto">
                  <Button
                    className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex-1 md:flex-initial"
                    onClick={() => (window.location.href = getLoginUrl())}
                  >
                    Sign in free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent flex-1 md:flex-initial"
                    asChild
                  >
                    <Link href="/pricing">See pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tool Content — preview banner above for anon users */}
        {!isAuthenticated && (
          <div className="container pt-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
              <Eye className="h-3 w-3" />
              Preview mode — sign in to generate
            </div>
          </div>
        )}
        <section className="container py-8">
          {children}
        </section>

        {/* Below-fold SEO copy — renders if this slug has entries in shared/toolSeoCopy.ts */}
        <ToolSEOBlock />

        {/* schema.org JSON-LD for rich SERP snippets (FAQ accordion, HowTo steps, SoftwareApplication card) */}
        <ToolPageSchemas />
      </div>
    </PageLayout>
  );
}
