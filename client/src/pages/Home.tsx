import { useAuth } from "@/_core/hooks/useAuth";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Zap,
  Film,
  Image,
  Music,
  Users,
  ShoppingBag,
  Check,
  Wand2,
  Server,
  Palette,
  Cat,
  Moon,
  Clapperboard,
  Gamepad2,
  Flame,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState, useRef, useCallback } from "react";
import OnboardingWizard, { useOnboarding } from "@/components/OnboardingWizard";

/* Homepage content */
const galleryImages = [
  {
    src: "/showcase/gallery-1.jpg",
    prompt: "Bioluminescent underwater cathedral with jellyfish stained glass",
  },
  {
    src: "/showcase/gallery-2.jpg",
    prompt: "Cyberpunk samurai in neon rain, holographic katana",
  },
  {
    src: "/showcase/gallery-3.jpg",
    prompt: "Enchanted forest library where trees are bookshelves",
  },
  {
    src: "/showcase/gallery-4.jpg",
    prompt: "Crystalline phoenix emerging from a supernova",
  },
  {
    src: "/showcase/gallery-7.jpg",
    prompt: "Japanese zen garden with koi pond reflecting cherry blossoms",
  },
  {
    src: "/showcase/gallery-9.jpg",
    prompt: "Futuristic fashion model in liquid mercury clothes",
  },
  {
    src: "/showcase/gallery-10.jpg",
    prompt: "Ancient dragon sleeping on a mountain of gold",
  },
  {
    src: "/showcase/gallery-12.jpg",
    prompt: "Surreal melting clocktower in a desert of mirrors",
  },
];

const whatsNew = [
  {
    icon: Cat,
    title: "Pet Portrait",
    desc: "Royal, fantasy, and sci-fi portraits of your pet",
    href: "/tools/pet-portrait",
  },
  {
    icon: Moon,
    title: "Tarot Card Designer",
    desc: "Custom major arcana decks with rich symbolism",
    href: "/tools/tarot-card",
  },
  {
    icon: Clapperboard,
    title: "Movie Poster",
    desc: "Theatrical-quality one-sheets for any genre",
    href: "/tools/movie-poster",
  },
  {
    icon: Gamepad2,
    title: "Pixel Art Generator",
    desc: "Game-ready 8/16/32-bit sprites and scenes",
    href: "/tools/pixel-art",
  },
  {
    icon: Palette,
    title: "Brand Style Guide",
    desc: "Logo + color palette + typography on one page",
    href: "/tools/brand-style-guide",
  },
  {
    icon: Server,
    title: "Self-Hosted Audio",
    desc: "Bark TTS + MusicGen + AudioGen on our GPUs",
    href: "/tools/song-creator",
  },
];

const tools = [
  {
    icon: Image,
    title: "Text-to-Image",
    desc: "30+ models — Flux, DALL-E 3, Gemini, Grok, Seedream",
    href: "/workspace",
  },
  {
    icon: Film,
    title: "AI Video",
    desc: "Runway, Kling, Veo 3, Wan 2.5 — text or image to video",
    href: "/video-studio",
  },
  {
    icon: Music,
    title: "AI Songs & Audio",
    desc: "Generate songs, music videos, TTS, and sound effects",
    href: "/tools/song-creator",
  },
  {
    icon: Wand2,
    title: "100+ Creative Tools",
    desc: "Headshots, logos, pet portraits, tarot cards, movie posters, pixel art — pick your niche",
    href: "/tools",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    desc: "Buy and sell prompts, presets, and workflows",
    href: "/marketplace",
  },
  {
    icon: Users,
    title: "Community Gallery",
    desc: "Discover and share AI-generated artwork",
    href: "/gallery",
  },
];

/* External providers shown in the expandable provider list. Kling is dropped at render time
   when /api/status/providers reports it unconfigured. */
const marqueeProviders = [
  "Grok (xAI)",
  "OpenAI",
  "Gemini",
  "Claude",
  "Stability AI",
  "Replicate",
  "fal.ai",
  "Together AI",
  "Cloudflare AI",
  "Groq",
  "Runway",
  "Kling",
  "Sync Labs",
];

const pricingPlans = [
  {
    name: "Explorer",
    price: "$0",
    period: "",
    features: [
      "50 credits / day",
      "Free AI models",
      "Community gallery",
      "1024px images",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Creator",
    price: "$9",
    period: "/mo",
    features: [
      "3,000 credits / month",
      "Standard models",
      "No watermarks",
      "Commercial rights",
    ],
    cta: "Go Creator",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    features: [
      "10,000 credits / month",
      "Premium models",
      "1080p video",
      "Priority queue",
    ],
    cta: "Go Pro",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Studio",
    price: "$39",
    period: "/mo",
    features: [
      "30,000 credits / month",
      "All models + Ultra",
      "4K video",
      "Marketplace selling",
    ],
    cta: "Go Studio",
    highlighted: false,
  },
];

const statItems = [
  { label: "AI Tools", target: 100, suffix: "+" },
  { label: "AI Models", target: 30, suffix: "+" },
  { label: "AI Providers", target: 13, suffix: "" },
  { label: "Free to Start", target: 50, suffix: " cr/day" },
];

const heroWords = [
  "Images",
  "Videos",
  "Songs",
  "Music Videos",
  "Logos",
  "Avatars",
  "Art",
];

/* ── Animated word cycling ── */
function CyclingWord() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setIndex(p => (p + 1) % heroWords.length),
      2500
    );
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
function useCountUp(target: number) {
  // Real number on first paint. The old 0→target count-up left "0+ AI Tools"
  // on the page until the stats bar scrolled into view.
  const ref = useRef<HTMLDivElement>(null);
  return { value: target, ref };
}

/* ── Stat item component ── */
function StatItem({
  label,
  target,
  suffix,
}: {
  label: string;
  target: number;
  suffix: string;
}) {
  const { value, ref } = useCountUp(target);
  return (
    <div ref={ref} className="flex flex-col items-center gap-1 px-6 py-4">
      <span className="text-3xl md:text-4xl font-bold gradient-text">
        {value.toLocaleString()}
        {suffix}
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
  const [promptText, setPromptText] = useState("");
  /* Kling availability from /api/status/providers. undefined while loading or
     if the probe is unreachable — in that case we default to showing it. */
  const [klingConfigured, setKlingConfigured] = useState<boolean | undefined>(
    undefined
  );

  useEffect(() => {
    fetch("/api/status/providers")
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        const kling = body?.checks?.find((c: any) => c.name === "kling");
        if (typeof kling?.configured === "boolean")
          setKlingConfigured(kling.configured);
      })
      .catch(() => {});
  }, []);

  const showKling = klingConfigured !== false;
  const visibleTools = (
    showKling
      ? tools
      : tools.map(t =>
          t.title === "AI Video"
            ? { ...t, desc: "Runway, Veo 3, Wan 2.5 — text or image to video" }
            : t
        )
  ).map(t =>
    // Signed-out visitors clicking "Text-to-Image" used to land in the
    // sign-in-walled /workspace despite the hero's no-signup promise — send
    // them to the free demo instead. The video tile keeps /video-studio:
    // it's the honest destination and there is no video demo to offer.
    !isAuthenticated && t.title === "Text-to-Image"
      ? { ...t, href: "/demo/text-to-image" as const }
      : t
  );
  const visibleProviders = showKling
    ? marqueeProviders
    : marqueeProviders.filter(p => p !== "Kling");

  useEffect(() => {
    if (isAuthenticated && !onboardingDone) setShowOnboarding(true);
  }, [isAuthenticated, onboardingDone]);

  const handleGenerate = useCallback(() => {
    // Don't wall cold visitors at signup — hand the typed prompt to the
    // no-signup demo so they get a real generation before any account.
    const trimmed = promptText.trim();
    window.location.href = trimmed
      ? `/demo/text-to-image?prompt=${encodeURIComponent(trimmed)}`
      : "/demo/text-to-image";
  }, [promptText]);

  return (
    <PageLayout>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => {
            markCompleted();
            setShowOnboarding(false);
          }}
          onDismiss={() => {
            markCompleted();
            setShowOnboarding(false);
            window.location.href =
              "/demo/text-to-image?prompt=" +
              encodeURIComponent(
                "A cyberpunk Tokyo street market in heavy rain, neon reflections"
              );
          }}
        />
      )}

      <section className="relative overflow-hidden border-b border-white/10">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/showcase/hero-forge.jpg"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src="/video/hero-bg.mp4?v=1080p" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/65 to-black/95" />
        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-24 text-center sm:px-6 md:pb-14 md:pt-28">
          <p className="mb-5 text-sm font-semibold text-cyan-200">
            100+ AI Tools · 30+ Models · Self-Hosted GPU Fleet
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-7xl">
            Create Stunning <CyclingWord />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            The all-in-one AI creative studio for images, video, songs, and
            design.
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="min-h-12 h-auto whitespace-normal px-6 py-3 glow-primary"
            >
              <Link
                href={isAuthenticated ? "/workspace" : "/demo/text-to-image"}
              >
                <Zap className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                {isAuthenticated ? "Start Creating" : "Try It Free — No Signup"}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="min-h-12 h-auto whitespace-normal bg-rose-600 px-6 py-3 text-white hover:bg-rose-500"
            >
              <Link href="/uncensored?start=1">
                <Flame className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                Uncensored Studio (3 Free) · 18+
              </Link>
            </Button>
          </div>
          <form
            action="/demo/text-to-image"
            method="get"
            onSubmit={event => {
              event.preventDefault();
              handleGenerate();
            }}
            className="mx-auto mt-6 max-w-2xl text-left"
          >
            <label
              htmlFor="home-prompt"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Try your own prompt
            </label>
            <div className="flex flex-col gap-2 rounded-xl border border-cyan-400/40 bg-black/50 p-2 sm:flex-row">
              <input
                id="home-prompt"
                name="prompt"
                type="text"
                value={promptText}
                onChange={event => setPromptText(event.target.value)}
                placeholder="A mystical dragon on a crystal mountain..."
                className="min-w-0 flex-1 rounded-lg bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-cyan-300"
              />
              <Button type="submit" className="min-h-11 h-auto px-5 py-3">
                <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                Generate
              </Button>
            </div>
          </form>
          <nav
            aria-label="Homepage sections"
            className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-cyan-200"
          >
            <a
              href="#home-pricing"
              className="py-3 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              View Pricing
            </a>
            <a
              href="#home-tools"
              className="py-3 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              Browse Tools
            </a>
            <Link
              href="/gallery"
              className="py-3 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              Explore Gallery
            </Link>
          </nav>
        </div>
      </section>

      <section
        aria-label="Studio at a glance"
        className="border-b border-white/10 bg-black/40"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-2 px-4 md:grid-cols-4">
          {statItems.map(stat => (
            <StatItem
              key={stat.label}
              {...stat}
              target={
                stat.label === "AI Providers"
                  ? visibleProviders.length
                  : stat.target
              }
            />
          ))}
        </div>
        <details className="mx-auto max-w-5xl px-4 pb-4 text-sm text-white/70">
          <summary className="cursor-pointer rounded-lg py-3 text-center focus-visible:outline-2 focus-visible:outline-cyan-300">
            Powered by {visibleProviders.length} AI providers and DreamForge
            GPUs
          </summary>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 py-3">
            {visibleProviders.map(provider => (
              <span key={provider}>{provider}</span>
            ))}
          </div>
          <p className="text-center leading-relaxed text-cyan-200">
            Self-hosted: Flux Pro/Dev/Schnell · CogVideoX-5B · MusicGen ·
            AudioGen · CatVTON · Bark TTS · Real-ESRGAN · Exclusive LoRAs
          </p>
        </details>
      </section>

      <section aria-labelledby="home-gallery-title" className="py-10 md:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-sm font-medium text-cyan-300">
                Made with DreamForgeX
              </p>
              <h2
                id="home-gallery-title"
                className="text-2xl font-bold text-white md:text-3xl"
              >
                What Creators Are Building
              </h2>
            </div>
            <Link
              href="/gallery"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              Explore Gallery
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {galleryImages.slice(0, 6).map(image => (
              <figure
                key={image.src}
                className="overflow-hidden rounded-xl border border-white/15 bg-white/5"
              >
                <img
                  src={image.src}
                  alt={image.prompt}
                  loading="lazy"
                  width={400}
                  height={280}
                  className="h-28 w-full object-cover sm:h-40 md:h-48"
                />
                <figcaption className="p-3 text-xs leading-relaxed text-white/80">
                  {image.prompt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section
        id="home-pricing"
        aria-labelledby="home-pricing-title"
        className="scroll-mt-24 border-y border-white/10 bg-white/[0.03] py-10 md:py-14"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-sm font-medium text-cyan-300">
                Simple Pricing
              </p>
              <h2
                id="home-pricing-title"
                className="text-2xl font-bold text-white md:text-3xl"
              >
                Plans for Every Creator
              </h2>
            </div>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              View All Plans
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
            {pricingPlans.map(plan => (
              <article
                key={plan.name}
                className={
                  plan.highlighted
                    ? "flex flex-col rounded-xl border border-cyan-400/60 bg-cyan-400/10 p-4"
                    : "flex flex-col rounded-xl border border-white/15 bg-black/30 p-4"
                }
              >
                <h3 className="text-base font-semibold text-white">
                  {plan.name}
                </h3>
                <p className="mt-2 text-3xl font-bold text-white">
                  {plan.price}
                  <span className="text-sm font-normal text-white/70">
                    {plan.period}
                  </span>
                </p>
                {plan.badge && (
                  <p className="mt-2 text-xs font-semibold text-cyan-200">
                    {plan.badge}
                  </p>
                )}
                <ul className="mb-4 mt-4 space-y-2 text-xs leading-5 text-white/80">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check
                        className="mt-1 h-3 w-3 shrink-0 text-cyan-300"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant={plan.highlighted ? "default" : "outline"}
                  className="mt-auto min-h-11 h-auto w-full whitespace-normal px-2 py-2 text-sm"
                >
                  <Link href="/pricing">{plan.cta}</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="home-tools"
        aria-labelledby="home-tools-title"
        className="scroll-mt-24 py-10 md:py-14"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <h2
              id="home-tools-title"
              className="text-2xl font-bold text-white md:text-3xl"
            >
              Your creative toolkit
            </h2>
            <Link
              href="/tools"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              Browse all 100+ tools
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {visibleTools.map(tool => (
              <Link
                key={tool.title}
                href={tool.href}
                className="rounded-xl border border-white/15 bg-white/5 p-4 transition-colors hover:border-cyan-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <tool.icon
                  className="mb-3 h-5 w-5 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-bold leading-5 text-white">
                  {tool.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-white/75">
                  {tool.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="home-new-title"
        className="border-y border-white/10 bg-white/[0.03] py-10 md:py-14"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-sm font-medium text-cyan-300">
                Just shipped
              </p>
              <h2
                id="home-new-title"
                className="text-2xl font-bold text-white md:text-3xl"
              >
                What's new this week
              </h2>
            </div>
            <Link
              href="/whats-new"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              All updates
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {whatsNew.map(item => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-xl border border-white/15 bg-black/30 p-4 transition-colors hover:border-cyan-300/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              >
                <item.icon
                  className="mb-3 h-5 w-5 text-cyan-300"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-bold leading-5 text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-white/75">
                  {item.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="home-uncensored-title"
        className="py-10 md:py-14"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-5 md:p-8">
            <p className="mb-2 text-sm font-semibold text-rose-200">
              18+ · Separate Uncensored Pro Studio
            </p>
            <h2
              id="home-uncensored-title"
              className="text-2xl font-bold text-white"
            >
              Private Uncensored AI Studio
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
              Uncensored text-to-image, character face lock, outfit swap, brush
              inpaint, 4-view character sheets, and Wan 2.2 video. Try 3 free
              previews, or view Day, Week, and 30-Day passes from $4.99.
            </p>
            <p className="mt-2 text-xs leading-5 text-white/70">
              Card / Apple Pay or Bitcoin. See the pricing page for full pass
              details.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="min-h-11 h-auto whitespace-normal bg-rose-600 px-4 py-3 text-white hover:bg-rose-500"
              >
                <Link href="/uncensored?start=1">
                  Try 3 Free Previews
                  <ArrowRight
                    className="ml-2 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-11 h-auto whitespace-normal border-white/25 px-4 py-3"
              >
                <Link href="/pricing#uncensored-passes">
                  View Day / Week / 30-Day Passes
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
