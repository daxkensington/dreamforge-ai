import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FlaskConical,
  Image,
  Sparkles,
  Shield,
  Download,
  Search,
  Layers,
  Zap,
  Eye,
} from "lucide-react";
import { Link } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0, 0, 0.2, 1] as const },
  }),
};

const features = [
  {
    icon: Sparkles,
    title: "Prompt Workspace",
    desc: "Craft detailed natural-language descriptions and generate 100% fictional synthetic media using state-of-the-art diffusion models.",
  },
  {
    icon: Image,
    title: "Research Gallery",
    desc: "Browse approved synthetic outputs with advanced taxonomic tagging for systematic academic study and peer review.",
  },
  {
    icon: Search,
    title: "Advanced Search",
    desc: "Filter by tags, date, model version, and themes to find exactly the synthetic outputs relevant to your research.",
  },
  {
    icon: Shield,
    title: "Moderation Queue",
    desc: "All submissions pass through a researcher-led review process ensuring quality and alignment with research ethics.",
  },
  {
    icon: Download,
    title: "Export Tools",
    desc: "Download generated assets with complete prompt metadata in structured formats ready for academic papers.",
  },
  {
    icon: Layers,
    title: "Tagging System",
    desc: "Categorize outputs across genres, themes, styles, and subjects for rigorous taxonomic analysis.",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: stats } = trpc.gallery.stats.useQuery();

  return (
    <PageLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-chart-2/5 rounded-full blur-3xl" />

        <div className="container relative py-24 md:py-32 lg:py-40">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8"
            >
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Academic Research Platform
              </span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
            >
              Explore the Frontier of{" "}
              <span className="gradient-text">Synthetic Media</span>{" "}
              Research
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              A controlled environment for scholars to study how diffusion-based models
              generate fictional, non-photorealistic visual content. Analyze creativity,
              bias, and synthetic content proliferation through peer-reviewed research.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {isAuthenticated ? (
                <Button asChild size="lg" className="font-medium gap-2 px-8">
                  <Link href="/workspace">
                    <Sparkles className="h-4 w-4" />
                    Open Workspace
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-8"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  <Zap className="h-4 w-4" />
                  Get Started
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="font-medium gap-2 px-8 bg-transparent">
                <Link href="/gallery">
                  <Eye className="h-4 w-4" />
                  Browse Gallery
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      {stats && (stats.totalItems > 0 || stats.totalGenerations > 0) && (
        <section className="border-y border-border/50 bg-card/30">
          <div className="container py-8">
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto text-center">
              <div>
                <p className="text-2xl md:text-3xl font-bold gradient-text">
                  {stats.totalGenerations.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Generations</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold gradient-text">
                  {stats.totalItems.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Gallery Items</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold gradient-text">
                  {stats.totalViews.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Research Views</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built for Rigorous Research
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every feature designed to support systematic academic study of generative AI outputs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="group relative p-6 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all duration-300"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Research Focus */}
      <section className="py-20 border-t border-border/50 bg-card/30">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Research Taxonomy
              </h2>
              <p className="text-muted-foreground">
                Our tagging system supports structured academic classification across multiple dimensions.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                { label: "Fantasy", color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
                { label: "Sci-Fi", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
                { label: "Mythological", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
                { label: "Stylized Dynamics", color: "bg-pink-500/15 text-pink-400 border-pink-500/20" },
                { label: "Abstract Eroticism", color: "bg-red-500/15 text-red-400 border-red-500/20" },
                { label: "Surreal Anatomy", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
                { label: "Cyberpunk", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
                { label: "Impressionist", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
                { label: "Biomechanical", color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
                { label: "Cosmic Horror", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
                { label: "Art Nouveau", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
                { label: "Ethereal", color: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20" },
              ].map((tag) => (
                <span
                  key={tag.label}
                  className={`px-4 py-2 rounded-full text-sm font-medium border ${tag.color}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Begin Your Research
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join scholars exploring the intersection of AI, creativity, and synthetic media generation.
            </p>
            {isAuthenticated ? (
              <Button asChild size="lg" className="font-medium gap-2 px-8">
                <Link href="/workspace">
                  Open Workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className="font-medium gap-2 px-8"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Sign in to Start
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Disclaimer */}
      <section className="pb-8">
        <div className="container">
          <DisclaimerBanner />
        </div>
      </section>
    </PageLayout>
  );
}
