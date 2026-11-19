import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, ArrowRight, Flame } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ToolSEOBlock } from "@/components/ToolSEOBlock";
import { ToolPageSchemas } from "@/components/ToolPageSchemas";
import { CreditCostBadge } from "@/components/CreditCostBadge";
import ToolSamples from "@/components/ToolSamples";
import type { LucideIcon } from "lucide-react";
import styles from "./ToolPageLayout.module.css";

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
  /** Local tools can run before sign-in. */
  requiresSignIn?: boolean;
}

export default function ToolPageLayout({
  title,
  description,
  icon: Icon,
  gradient,
  children,
  toolKey,
  costCredits,
  requiresSignIn = true,
}: ToolPageLayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const [location] = useLocation();
  // Auto-derive toolKey from "/tools/<slug>" so we don't have to touch
  // every individual tool page. CreditCostBadge silently no-ops if the
  // slug isn't in TOOL_CREDIT_COSTS (e.g., model-tier-aware tools).
  const derivedKey = toolKey ?? location.match(/^\/tools\/([\w-]+)/)?.[1];

  return (
    <PageLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={`container ${styles.headerInner}`}>
            <Link href="/tools" className={styles.back}>
              <ArrowLeft size={16} aria-hidden="true" /> All Tools
            </Link>
            <div className={styles.intro}>
              <div className={`${styles.icon} bg-gradient-to-br ${gradient}`}>
                <Icon size={22} aria-hidden="true" />
              </div>
              <div className={styles.copy}>
                <div className={styles.title}>
                  <h1>{title}</h1>
                  <CreditCostBadge toolKey={derivedKey} costCredits={costCredits} />
                </div>
                <p className={styles.description}>{description}</p>
              </div>
            </div>
          </div>
        </header>

        {requiresSignIn && !loading && !isAuthenticated && (
          <section className={styles.gate} aria-label="Tool access">
            <div className={`container ${styles.gateInner}`}>
              <div className={styles.gateCopy}>
                <div className={styles.gateIcon}>
                  <Lock size={18} aria-hidden="true" />
                </div>
                <div>
                  <p>Sign in to use this tool</p>
                  <p>A free account includes 50 daily credits. Tool costs and plan eligibility vary.</p>
                </div>
              </div>
              <div className={styles.actions}>
                <a href={getLoginUrl()} className={styles.primary}>
                  Sign in free <ArrowRight size={16} aria-hidden="true" />
                </a>
                <Link href="/pricing" className={styles.secondary}>See pricing</Link>
              </div>
            </div>
          </section>
        )}

        <section className={`container ${styles.content}`}>{children}</section>

        {/* Uncensored Studio cross-sell strip across all 70+ /tools/* pages */}
        <section className="container pb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-rose-500/25 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-orange-500/10 px-4 py-3.5">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 text-white">
                <Flame className="h-4 w-4" />
              </div>
              <div className="text-xs sm:text-sm">
                <span className="font-semibold text-foreground">Need unfiltered 18+ generation?</span>{" "}
                <span className="text-muted-foreground">
                  Uncensored Studio includes Create, Face Lock, Brush Inpaint, Outfit Swap, 4-View Sheet & Uncensored Video — private by default.
                </span>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="shrink-0 bg-gradient-to-r from-rose-500 to-orange-500 text-white hover:opacity-90"
            >
              <Link href="/uncensored?start=1">
                <Flame className="mr-1.5 h-3.5 w-3.5" />
                Try 3 Free Previews
              </Link>
            </Button>
          </div>
        </section>

        {/* Sample outputs — derived from the URL slug via TOOL_SAMPLES so
            visitors see real results before signing up (design audit #3). */}
        <ToolSamples slug={location.split("/")[2] ?? ""} />

        {/* Below-fold SEO copy — renders if this slug has entries in shared/toolSeoCopy.ts */}
        <ToolSEOBlock />

        {/* schema.org JSON-LD for rich SERP snippets (FAQ accordion, HowTo steps, SoftwareApplication card) */}
        <ToolPageSchemas />
      </div>
    </PageLayout>
  );
}
