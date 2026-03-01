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
  Video,
  Cpu,
  BarChart3,
  Lock,
  Film,
  Wand2,
  Globe,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useCallback } from "react";

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
    title: "AI Prompt Workspace",
    desc: "Craft natural-language descriptions and generate fictional synthetic media with AI-powered prompt enhancement.",
    gradient: "from-violet-500/20 to-indigo-500/20",
    iconColor: "text-violet-400",
  },
  {
    icon: Film,
    title: "Video Generation Engine",
    desc: "Generate 2-8 second synthetic video clips from text using AnimateDiff. Control duration, resolution, and motion style.",
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    iconColor: "text-fuchsia-400",
  },
  {
    icon: Image,
    title: "Research Gallery",
    desc: "Browse approved synthetic outputs with advanced taxonomic tagging for systematic academic study.",
    gradient: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Search,
    title: "Advanced Search & Filter",
    desc: "Filter by tags, date, model version, and media type. Sort by newest, oldest, or most viewed.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Shield,
    title: "Moderation Queue",
    desc: "All submissions pass through researcher-led review ensuring quality and alignment with research ethics.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Download,
    title: "ZIP Export Tools",
    desc: "Download generated assets with complete prompt metadata as ZIP archives ready for academic papers.",
    gradient: "from-purple-500/20 to-fuchsia-500/20",
    iconColor: "text-purple-400",
  },
];

const principles = [
  { icon: Lock, title: "Zero Real People", desc: "All content is 100% mathematically generated. No real individuals are depicted or referenced." },
  { icon: Cpu, title: "Open Models", desc: "Built on open-source diffusion architectures for full transparency and reproducibility." },
  { icon: BarChart3, title: "Research-First", desc: "Every feature designed to support peer-reviewed academic study of synthetic media." },
  { icon: Layers, title: "Taxonomic Tagging", desc: "Structured classification across genres, themes, styles, and subjects for rigorous analysis." },
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
        hue: Math.random() * 60 + 250, // violet to blue range
      });
    }

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const p of particles) {
        // Mouse interaction - gentle attraction
        const dmx = mx - p.x;
        const dmy = my - p.y;
        const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);
        if (distMouse < 200 && distMouse > 0) {
          const force = 0.02 * (1 - distMouse / 200);
          p.vx += (dmx / distMouse) * force;
          p.vy += (dmy / distMouse) * force;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // Pulsing opacity
        const pulse = Math.sin(Date.now() * 0.001 + p.hue) * 0.15;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.o + pulse})`;
        ctx.fill();
      }

      // Draw connections
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

  return (
    <PageLayout>
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
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                Academic Research Platform
              </span>
              <span className="h-1 w-1 rounded-full bg-primary/50" />
              <span className="text-xs text-muted-foreground">v2.0</span>
            </motion.div>

            <motion.h1
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
            >
              The Future of{" "}
              <span className="gradient-text">Synthetic Media</span>{" "}
              Research
            </motion.h1>

            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={2}
              className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              A controlled environment for scholars to study how diffusion-based models
              generate fictional visual content. Generate images and videos, analyze creativity
              and bias, and contribute to peer-reviewed research.
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
                    Open Workspace
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-8 h-12 text-base glow-primary"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  <Zap className="h-5 w-5" />
                  Get Started Free
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="font-medium gap-2 px-8 h-12 text-base bg-transparent">
                <Link href="/gallery">
                  <Eye className="h-5 w-5" />
                  Browse Gallery
                </Link>
              </Button>
            </motion.div>

            {/* Floating badges */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={4}
              className="flex flex-wrap items-center justify-center gap-3 mt-12"
            >
              {[
                { label: "Image Generation", icon: Image },
                { label: "Video Clips", icon: Film },
                { label: "AI Enhancement", icon: Wand2 },
                { label: "ZIP Export", icon: Download },
                { label: "Moderation", icon: Shield },
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
              { value: stats?.totalGenerations?.toLocaleString() ?? "0", label: "Generations", icon: Sparkles },
              { value: stats?.totalItems?.toLocaleString() ?? "0", label: "Gallery Items", icon: Image },
              { value: stats?.totalViews?.toLocaleString() ?? "0", label: "Research Views", icon: Eye },
              { value: "12", label: "Research Tags", icon: Layers },
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

      {/* Video Generation Highlight */}
      <section className="py-24 md:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-fuchsia-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px]" />
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
                  <Film className="h-3.5 w-3.5 text-fuchsia-400" />
                  <span className="text-xs font-medium text-fuchsia-400">New in v2.0</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
                  AI Video{" "}
                  <span className="gradient-text-warm">Generation</span>{" "}
                  Engine
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                  Generate 2-8 second synthetic video clips from text descriptions using AnimateDiff models.
                  Control duration, resolution, and motion style for your research needs.
                </p>
                <div className="space-y-3">
                  {[
                    "AnimateDiff v2 & Lightning models",
                    "Configurable 2-8 second duration",
                    "Up to 1024x1024 resolution",
                    "Cinematic motion & fluid animation",
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
                      <Video className="h-5 w-5 text-fuchsia-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Video Workspace</p>
                      <p className="text-xs text-muted-foreground">AnimateDiff v2</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-muted/30 border border-border/30 p-4">
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                      "A phoenix rising from crystalline flames, cinematic slow motion, particle effects, volumetric lighting"
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Film className="h-3 w-3" /> 4s clip</span>
                    <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> 768x768</span>
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> AnimateDiff</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">Generating video frames...</p>
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
              Platform Capabilities
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            >
              Built for Rigorous Research
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-muted-foreground max-w-xl mx-auto text-lg"
            >
              Every feature designed to support systematic academic study of generative AI outputs.
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

      {/* Research Principles */}
      <section className="py-24 border-t border-border/50 bg-card/20 relative overflow-hidden">
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
              Research Ethics
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Principled by Design
            </motion.h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {principles.map((p, i) => (
              <motion.div
                key={p.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="text-center p-6 rounded-2xl border border-border/30 bg-card/30 hover:bg-card/50 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Research Taxonomy */}
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
                Classification System
              </motion.p>
              <motion.h2
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={1}
                className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
              >
                Research Taxonomy
              </motion.h2>
              <motion.p
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={2}
                className="text-muted-foreground text-lg"
              >
                Structured academic classification across multiple dimensions.
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
                  className={`px-4 py-2 rounded-full text-sm font-medium border ${tag.color} transition-transform hover:scale-105`}
                >
                  {tag.label}
                </span>
              ))}
            </motion.div>
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
              Begin Your Research
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground mb-10 max-w-lg mx-auto text-lg"
            >
              Join scholars exploring the intersection of AI, creativity, and synthetic media generation.
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
                    Open Workspace
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="font-medium gap-2 px-10 h-12 text-base glow-primary"
                  onClick={() => (window.location.href = getLoginUrl())}
                >
                  Sign in to Start
                  <ArrowRight className="h-5 w-5" />
                </Button>
              )}
            </motion.div>
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
