import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Image,
  Sparkles,
  Layers,
  Zap,
  Eye,
  Video,
  Film,
  Wand2,
  Play,
  Palette,
  Users,
  TrendingUp,
  MousePointerClick,
  Clapperboard,
  SlidersHorizontal,
  Star,
  Globe,
  Maximize,
  Scissors,
  Wrench,
  Camera as CameraIcon,
  Music,
  FileText,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useCallback, useState } from "react";
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

const features = [
  {
    icon: Sparkles,
    title: "Text-to-Image Generation",
    desc: "Describe any scene and watch AI bring it to life. Choose from multiple models for the perfect style, from photorealistic to artistic.",
    gradient: "from-violet-500/20 to-indigo-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: Film,
    title: "AI Video Clips",
    desc: "Create 2-8 second animated video clips from text. Control duration, motion style, and resolution for scroll-stopping content.",
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    iconColor: "text-fuchsia-400",
  },
  {
    icon: Clapperboard,
    title: "Image-to-Video Animation",
    desc: "Transform any generated image into a cinematic video clip. Choose from 6 motion styles — smooth pan, parallax drift, cinematic sweep, and more.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Wand2,
    title: "AI Prompt Enhancement",
    desc: "Not sure what to write? Let AI refine your prompt into a detailed, optimized description that produces stunning results.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: SlidersHorizontal,
    title: "Professional Controls",
    desc: "Fine-tune every detail with negative prompts, custom resolutions, model selection, and advanced generation parameters.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Globe,
    title: "Community Gallery",
    desc: "Share your best creations with the community. Discover trending art, explore styles, and get inspired by other creators.",
    gradient: "from-purple-500/20 to-fuchsia-500/20",
    iconColor: "text-purple-400",
  },
];

const workflow = [
  { step: "01", icon: MousePointerClick, title: "Describe It", desc: "Type a prompt describing the image or video you want to create." },
  { step: "02", icon: Sparkles, title: "Generate It", desc: "AI transforms your words into stunning visuals in seconds." },
  { step: "03", icon: Play, title: "Animate It", desc: "Turn any image into a cinematic video clip with one click." },
  { step: "04", icon: Star, title: "Share It", desc: "Publish to the gallery and inspire the community." },
];

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number; hue: number }[] = [];
    const count = 80;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2.5 + 0.5,
        o: Math.random() * 0.5 + 0.1,
        hue: Math.random() * 60 + 250,
      });
    }

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const p of particles) {
        const dmx = mx - p.x;
        const dmy = my - p.y;
        const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);
        if (distMouse < 200 && distMouse > 0) {
          const force = 0.02 * (1 - distMouse / 200);
          p.vx += (dmx / distMouse) * force;
          p.vy += (dmy / distMouse) * force;
        }

        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const pulse = Math.sin(Date.now() * 0.001 + p.hue) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.o + pulse})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const alpha = 0.08 * (1 - dist / 140);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const avgHue = (particles[i].hue + particles[j].hue) / 2;
            ctx.strokeStyle = `hsla(${avgHue}, 60%, 60%, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.8 }}
    />
  );
}

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
          onComplete={() => {
            markCompleted();
            setShowOnboarding(false);
          }}
          onDismiss={() => {
            markCompleted();
            setShowOnboarding(false);
          }}
        />
      )}
      {/* Hero Section */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        <ParticleCanvas />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-primary/8 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-chart-2/6 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-chart-3/5 rounded-full blur-[80px] animate-pulse-glow" style={{ animationDelay: "4s" }} />

        <div className="container relative py-24 md:py-32 lg:py-40">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                AI Creative Studio
              </span>
              <span className="h-1 w-1 rounded-full bg-primary/50" />
              <span className="text-xs text-muted-foreground">Image + Video + Animation</span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
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
              className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              Generate stunning images, create animated video clips, and bring your ideas to life —
              all from a single prompt. The AI creative studio built for creators who think visually.
            </motion.p>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {isAuthenticated ? (
                <Button asChild size="lg" className="font-medium gap-2 px-8 h-12 text-base glow-primary">
                  <Link href="/workspace">
                    <Sparkles className="h-5 w-5" />
                    Start Creating
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-8 h-12 text-base glow-primary"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  <Zap className="h-5 w-5" />
                  Start Creating Free
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="font-medium gap-2 px-8 h-12 text-base bg-transparent">
                <Link href="/gallery">
                  <Eye className="h-5 w-5" />
                  Explore Gallery
                </Link>
              </Button>
            </motion.div>

            {/* Floating capability badges */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={4}
              className="flex flex-wrap items-center justify-center gap-3 mt-12"
            >
              {[
                { label: "Text to Image", icon: Image },
                { label: "Text to Video", icon: Film },
                { label: "Image to Video", icon: Clapperboard },
                { label: "AI Enhancement", icon: Wand2 },
                { label: "Community Gallery", icon: Users },
              ].map((item) => (
                <span key={item.label} className="px-3 py-1.5 rounded-full text-xs font-medium glass-card text-muted-foreground flex items-center gap-1.5">
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border/50 bg-card/30 relative overflow-hidden">
        <div className="absolute inset-0 shimmer" />
        <div className="container relative py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto text-center">
            {[
              { value: stats?.totalGenerations?.toLocaleString() ?? "0", label: "Creations Made", icon: Sparkles },
              { value: stats?.totalItems?.toLocaleString() ?? "0", label: "In Gallery", icon: Image },
              { value: stats?.totalViews?.toLocaleString() ?? "0", label: "Total Views", icon: Eye },
              { value: "6", label: "Motion Styles", icon: Play },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
              >
                <p className="text-3xl md:text-4xl font-bold gradient-text">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 font-medium uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <stat.icon className="h-3 w-3" />
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works — Workflow */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-fuchsia-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="container relative">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-primary mb-3 uppercase tracking-widest"
            >
              How It Works
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            >
              From Prompt to{" "}
              <span className="gradient-text-warm">Motion</span>{" "}
              in Minutes
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground max-w-xl mx-auto text-lg"
            >
              Create stunning visuals in four simple steps. No design skills required.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {workflow.map((item, i) => (
              <motion.div
                key={item.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="relative text-center p-6 rounded-2xl border border-border/30 bg-card/30 hover:bg-card/50 transition-all duration-300 group"
              >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  STEP {item.step}
                </span>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4 mt-2 group-hover:bg-primary/15 transition-colors">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                {i < workflow.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 text-muted-foreground/30">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Image-to-Video Highlight */}
      <section className="py-24 md:py-32 relative overflow-hidden border-y border-border/50 bg-card/20">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="container relative">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={0}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card mb-6">
                  <Clapperboard className="h-3.5 w-3.5 text-fuchsia-400" />
                  <span className="text-xs font-medium text-fuchsia-400">Unique Feature</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                  Still to{" "}
                  <span className="gradient-text-warm">Motion</span>{" "}
                  in One Click
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                  Generate an image, then animate it into a cinematic video clip. Choose from 6 motion styles
                  to bring your creations to life — no video editing skills needed.
                </p>
                <div className="space-y-3">
                  {[
                    "Smooth Pan & Gentle Zoom",
                    "Parallax Drift & Cinematic Sweep",
                    "Breathing Motion & Particle Flow",
                    "Adjustable 2-8 second duration",
                  ].map((item, i) => (
                    <motion.div
                      key={item}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true }}
                      variants={fadeUp}
                      custom={i + 1}
                      className="flex items-center gap-3"
                    >
                      <div className="h-6 w-6 rounded-full bg-fuchsia-500/10 flex items-center justify-center shrink-0">
                        <Zap className="h-3 w-3 text-fuchsia-400" />
                      </div>
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </motion.div>
                  ))}
                </div>
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={5}
                  className="mt-8"
                >
                  <Button asChild className="gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
                    <Link href="/workspace">
                      <Play className="h-4 w-4" />
                      Try Image-to-Video
                    </Link>
                  </Button>
                </motion.div>
              </motion.div>

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={2}
                className="relative"
              >
                <div className="rounded-2xl border border-border/50 bg-card/50 p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                      <Clapperboard className="h-5 w-5 text-fuchsia-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Animate Image</p>
                      <p className="text-xs text-muted-foreground">Cinematic Sweep • 4s</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/30 border border-border/30 p-3 text-center">
                      <Image className="h-5 w-5 text-violet-400 mx-auto mb-1.5" />
                      <p className="text-[10px] text-muted-foreground">Source Image</p>
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-fuchsia-500/30 p-3 text-center">
                      <Video className="h-5 w-5 text-fuchsia-400 mx-auto mb-1.5" />
                      <p className="text-[10px] text-fuchsia-400">Animated Video</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border/30 p-4">
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                      "A phoenix rising from crystalline flames, cinematic slow motion, particle effects"
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Smooth Pan", "Gentle Zoom", "Parallax Drift", "Cinematic Sweep", "Breathing", "Particle Flow"].map((s) => (
                      <span key={s} className={`text-[10px] px-2 py-1 rounded-md border ${s === "Cinematic Sweep" ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-400" : "border-border/30 text-muted-foreground"}`}>
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500" />
                  </div>
                  <p className="text-[10px] text-emerald-400 text-center flex items-center justify-center gap-1">
                    <Sparkles className="h-3 w-3" /> Animation complete
                  </p>
                </div>
                <div className="absolute -top-4 -right-4 h-24 w-24 bg-fuchsia-500/10 rounded-full blur-[40px]" />
                <div className="absolute -bottom-4 -left-4 h-20 w-20 bg-violet-500/10 rounded-full blur-[30px]" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 md:py-32 relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/3 rounded-full blur-[100px]" />
        <div className="container relative">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-primary mb-3 uppercase tracking-widest"
            >
              Everything You Need
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            >
              Powerful Tools for Creators
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground max-w-xl mx-auto text-lg"
            >
              Generate images, create videos, animate your art, and share with a global community — all in one platform.
            </motion.p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={scaleIn}
                custom={i}
                className="group relative p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-border/80 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Style Tags */}
      <section className="py-24 md:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={0}
                className="text-sm font-medium text-primary mb-3 uppercase tracking-widest"
              >
                Explore Styles
              </motion.p>
              <motion.h2
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={1}
                className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
              >
                Every Style Imaginable
              </motion.h2>
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={2}
                className="text-muted-foreground text-lg"
              >
                From fantasy landscapes to cyberpunk cityscapes — create in any genre or aesthetic.
              </motion.p>
            </div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={3}
              className="flex flex-wrap justify-center gap-3"
            >
              {[
                { label: "Fantasy", color: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
                { label: "Sci-Fi", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
                { label: "Mythological", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
                { label: "Cyberpunk", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
                { label: "Impressionist", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
                { label: "Art Nouveau", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
                { label: "Ethereal", color: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20" },
                { label: "Cosmic Horror", color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20" },
                { label: "Biomechanical", color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
                { label: "Surreal", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
                { label: "Abstract", color: "bg-red-500/15 text-red-400 border-red-500/20" },
                { label: "Cinematic", color: "bg-pink-500/15 text-pink-400 border-pink-500/20" },
              ].map((tag) => (
                <span
                  key={tag.label}
                  className={`px-4 py-2 rounded-full text-sm font-medium border ${tag.color} transition-transform hover:scale-105 cursor-default`}
                >
                  {tag.label}
                </span>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* AI Tools Suite */}
      <section className="py-24 md:py-32 relative overflow-hidden border-y border-border/50 bg-card/20">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="container relative">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-primary mb-3 uppercase tracking-widest"
            >
              AI Tools Suite
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            >
              Professional Tools,{" "}
              <span className="gradient-text">Zero Complexity</span>
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground max-w-xl mx-auto text-lg"
            >
              Upscale, stylize, edit backgrounds, and build perfect prompts — all powered by AI.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Maximize, title: "Image Upscaler", desc: "Enhance resolution up to 4x with AI-powered detail sharpening.", gradient: "from-blue-500 to-cyan-400", href: "/tools/upscaler" },
              { icon: Palette, title: "Style Transfer", desc: "Transform photos into oil paintings, anime, cyberpunk, and more.", gradient: "from-violet-500 to-fuchsia-400", href: "/tools/style-transfer" },
              { icon: Scissors, title: "Background Editor", desc: "Remove or replace backgrounds instantly with clean edges.", gradient: "from-emerald-500 to-teal-400", href: "/tools/background" },
              { icon: Wand2, title: "Prompt Builder", desc: "Craft optimized prompts with visual controls and AI assistance.", gradient: "from-amber-500 to-orange-400", href: "/tools/prompt-builder" },
            ].map((tool, i) => (
              <motion.div
                key={tool.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
              >
                <Link href={tool.href}>
                  <div className="group relative p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-border/80 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5 h-full cursor-pointer">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                      <tool.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold mb-2 group-hover:text-primary transition-colors">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </div>
                </Link>
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
            <Button asChild variant="outline" size="lg" className="font-medium gap-2 bg-transparent">
              <Link href="/tools">
                <Wrench className="h-4 w-4" />
                Explore All Tools
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Video Studio Section */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-[100px]" />
        <div className="container relative">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-fuchsia-400 mb-3 uppercase tracking-widest"
            >
              New: Video Studio
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            >
              Complete Video{" "}
              <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">Creation Suite</span>
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground max-w-xl mx-auto text-lg"
            >
              From storyboard to final cut — AI-powered tools for every stage of video production.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Layers, title: "Storyboard Generator", desc: "Turn concepts into multi-scene visual storyboards with AI-generated frames.", gradient: "from-amber-500 to-orange-500", href: "/video-studio/storyboard" },
              { icon: CameraIcon, title: "Scene Director", desc: "Compose keyframe sequences with professional camera direction and lighting.", gradient: "from-cyan-500 to-blue-500", href: "/video-studio/scene-director" },
              { icon: Palette, title: "Video Style Transfer", desc: "Apply cinematic styles — anime, noir, watercolor, claymation, and more.", gradient: "from-violet-500 to-purple-500", href: "/video-studio/style-transfer" },
              { icon: Zap, title: "Video Upscaler", desc: "Enhance frame resolution up to 4x with AI denoising and detail sharpening.", gradient: "from-emerald-500 to-teal-500", href: "/video-studio/upscaler" },
              { icon: Music, title: "Soundtrack Suggester", desc: "Get AI music recommendations with genre, tempo, and reference tracks.", gradient: "from-pink-500 to-rose-500", href: "/video-studio/soundtrack" },
              { icon: FileText, title: "Script Writer", desc: "Convert concepts into production-ready scripts with scene breakdowns.", gradient: "from-indigo-500 to-violet-500", href: "/video-studio/script" },
            ].map((tool, i) => (
              <motion.div
                key={tool.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={scaleIn}
                custom={i}
              >
                <Link href={tool.href}>
                  <div className="group relative p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-fuchsia-500/30 transition-all duration-500 hover:shadow-lg hover:shadow-fuchsia-500/5 h-full cursor-pointer">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                      <tool.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold mb-2 group-hover:text-fuchsia-400 transition-colors">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </div>
                </Link>
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
            <Button asChild size="lg" className="font-medium gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-700 hover:to-violet-700">
              <Link href="/video-studio">
                <Film className="h-4 w-4" />
                Open Video Studio
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Pro Features Section */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="container relative">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-emerald-400 mb-3 uppercase tracking-widest"
            >
              Professional Tools
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            >
              Built for{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Serious Creators</span>
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground max-w-xl mx-auto text-lg"
            >
              Character consistency, brand kits, model comparison, smart search, and API access.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Users, title: "Character Library", desc: "Create persistent characters with detailed descriptions and style notes for consistent output across all generations.", gradient: "from-emerald-500 to-teal-500", href: "/characters" },
              { icon: Palette, title: "Brand Kits", desc: "Save color palettes, typography, and style prompts as reusable presets. Start from built-in style presets.", gradient: "from-amber-500 to-orange-500", href: "/brand-kits" },
              { icon: Layers, title: "Model Comparison", desc: "Generate the same prompt across multiple AI models side-by-side to find the perfect output.", gradient: "from-blue-500 to-indigo-500", href: "/models" },
              { icon: Eye, title: "Smart Search", desc: "Search your entire generation history by prompt, media type, and status with instant filtering.", gradient: "from-violet-500 to-purple-500", href: "/search" },
              { icon: Wand2, title: "AI Prompt Assistant", desc: "Improve any prompt with AI-powered suggestions. Get style, mood, composition, and lighting tips.", gradient: "from-pink-500 to-rose-500", href: "/workspace" },
              { icon: Zap, title: "Public API", desc: "Integrate DreamForge into your apps with our REST API. Generate images, run tools, and manage projects programmatically.", gradient: "from-cyan-500 to-blue-500", href: "/api-docs" },
            ].map((tool, i) => (
              <motion.div
                key={tool.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={scaleIn}
                custom={i}
              >
                <Link href={tool.href}>
                  <div className="group relative p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-emerald-500/30 transition-all duration-500 hover:shadow-lg hover:shadow-emerald-500/5 h-full cursor-pointer">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient} shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                      <tool.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-base font-semibold mb-2 group-hover:text-emerald-400 transition-colors">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.desc}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="container relative">
          <div className="max-w-2xl mx-auto text-center">
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-5xl font-bold tracking-tight mb-6"
            >
              Ready to Create?
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground mb-10 max-w-lg mx-auto text-lg"
            >
              Join thousands of creators using AI to bring their ideas to life. Start generating images and videos today.
            </motion.p>
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
            >
              {isAuthenticated ? (
                <Button asChild size="lg" className="font-medium gap-2 px-10 h-12 text-base glow-primary">
                  <Link href="/workspace">
                    Start Creating
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-10 h-12 text-base glow-primary"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Get Started Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Bottom Note */}
      <section className="pb-8">
        <div className="container">
          <p className="text-center text-xs text-muted-foreground/60">
            All content generated by DreamForge is AI-created. No real individuals are depicted.
          </p>
        </div>
      </section>
    </PageLayout>
  );
}
