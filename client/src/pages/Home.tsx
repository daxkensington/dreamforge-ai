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
  Wand2,
  Shirt,
  Box,
  LayoutGrid,
  Sun,
  Server,
  Mic,
  Palette,
  Cat,
  Moon,
  Clapperboard,
  Gamepad2,
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
  { src: "/showcase/gallery-7.jpg", prompt: "Japanese zen garden with koi pond reflecting cherry blossoms" },
  { src: "/showcase/gallery-9.jpg", prompt: "Futuristic fashion model in liquid mercury clothes" },
  { src: "/showcase/gallery-10.jpg", prompt: "Ancient dragon sleeping on a mountain of gold" },
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

const whatsNew = [
  {
    icon: Cat,
    title: "Pet Portrait",
    desc: "Royal, fantasy, and sci-fi portraits of your pet",
    href: "/tools/pet-portrait",
    img: "/showcase/tool-pet-portrait.jpg",
    tag: "New tool",
  },
  {
    icon: Moon,
    title: "Tarot Card Designer",
    desc: "Custom major arcana decks with rich symbolism",
    href: "/tools/tarot-card",
    img: "/showcase/tool-tarot-card.jpg",
    tag: "New tool",
  },
  {
    icon: Clapperboard,
    title: "Movie Poster",
    desc: "Theatrical-quality one-sheets for any genre",
    href: "/tools/movie-poster",
    img: "/showcase/tool-movie-poster.jpg",
    tag: "New tool",
  },
  {
    icon: Gamepad2,
    title: "Pixel Art Generator",
    desc: "Game-ready 8/16/32-bit sprites and scenes",
    href: "/tools/pixel-art",
    img: "/showcase/tool-pixel-art.jpg",
    tag: "New tool",
  },
  {
    icon: Palette,
    title: "Brand Style Guide",
    desc: "Logo + color palette + typography on one page",
    href: "/tools/brand-style-guide",
    img: "/showcase/tool-brand-style-guide.jpg",
    tag: "New tool",
  },
  {
    icon: Server,
    title: "Self-Hosted Audio",
    desc: "Bark TTS + MusicGen + AudioGen on our GPUs",
    href: "/tools/song-creator",
    img: "/showcase/tool-audio-self.jpg",
    tag: "Self-hosted",
  },
];

const tools = [
  { icon: Image, title: "Text-to-Image", desc: "30+ models — Flux, DALL-E 3, Gemini, Grok, Seedream", bg: "/showcase/home-tool-txtimg.jpg", href: "/workspace" },
  { icon: Film, title: "AI Video", desc: "Runway, Kling, Veo 3, Wan 2.5 — text or image to video", bg: "/showcase/home-tool-video.jpg", href: "/video-studio" },
  { icon: Music, title: "AI Songs & Audio", desc: "Generate songs, music videos, TTS, and sound effects", bg: "/showcase/home-tool-audio.jpg", href: "/tools/song-creator" },
  { icon: Wand2, title: "100+ Creative Tools", desc: "Headshots, logos, pet portraits, tarot cards, movie posters, pixel art — pick your niche", bg: "/showcase/home-tool-img2vid.jpg", href: "/tools" },
  { icon: ShoppingBag, title: "Marketplace", desc: "Buy and sell prompts, presets, and workflows", bg: "/showcase/home-tool-market.jpg", href: "/marketplace" },
  { icon: Users, title: "Community Gallery", desc: "Discover and share AI-generated artwork", bg: "/showcase/home-tool-gallery.jpg", href: "/gallery" },
];

const pricingPlans = [
  {
    name: "Explorer",
    price: "$0",
    period: "",
    features: ["50 credits / day", "Free AI models", "Community gallery", "1024px images"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Creator",
    price: "$9",
    period: "/mo",
    features: ["3,000 credits / month", "Standard models", "No watermarks", "Commercial rights"],
    cta: "Go Creator",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    features: ["10,000 credits / month", "Premium models", "1080p video", "Priority queue"],
    cta: "Go Pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Studio",
    price: "$39",
    period: "/mo",
    features: ["30,000 credits / month", "All models + Ultra", "4K video", "Marketplace selling"],
    cta: "Go Studio",
    highlighted: false,
  },
];

const showcaseItems = [
  { src: "/showcase/gallery-13.jpg", label: "Fantasy Landscapes" },
  { src: "/showcase/gallery-15.jpg", label: "Product Photography" },
  { src: "/showcase/gallery-17.jpg", label: "Concept Art" },
  { src: "/showcase/hero-characters-1.jpg", label: "Character Design" },
  { src: "/showcase/hero-brandkit-1.jpg", label: "Brand Identity" },
  { src: "/showcase/gallery-20.jpg", label: "Sci-Fi Worlds" },
];

const statItems = [
  { label: "AI Tools", target: 100, suffix: "+" },
  { label: "AI Models", target: 30, suffix: "+" },
  { label: "AI Providers", target: 13, suffix: "" },
  { label: "Free to Start", target: 50, suffix: " cr/day" },
];

const heroWords = ["Images", "Videos", "Songs", "Music Videos", "Logos", "Avatars", "Art"];

/* ── Section divider component ── */
function SectionDivider() {
  return <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />;
}

/* ── Animated word cycling ── */
function CyclingWord() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((p) => (p + 1) % heroWords.length), 2500);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className="inline-block relative h-[1.15em] overflow-hidden align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={heroWords[index]}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent"
        >
          {heroWords[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

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
            alt="Hero background"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out -z-10"
            style={{ opacity: i === heroIdx ? 1 : 0 }}
          />
        ))}
        {/* Dark overlay — FIX 1: much darker */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/65 to-black/95" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-32 lg:py-40">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 mb-8"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-white/90">100+ AI Tools — One Platform</span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tighter mb-6 leading-[1.05] text-white"
              style={{ textShadow: '0 4px 30px rgba(0,0,0,0.8)' }}
            >
              Create Stunning <CyclingWord />
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="text-lg md:text-xl text-white/60 mb-12 max-w-2xl mx-auto"
            >
              The all-in-one AI creative studio. Images, video, songs, music videos — powered by 30+ AI models.
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {statItems.map((stat) => (
              <StatItem key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </section>

      {/* AI Model Marquee */}
      <section className="py-6 overflow-hidden border-b border-white/5">
        <p className="text-center text-[10px] text-white/30 uppercase tracking-[0.3em] mb-4">Powered by the world's best AI models</p>
        <div className="flex items-center justify-center gap-8 md:gap-12">
          {["Grok", "OpenAI", "Gemini", "Claude", "Flux Pro", "DALL-E 3", "Veo 3", "Runway", "Kling", "Seedream", "fal.ai", "Groq"].map((model) => (
            <span key={model} className="text-sm font-medium text-white/25 hover:text-white/60 transition-colors whitespace-nowrap">
              {model}
            </span>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 2.5: WHAT'S NEW ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={0}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4"
              >
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                  Just shipped
                </span>
              </motion.div>
              <motion.h2
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={1}
                className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white"
              >
                What's <span className="gradient-text">new this week</span>
              </motion.h2>
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={2}
                className="text-white/60 mt-3 max-w-xl"
              >
                Five new tools, exclusive LoRA styles, and self-hosted audio models — all live now.
              </motion.p>
            </div>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={3}
            >
              <Button
                asChild
                variant="outline"
                className="bg-transparent border-white/20 hover:bg-white/10 gap-2"
              >
                <Link href="/tools">
                  Browse all 100+ tools <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {whatsNew.map((item, i) => (
              <Link key={item.title} href={item.href}>
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={scaleIn}
                  custom={i}
                  className="group relative rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyan-500/40 transition-all duration-500 cursor-pointer min-h-[200px]"
                >
                  <div className="absolute inset-0">
                    <img
                      src={item.img}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/showcase/hero-forge.jpg";
                      }}
                      className="w-full h-full object-cover opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/40" />
                  </div>
                  <div className="relative p-6 flex flex-col h-full min-h-[200px]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <item.icon className="h-6 w-6 text-cyan-400" />
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-wider">
                        {item.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-1 text-white">{item.title}</h3>
                    <p className="text-sm text-white/60 mb-4">{item.desc}</p>
                    <div className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Try it now <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 3: INTERACTIVE PROMPT DEMO ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em] text-center"
          >
            Try It Now
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-center text-white"
          >
            Type a Prompt and See the <span className="gradient-text">Magic</span>
          </motion.h2>
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="text-white/60 text-center mb-10 max-w-xl mx-auto"
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
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-2 rounded-2xl bg-white/5 border border-cyan-500/30 shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)] backdrop-blur-sm">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Search className="h-5 w-5 text-white/40 ml-2 sm:ml-4 shrink-0" />
                <input
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="A mystical dragon perched on a crystal mountain..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm sm:text-base py-3 min-w-0"
                />
              </div>
              <Button
                size="lg"
                className="font-medium gap-2 px-6 h-12 text-base glow-primary shrink-0 w-full sm:w-auto"
                onClick={handleGenerate}
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </div>
          </motion.div>

          {/* Example results */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { src: "/showcase/gallery-5.jpg", prompt: "Android woman with clockwork face" },
              { src: "/showcase/gallery-8.jpg", prompt: "Steampunk airship battle above London" },
              { src: "/showcase/gallery-11.jpg", prompt: "Bioluminescent coral reef city" },
              { src: "/showcase/gallery-6.jpg", prompt: "Alien landscape with geometric monuments" },
            ].map((img, i) => (
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
          <p className="text-center text-xs text-white/30 mt-4">Example outputs generated by DreamForgeX</p>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 4: SHOWCASE GALLERY — FIX 5: fixed grid instead of masonry ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em] text-center"
          >
            Made with DreamForgeX
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center text-white"
          >
            What Creators Are <span className="gradient-text">Building</span>
          </motion.h2>

          {/* Fixed grid — 8 images, consistent square aspect ratio */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <motion.div
                key={img.src}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i % 6}
                className="group relative aspect-square overflow-hidden rounded-2xl"
              >
                <img
                  src={img.src}
                  alt={img.prompt}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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

      <SectionDivider />

      {/* ═══════ SECTION 5: BEFORE/AFTER TOOL DEMOS — FIX 2: bigger images ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em] text-center"
          >
            See Our Tools in Action
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center text-white"
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
                <h3 className="text-lg font-semibold text-center text-white">{demo.label}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                    <img src={demo.before} alt={`${demo.label} before`} loading="lazy" className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-black/70 text-white/80 backdrop-blur-sm">
                      Before
                    </span>
                  </div>
                  {/* After */}
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                    <img src={demo.after} alt={`${demo.label} after`} loading="lazy" className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/80 text-white backdrop-blur-sm shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                      After
                    </span>
                  </div>
                </div>
                <p className="text-sm text-white/60 text-center">{demo.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 6: TOOLS GRID — FIX 3: better bg opacity + min height ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em] text-center"
          >
            Powerful Tools
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center text-white"
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
                  className="group relative rounded-2xl overflow-hidden bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all duration-500 cursor-pointer min-h-[180px]"
                >
                  <div className="absolute inset-0">
                    <img
                      src={tool.bg}
                      alt="Hero background"
                      loading="lazy"
                      className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/70 to-black/50" />
                  </div>
                  <div className="relative p-6">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                      <tool.icon className="h-6 w-6 text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1 text-white">{tool.title}</h3>
                    <p className="text-sm text-white/60">{tool.desc}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 7: PRICING PREVIEW ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em] text-center"
          >
            Simple Pricing
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center text-white"
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
                    ? "bg-white/10 border-2 border-cyan-500/50 shadow-[0_0_30px_-5px_rgba(245,158,11,0.3)]"
                    : "bg-white/5 border border-white/10 hover:border-white/20"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      {plan.badge}
                    </span>
                  </div>
                )}
                <h3 className="text-lg font-semibold mb-2 text-white">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-white/60">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="h-4 w-4 text-cyan-400 shrink-0" />
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
            <Link href="/pricing" className="text-sm text-cyan-400 hover:underline inline-flex items-center gap-1">
              View All Plans <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 8: SHOWCASE ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em] text-center"
          >
            AI-Generated Showcase
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-16 text-center text-white"
          >
            What You Can <span className="gradient-text">Create</span>
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {showcaseItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="rounded-2xl overflow-hidden border border-white/10 backdrop-blur-sm group"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={item.src} alt={item.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
                <div className="p-4 bg-white/5">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
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
            className="text-center text-white/60 mt-12"
          >
            Every image above was generated with DreamForgeX — start creating for free today
          </motion.p>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════ SECTION 9: FINAL CTA ═══════ */}
      <section className="py-16 md:py-20 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-purple-900/10 to-black/80" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-white"
            >
              Ready to Create Something <span className="gradient-text">Amazing</span>?
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-lg text-white/60 mb-10"
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
              <div className="flex items-center gap-6 text-sm text-white/60">
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
