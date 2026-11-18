import { useAuth } from "@/_core/hooks/useAuth";
import PageLayout from "@/components/PageLayout";
import HomeCapabilityDemo from "@/components/HomeCapabilityDemo";
import OnboardingWizard, { useOnboarding } from "@/components/OnboardingWizard";
import {
  ArrowDown,
  ArrowUpRight,
  Cat,
  Check,
  Clapperboard,
  Film,
  Flame,
  Gamepad2,
  Image as ImageIcon,
  Layers3,
  Moon,
  Music2,
  Palette,
  Server,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import styles from "./Home.module.css";

const galleryImages = [
  {
    src: "/showcase/gallery-1.jpg",
    title: "Bioluminescent cathedral",
    alt: "An underwater cathedral glowing blue and violet with floating jellyfish",
  },
  {
    src: "/showcase/gallery-2.jpg",
    title: "Neon ronin",
    alt: "A cyberpunk swordsman on a rain-soaked rooftop overlooking a neon city",
  },
  {
    src: "/showcase/gallery-3.jpg",
    title: "Forest archive",
    alt: "A forest library with tall bookshelves carved into enormous trees",
  },
  {
    src: "/showcase/gallery-4.jpg",
    title: "Supernova phoenix",
    alt: "A crystalline phoenix unfurling amid a burst of starlight",
  },
  {
    src: "/showcase/gallery-7.jpg",
    title: "Garden at the koi pond",
    alt: "A Japanese garden with a koi pond, colorful trees, and a view of Mount Fuji",
  },
  {
    src: "/showcase/gallery-9.jpg",
    title: "Liquid chrome",
    alt: "A fashion portrait with a sculptural chrome outfit on a black backdrop",
  },
];

const whatsNew = [
  {
    icon: Cat,
    title: "Pet Portrait",
    desc: "Royal, fantasy, and sci-fi pet portraits",
    href: "/tools/pet-portrait",
  },
  {
    icon: Moon,
    title: "Tarot Card Designer",
    desc: "Design your own major arcana cards",
    href: "/tools/tarot-card",
  },
  {
    icon: Clapperboard,
    title: "Movie Poster",
    desc: "Theatrical posters for any genre",
    href: "/tools/movie-poster",
  },
  {
    icon: Gamepad2,
    title: "Pixel Art Generator",
    desc: "Create sprites and retro game scenes",
    href: "/tools/pixel-art",
  },
  {
    icon: Palette,
    title: "Brand Style Guide",
    desc: "Logo, color, and typography on one page",
    href: "/tools/brand-style-guide",
  },
  {
    icon: Server,
    title: "Self-Hosted Audio",
    desc: "Generate music with our GPU-powered tools",
    href: "/tools/song-creator",
  },
];

const studioLinks = [
  { icon: Layers3, title: "Design Canvas", href: "/tools/design-canvas" },
  { icon: Users, title: "Community Gallery", href: "/gallery" },
  { icon: ShoppingBag, title: "Marketplace", href: "/marketplace" },
];

// Hide Kling when the provider status endpoint reports it unconfigured.
const providers = [
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
    features: [
      "50 credits / day",
      "Free AI models",
      "Community gallery",
      "1024px images",
    ],
    cta: "Start Free",
  },
  {
    name: "Creator",
    price: "$9",
    features: [
      "3,000 credits / month",
      "Standard models",
      "No watermarks",
      "Commercial rights",
    ],
    cta: "Go Creator",
  },
  {
    name: "Pro",
    price: "$19",
    features: [
      "10,000 credits / month",
      "Premium models",
      "1080p video",
      "Priority queue",
    ],
    cta: "Go Pro",
  },
  {
    name: "Studio",
    price: "$39",
    features: [
      "30,000 credits / month",
      "All models + Ultra",
      "4K video",
      "Marketplace selling",
    ],
    cta: "Go Studio",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { completed: onboardingDone, markCompleted } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showKling, setShowKling] = useState(true);
  const createUrl = isAuthenticated ? "/workspace" : "/demo/text-to-image";
  const visibleProviders = showKling
    ? providers
    : providers.filter(name => name !== "Kling");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status/providers", { signal: controller.signal })
      .then(response => (response.ok ? response.json() : null))
      .then(body => {
        const kling = body?.checks?.find(
          (check: { name: string }) => check.name === "kling"
        );
        if (typeof kling?.configured === "boolean")
          setShowKling(kling.configured);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !onboardingDone) setShowOnboarding(true);
  }, [isAuthenticated, onboardingDone]);

  function closeOnboarding() {
    markCompleted();
    setShowOnboarding(false);
  }

  return (
    <PageLayout>
      {showOnboarding && (
        <OnboardingWizard
          onComplete={closeOnboarding}
          onDismiss={() => {
            closeOnboarding();
            window.location.href =
              "/demo/text-to-image?prompt=" +
              encodeURIComponent(
                "A cyberpunk Tokyo street market in heavy rain, neon reflections"
              );
          }}
        />
      )}

      <div className={styles.home}>
        <section aria-labelledby="home-title" className={styles.hero}>
          <img
            src="/showcase/forge-ring.webp"
            className={styles.heroArt}
            alt=""
            width={1728}
            height={691}
            fetchPriority="high"
          />
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.wrap}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>
                <span className={styles.signal} aria-hidden="true" />
                DreamForgeX Creative Studio
              </p>
              <h1 id="home-title">
                Imagine it.
                <br />
                <em>Forge it.</em>
              </h1>
              <p className={styles.lead}>
                Generate images, make videos, compose music, and design on an
                open canvas. One AI studio from first prompt to final export.
              </p>
              <div className={styles.heroActions}>
                <Link href={createUrl} className={styles.primary}>
                  {isAuthenticated
                    ? "Start Creating"
                    : "Try It Free — No Signup"}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <a href="#home-tools" className={styles.secondary}>
                  Explore tools
                  <ArrowDown size={15} aria-hidden="true" />
                </a>
              </div>
              <form
                action="/demo/text-to-image"
                method="get"
                className={styles.prompt}
                onSubmit={event => {
                  event.preventDefault();
                  const value = new FormData(event.currentTarget).get("prompt");
                  const prompt = typeof value === "string" ? value.trim() : "";
                  window.location.href = prompt
                    ? "/demo/text-to-image?" +
                      new URLSearchParams({ prompt }).toString()
                    : "/demo/text-to-image";
                }}
              >
                <label htmlFor="home-prompt">Try your own prompt</label>
                <div className={styles.promptRow}>
                  <input
                    id="home-prompt"
                    name="prompt"
                    type="text"
                    placeholder="A chrome ring in orbit"
                    autoComplete="off"
                  />
                  <button type="submit">
                    <Sparkles size={15} aria-hidden="true" />
                    Generate
                  </button>
                </div>
              </form>
              <nav aria-label="Homepage sections" className={styles.heroLinks}>
                <a href="#home-pricing">View Pricing</a>
                <Link href="/uncensored?start=1">
                  <Flame size={13} aria-hidden="true" />
                  Uncensored Studio · 18+
                </Link>
              </nav>
            </div>
          </div>
        </section>

        <section aria-label="Studio at a glance" className={styles.metrics}>
          <div className={styles.wrap}>
            <dl className={styles.statGrid}>
              <div>
                <dt>Creative tools</dt>
                <dd>100+</dd>
              </div>
              <div>
                <dt>AI models</dt>
                <dd>30+</dd>
              </div>
              <div>
                <dt>AI providers</dt>
                <dd>{visibleProviders.length}</dd>
              </div>
              <div>
                <dt>Free credits / day</dt>
                <dd>50</dd>
              </div>
            </dl>
            <details className={styles.providers}>
              <summary>View AI providers and self-hosted models</summary>
              <p>{visibleProviders.join(" · ")}</p>
              <p>
                Self-hosted models include Flux, CogVideoX, MusicGen, AudioGen,
                Bark TTS, and Real-ESRGAN.
              </p>
            </details>
          </div>
        </section>

        <section
          id="home-tools"
          aria-labelledby="home-tools-title"
          className={styles.section}
        >
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 id="home-tools-title">Your creative toolkit</h2>
              <Link href="/tools" className={styles.textLink}>
                Browse all 100+ tools{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.toolGrid}>
              <article className={styles.toolCard}>
                <img
                  src="/showcase/forge-image.webp"
                  alt="A fashion portrait in liquid chrome"
                  width={720}
                  height={405}
                  loading="lazy"
                  className={styles.toolMedia}
                />
                <div className={styles.toolBody}>
                  <h3>
                    <ImageIcon size={18} aria-hidden="true" /> Text-to-Image
                  </h3>
                  <p>
                    Turn a prompt into concept art, portraits, and product
                    visuals.
                  </p>
                  <Link href={createUrl} className={styles.textLink}>
                    Create an image{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
              <article className={styles.toolCard}>
                <video
                  aria-label="Silent sample video of a futuristic city at night"
                  className={styles.toolMedia}
                  controls
                  playsInline
                  preload="none"
                  poster="/showcase/forge-preview.webp"
                  src="/video/forge-preview.mp4"
                  width={720}
                  height={404}
                />
                <div className={styles.toolBody}>
                  <h3>
                    <Film size={18} aria-hidden="true" /> AI Video
                  </h3>
                  <p>
                    Animate a still image or turn a written scene into a clip.
                  </p>
                  <Link href="/video-studio" className={styles.textLink}>
                    Open Video Studio{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
              <article className={styles.toolCard}>
                <img
                  src="/showcase/forge-audio.webp"
                  alt="A silhouette surrounded by glowing ribbons of sound"
                  width={720}
                  height={405}
                  loading="lazy"
                  className={styles.toolMedia}
                />
                <div className={styles.toolBody}>
                  <h3>
                    <Music2 size={18} aria-hidden="true" /> AI Songs &amp; Audio
                  </h3>
                  <p>
                    Turn a song idea into an original track with vocals and
                    lyrics.
                  </p>
                  <Link href="/tools/song-creator" className={styles.textLink}>
                    Open Song Creator{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </div>
            <div className={styles.studioLinks}>
              {studioLinks.map(tool => (
                <Link key={tool.href} href={tool.href}>
                  <tool.icon size={18} aria-hidden="true" />
                  {tool.title}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.wrap}>
          <HomeCapabilityDemo />
        </div>

        <section
          aria-labelledby="home-gallery-title"
          className={styles.section}
        >
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 id="home-gallery-title">Made with DreamForgeX</h2>
              <Link href="/gallery" className={styles.textLink}>
                Explore Gallery <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.gallery}>
              {galleryImages.map(image => (
                <figure key={image.src}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    loading="lazy"
                    width={400}
                    height={280}
                  />
                  <figcaption>{image.title}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section
          id="home-pricing"
          aria-labelledby="home-pricing-title"
          className={styles.section}
        >
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <h2 id="home-pricing-title">Plans for Every Creator</h2>
              <Link href="/pricing" className={styles.textLink}>
                View All Plans <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.pricing}>
              {pricingPlans.map(plan => (
                <article
                  key={plan.name}
                  className={
                    plan.name === "Pro" ? styles.featuredPlan : undefined
                  }
                >
                  <h3>{plan.name}</h3>
                  <p className={styles.price}>
                    {plan.price}
                    {plan.name !== "Explorer" && <span> / mo</span>}
                  </p>
                  <ul>
                    {plan.features.map(feature => (
                      <li key={feature}>
                        <Check size={13} aria-hidden="true" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/pricing"
                    className={
                      plan.name === "Pro" ? styles.primary : styles.secondary
                    }
                  >
                    {plan.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="home-new-title" className={styles.section}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>Just shipped</p>
                <h2 id="home-new-title">What's new this week</h2>
              </div>
              <Link href="/whats-new" className={styles.textLink}>
                All updates <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className={styles.releases}>
              {whatsNew.map(item => (
                <Link key={item.href} href={item.href}>
                  <item.icon size={17} aria-hidden="true" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className={styles.releaseArrow}
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="home-uncensored-title"
          className={styles.lastSection}
        >
          <div className={styles.wrap}>
            <div className={styles.ageCard}>
              <div>
                <p className={styles.ageLabel}>
                  <Flame size={15} aria-hidden="true" /> Adults 18+
                </p>
                <h2 id="home-uncensored-title">Private Uncensored AI Studio</h2>
                <p>
                  Try 3 free previews. Day, Week, and 30-Day passes start at
                  $4.99.
                </p>
              </div>
              <div className={styles.ageActions}>
                <Link href="/uncensored?start=1" className={styles.secondary}>
                  Try 3 Free Previews
                </Link>
                <Link
                  href="/pricing#uncensored-passes"
                  className={styles.textLink}
                >
                  View Day / Week / 30-Day Passes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
