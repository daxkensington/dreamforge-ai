import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Eye,
  Film,
  Play,
  Star,
  ChevronDown,
  Image,
  Video,
  Music,
  Users,
  ShoppingBag,
  Search,
  Check,
  Crown,
  Quote,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import OnboardingWizard, { useOnboarding } from "@/components/OnboardingWizard";

/* ── Animation variants ── */
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

/* ── Data ── */
const heroImages = ["/showcase/hero-forge.jpg", "/showcase/hero-2.jpg", "/showcase/hero-3.jpg"];

const galleryImages = [
  { src: "/showcase/gallery-1.jpg", prompt: "Bioluminescent underwater cathedral with jellyfish stained glass" },
  { src: "/showcase/gallery-2.jpg", prompt: "Cyberpunk samurai in neon rain, holographic katana" },
  { src: "/showcase/gallery-3.jpg", prompt: "Enchanted forest library where trees are bookshelves" },
  { src: "/showcase/gallery-4.jpg", prompt: "Crystalline phoenix emerging from a supernova" },
  { src: "/showcase/gallery-5.jpg", prompt: "Android woman with clockwork face, art nouveau" },
  { src: "/showcase/gallery-6.jpg", prompt: "Alien landscape with geometric monuments at sunset" },
  { src: "/showcase/gallery-7.jpg", prompt: "Japanese zen garden with koi pond reflecting cherry blossoms" },
  { src: "/showcase/gallery-8.jpg", prompt: "Steampunk airship battle above Victorian London" },
  { src: "/showcase/gallery-9.jpg", prompt: "Futuristic fashion model in liquid mercury clothes" },
  { src: "/showcase/gallery-10.jpg", prompt: "Ancient dragon sleeping on a mountain of gold" },
  { src: "/showcase/gallery-11.jpg", prompt: "Bioluminescent coral reef city of merfolk" },
  { src: "/showcase/gallery-12.jpg", prompt: "Surreal melting clocktower in a desert of mirrors" },
];

const beforeAfterDemos = [
  {
    label: "AI Upscaler",
    desc: "Enhance resolution up to 4x with zero quality loss",
    before: "/showcase/demo-upscale-before.jpg",
    after: "/showcase/demo-upscale-after.jpg",
  },
  {
    label: "Style Transfer",
    desc: "Apply any artistic style to your images instantly",
    before: "/showcase/demo-style-before.jpg",
    after: "/showcase/demo-style-after.jpg",
  },
  {
    label: "Background Replace",
    desc: "Swap backgrounds with AI-powered scene generation",
    before: "/showcase/demo-bg-before.jpg",
    after: "/showcase/demo-bg-after.jpg",
  },
];

const tools = [
  { icon: Image, title: "Text-to-Image", desc: "Generate any scene from a text prompt", bg: "/showcase/gallery-1.jpg", href: "/workspace" },
  { icon: Film, title: "AI Video", desc: "Create animated clips from descriptions", bg: "/showcase/gallery-2.jpg", href: "/workspace" },
  { icon: Video, title: "Image-to-Video", desc: "Animate any image with cinematic motion", bg: "/showcase/gallery-3.jpg", href: "/workspace" },
  { icon: Music, title: "Audio Generation", desc: "AI-powered soundscapes and music", bg: "/showcase/gallery-4.jpg", href: "/workspace" },
  { icon: ShoppingBag, title: "Marketplace", desc: "Buy and sell AI-generated creations", bg: "/showcase/gallery-5.jpg", href: "/gallery" },
  { icon: Users, title: "Community Gallery", desc: "Discover and share trending artwork", bg: "/showcase/gallery-6.jpg", href: "/gallery" },
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    features: ["50 images / month", "3 AI models", "Community gallery access", "720p exports"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Creator",
    price: "$12",
    period: "/mo",
    features: ["500 images / month", "All AI models", "HD exports", "Priority queue"],
    cta: "Start Creating",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$35",
    period: "/mo",
    features: ["2,500 images / month", "4K exports", "API access", "Commercial license"],
    cta: "Go Pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Studio",
    price: "$75",
    period: "/mo",
    features: ["Unlimited images", "Team collaboration", "Custom model training", "Dedicated support"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const testimonials = [
  {
    name: "Sarah Chen",
    role: "Digital Artist",
    quote: "DreamForge has completely transformed my creative workflow. I can iterate on concepts 10x faster than before.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    name: "Marcus Rivera",
    role: "Game Developer",
    quote: "The quality of the AI-generated assets is incredible. We use DreamForge for all our concept art and marketing materials.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    name: "Aisha Patel",
    role: "Content Creator",
    quote: "I went from zero design skills to creating stunning visuals for my brand. The tools are intuitive and powerful.",
    gradient: "from-orange-500 to-yellow-500",
  },
];

const statItems = [
  { label: "Images Created", target: 10000, suffix: "+" },
  { label: "Active Creators", target: 500, suffix: "+" },
  { label: "AI Tools", target: 15, suffix: "" },
  { label: "AI Models", target: 4, suffix: "" },
];

/* ── Count-up hook ── */
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

/* ── Stat item component ── */
function StatItem({ label, target, suffix }: { label: string; target: number; suffix: string }) {
  const { value, ref } = useCountUp(target);
  return (
    <div ref={ref} className="flex flex-col items-center gap-1 px-6 py-4">
      <span className="text-3xl md:text-4xl font-bold gradient-text">
        {value.toLocaleString()}{suffix}
      </span>
      <span className="text-sm text-white/60">{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: stats } = trpc.gallery.stats.useQuery();
  const { completed: onboardingDone, markCompleted } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [promptText, setPromptText] = useState("");

  useEffect(() => {
    if (isAuthenticated && !onboardingDone) setShowOnboarding(true);
  }, [isAuthenticated, onboardingDone]);

  /* Hero rotation */
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleGenerate = useCallback(() => {
    window.location.href = "/workspace";
  }, []);

  return (
    <PageLayout>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => { markCompleted(); setShowOnboarding(false); }}
          onDismiss={() => { markCompleted(); setShowOnboarding(false); }}
        />
      )}

      {/* ═══════ SECTION 1: HERO WITH VIDEO BACKGROUND ═══════ */}
      <section className="relative overflow-hidden min-h-screen flex items-center justify-center">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          poster="/showcase/hero-forge.jpg"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/video/hero-bg.mp4" type="video/mp4" />
        </video>
        {/* Fallback rotating images (behind video, shows on poster/load) */}
        {heroImages.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out -z-10"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          />
        ))}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/85" />

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
              Create <span className="gradient-text">Beyond</span> Imagination
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

      {/* ═══════ SECTION 2: LIVE STATS BAR ═══════ */}
      <section className="border-y border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {statItems.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 3: INTERACTIVE PROMPT DEMO ═══════ */}
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
            Try It Now
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-center"
          >
            Type a Prompt and See the <span className="gradient-text">Magic</span>
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="text-muted-foreground text-center mb-10 max-w-xl mx-auto"
          >
            Describe anything you can imagine and let AI bring it to life.
          </motion.p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={3}
            className="max-w-3xl mx-auto mb-14"
          >
            <div className="relative flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-purple-500/30 shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)] backdrop-blur-sm">
              <Search className="h-5 w-5 text-white/40 ml-4 shrink-0" />
              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="A mystical dragon perched on a crystal mountain..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-base py-3"
              />
              <Button
                size="lg"
                className="font-medium gap-2 px-6 h-12 text-base glow-primary shrink-0"
                onClick={handleGenerate}
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </div>
          </motion.div>

          {/* Example results */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {galleryImages.slice(0, 4).map((img, i) => (
              <motion.div
                key={img.src}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="rounded-2xl overflow-hidden aspect-square"
              >
                <img
                  src={img.src}
                  alt={img.prompt}
                  loading="lazy"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-white/30 mt-4">Example outputs generated by DreamForge</p>
        </div>
      </section>

      {/* ═══════ SECTION 4: SHOWCASE GALLERY ═══════ */}
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

          {/* Masonry grid — 4 cols on xl, 3 on lg, 2 on md, 1 on sm */}
          <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
            {galleryImages.map((img, i) => (
              <motion.div
                key={img.src}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i % 6}
                className="break-inside-avoid group relative rounded-2xl overflow-hidden"
              >
                <img
                  src={img.src}
                  alt={img.prompt}
                  loading="lazy"
                  className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-500 flex items-end">
                  <div className="p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <p className="text-sm text-white/90 font-medium leading-relaxed">
                      &ldquo;{img.prompt}&rdquo;
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 5: BEFORE/AFTER TOOL DEMOS ═══════ */}
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
            See Our Tools in Action
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center"
          >
            Transform Your Images with <span className="gradient-text">AI</span>
          </motion.h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {beforeAfterDemos.map((demo, i) => (
              <motion.div
                key={demo.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-center">{demo.label}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {/* Before */}
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={demo.before} alt={`${demo.label} before`} loading="lazy" className="w-full h-auto" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-black/70 text-white/80 backdrop-blur-sm">
                      Before
                    </span>
                  </div>
                  {/* After */}
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={demo.after} alt={`${demo.label} after`} loading="lazy" className="w-full h-auto" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-600/80 text-white backdrop-blur-sm shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                      After
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">{demo.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 6: TOOLS GRID ═══════ */}
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
              <Link key={tool.title} href={tool.href}>
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={scaleIn}
                  custom={i}
                  className="group relative rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-500 cursor-pointer"
                >
                  <div className="absolute inset-0">
                    <img
                      src={tool.bg}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/50" />
                  </div>
                  <div className="relative p-6">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                      <tool.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground">{tool.desc}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ SECTION 7: PRICING PREVIEW ═══════ */}
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
            Simple Pricing
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center"
          >
            Plans for Every <span className="gradient-text">Creator</span>
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className={`relative rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-white/10 border-2 border-purple-500/50 shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-purple-600 text-white flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      {plan.badge}
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  className={`w-full font-medium ${plan.highlighted ? "glow-primary" : ""}`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  <Link href="/pricing">{plan.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={5}
            className="text-center mt-10"
          >
            <Link href="/pricing" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              View All Plans <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════ SECTION 8: SOCIAL PROOF ═══════ */}
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
            Trusted by Creators Worldwide
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center"
          >
            What People Are <span className="gradient-text">Saying</span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-sm"
              >
                <Quote className="h-6 w-6 text-primary/40 mb-4" />
                <p className="text-sm text-white/70 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} shrink-0`} />
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={4}
            className="text-center text-muted-foreground mt-12"
          >
            Join <span className="text-white font-semibold">10,000+</span> creators already using DreamForge
          </motion.p>
        </div>
      </section>

      {/* ═══════ SECTION 9: FINAL CTA ═══════ */}
      <section className="py-24 md:py-32 lg:py-40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-primary/10 to-black/80" />
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
              Ready to Create Something <span className="gradient-text">Amazing</span>?
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-lg text-muted-foreground mb-10"
            >
              Start for free — no credit card required.
            </motion.p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="flex flex-col items-center gap-6"
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
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="/pricing" className="hover:text-white transition-colors">View Pricing</Link>
                <span className="text-white/20">|</span>
                <Link href="/gallery" className="hover:text-white transition-colors">Explore Gallery</Link>
                <span className="text-white/20">|</span>
                <Link href="/tools" className="hover:text-white transition-colors">Browse Tools</Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
