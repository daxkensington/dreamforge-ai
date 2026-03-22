import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Eye,
  Film,
  Play,
  Star,
  MousePointerClick,
  ChevronDown,
  Image,
  Video,
  Music,
  Users,
  ShoppingBag,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import OnboardingWizard, { useOnboarding } from "@/components/OnboardingWizard";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const galleryImages = [
  { src: "/showcase/gallery-1.jpg", alt: "Bioluminescent underwater cathedral", prompt: "Bioluminescent underwater cathedral..." },
  { src: "/showcase/gallery-2.jpg", alt: "Cyberpunk samurai in neon rain", prompt: "Cyberpunk samurai in neon rain..." },
  { src: "/showcase/gallery-3.jpg", alt: "Enchanted forest library with fireflies", prompt: "Enchanted forest library with fireflies..." },
  { src: "/showcase/gallery-4.jpg", alt: "Crystalline phoenix from supernova", prompt: "Crystalline phoenix from supernova..." },
  { src: "/showcase/gallery-5.jpg", alt: "Android portrait with clockwork mechanics", prompt: "Android portrait with clockwork mechanics..." },
  { src: "/showcase/gallery-6.jpg", alt: "Alien landscape with geometric monuments", prompt: "Alien landscape with geometric monuments..." },
];

const workflow = [
  { step: "01", icon: MousePointerClick, title: "Describe It", desc: "Type a prompt describing your vision." },
  { step: "02", icon: Sparkles, title: "Generate It", desc: "AI creates stunning visuals in seconds." },
  { step: "03", icon: Play, title: "Animate It", desc: "Turn any image into cinematic video." },
  { step: "04", icon: Star, title: "Share It", desc: "Publish and inspire the community." },
];

const tools = [
  { icon: Image, title: "Text-to-Image", desc: "Generate any scene from a text prompt", bg: "/showcase/gallery-1.jpg" },
  { icon: Film, title: "AI Video", desc: "Create animated clips from descriptions", bg: "/showcase/gallery-2.jpg" },
  { icon: Video, title: "Image-to-Video", desc: "Animate any image with cinematic motion", bg: "/showcase/gallery-3.jpg" },
  { icon: Music, title: "Audio Generation", desc: "AI-powered soundscapes and music", bg: "/showcase/gallery-4.jpg" },
  { icon: ShoppingBag, title: "Marketplace", desc: "Buy and sell AI-generated creations", bg: "/showcase/gallery-5.jpg" },
  { icon: Users, title: "Community Gallery", desc: "Discover and share trending artwork", bg: "/showcase/gallery-6.jpg" },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: stats } = trpc.gallery.stats.useQuery();
  const { completed: onboardingDone, markCompleted } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !onboardingDone) {
      setShowOnboarding(true);
    }
  }, [isAuthenticated, onboardingDone]);

  return (
    <PageLayout>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => { markCompleted(); setShowOnboarding(false); }}
          onDismiss={() => { markCompleted(); setShowOnboarding(false); }}
        />
      )}

      {/* ===== SECTION 1: HERO ===== */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center">
        {/* Full-bleed background image */}
        <img
          src="/showcase/hero-forge.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay — heavier at bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />

        <div className="container relative z-10 py-24 md:py-32 lg:py-40">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 mb-8"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-white">AI Creative Studio</span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-[1.05]"
            >
              Create{" "}
              <span className="gradient-text">Beyond</span>{" "}
              Imagination
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="text-lg md:text-xl text-white/70 mb-12 max-w-2xl mx-auto"
            >
              Turn words into stunning images, videos, and animations — powered by AI.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {isAuthenticated ? (
                <Button asChild size="lg" className="font-medium gap-2 px-8 h-13 text-base glow-primary">
                  <Link href="/workspace">
                    <Sparkles className="h-5 w-5" />
                    Start Creating
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-8 h-13 text-base glow-primary"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  <Zap className="h-5 w-5" />
                  Start Creating Free
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="font-medium gap-2 px-8 h-13 text-base bg-transparent border-white/20 hover:bg-white/10">
                <Link href="/gallery">
                  <Eye className="h-5 w-5" />
                  Explore Gallery
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40"
        >
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </motion.div>
      </section>

      {/* ===== SECTION 2: SHOWCASE GALLERY ===== */}
      <section className="py-24 md:py-32 lg:py-40 relative overflow-hidden">
        <div className="container">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-primary mb-4 uppercase tracking-[0.2em] text-center"
          >
            Made with DreamForge
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center"
          >
            What Creators Are <span className="gradient-text">Building</span>
          </motion.h2>

          {/* Masonry-style grid */}
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {galleryImages.map((img, i) => (
              <motion.div
                key={img.src}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="break-inside-avoid group relative rounded-2xl overflow-hidden"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
                />
                {/* Hover overlay with prompt */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-500 flex items-end">
                  <div className="p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <p className="text-sm text-white/90 font-medium leading-relaxed">
                      "{img.prompt}"
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 3: HOW IT WORKS ===== */}
      <section className="py-24 md:py-32 lg:py-40 relative overflow-hidden">
        <div className="container">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-primary mb-4 uppercase tracking-[0.2em] text-center"
          >
            How It Works
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center"
          >
            From Prompt to <span className="gradient-text">Motion</span> in Minutes
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {workflow.map((step, i) => (
              <motion.div
                key={step.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="text-center p-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-xs font-bold text-primary/60 uppercase tracking-widest mb-2">
                  Step {step.step}
                </p>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: POWERFUL TOOLS ===== */}
      <section className="py-24 md:py-32 lg:py-40 relative overflow-hidden">
        <div className="container">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-primary mb-4 uppercase tracking-[0.2em] text-center"
          >
            Powerful Tools
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center"
          >
            Everything You Need to <span className="gradient-text">Create</span>
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {tools.map((tool, i) => (
              <motion.div
                key={tool.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="group relative rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-500"
              >
                {/* Background thumbnail */}
                <div className="absolute inset-0">
                  <img
                    src={tool.bg}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/50" />
                </div>
                {/* Content */}
                <div className="relative p-6">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                    <tool.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">{tool.title}</h3>
                  <p className="text-sm text-muted-foreground">{tool.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 5: CTA BANNER ===== */}
      <section className="py-24 md:py-32 lg:py-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
            >
              Ready to <span className="gradient-text">Create</span>?
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-lg text-muted-foreground mb-10"
            >
              Join thousands of creators pushing the boundaries of AI art.
            </motion.p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="flex flex-col items-center gap-4"
            >
              {isAuthenticated ? (
                <Button asChild size="lg" className="font-medium gap-2 px-10 h-14 text-lg glow-primary">
                  <Link href="/workspace">
                    <ArrowRight className="h-5 w-5" />
                    Go to Studio
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-10 h-14 text-lg glow-primary"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  <ArrowRight className="h-5 w-5" />
                  Get Started Free
                </Button>
              )}
              <p className="text-xs text-muted-foreground">No credit card required</p>
            </motion.div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
