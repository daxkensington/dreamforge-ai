import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ToolSEOBlock } from "@/components/ToolSEOBlock";
import type { LucideIcon } from "lucide-react";

interface ToolPageLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  children: React.ReactNode;
}

export default function ToolPageLayout({
  title,
  description,
  icon: Icon,
  gradient,
  children,
}: ToolPageLayoutProps) {
  const { isAuthenticated } = useAuth();

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

              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{title}</h1>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Sign-in banner for unauthenticated users */}
        {!isAuthenticated && (
          <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border-b border-cyan-500/20">
            <div className="container py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span className="text-sm text-white/80">Sign in to generate — it's free to start</span>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs h-8"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Sign In Free
              </Button>
            </div>
          </div>
        )}

        {/* Tool Content — always visible */}
        <section className="container py-8">
          {children}
        </section>

        {/* Below-fold SEO copy — renders if this slug has entries in shared/toolSeoCopy.ts */}
        <ToolSEOBlock />
      </div>
    </PageLayout>
  );
}
