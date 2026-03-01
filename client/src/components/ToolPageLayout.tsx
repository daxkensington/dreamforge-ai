import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
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

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg mb-6`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-3">{title}</h1>
            <p className="text-muted-foreground mb-6">{description}</p>
            <Button onClick={() => (window.location.href = getLoginUrl())} size="lg">
              Sign in to Use This Tool
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

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

        {/* Tool Content */}
        <section className="container py-8">
          {children}
        </section>
      </div>
    </PageLayout>
  );
}
