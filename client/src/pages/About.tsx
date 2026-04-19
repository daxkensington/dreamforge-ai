import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import PageLayout from "@/components/PageLayout";
import { motion } from "framer-motion";
import {
  Sparkles,
  Zap,
  Shield,
  Heart,
  Globe,
  Cpu,
  Layers,
  Lock,
  Rocket,
  Wand2,
  Image as ImageIcon,
  Film,
  Music,
  ArrowRight,
  Server,
  Eye,
  Star,
} from "lucide-react";
import { Link } from "wouter";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const stats = [
  { value: "100+", label: "Creative Tools" },
  { value: "30+", label: "AI Models" },
  { value: "13", label: "Provider Integrations" },
  { value: "4K", label: "Max Resolution" },
];

const principles = [
  {
    icon: Sparkles,
    title: "Best models, one platform",
    desc: "Flux, Runway, Kling, Veo 3, Wan 2.5, DALL-E 3, Gemini, Grok, Seedream, MusicGen, Bark — under one account, one credit balance, no model lock-in.",
  },
  {
    icon: Server,
    title: "Self-hosted where it matters",
    desc: "We run our own GPU workers for Flux, CogVideoX, MusicGen, AudioGen, Bark, ESRGAN, CatVTON, and more — so you get faster queues, lower prices, and exclusive LoRA styles you can't get anywhere else.",
  },
  {
    icon: Layers,
    title: "Built for production",
    desc: "Batch processing, brand kits, character sheets, marketplace, API access, and a real workspace — not a chat box. Built so you can ship, not just play.",
  },
  {
    icon: Shield,
    title: "Honest about uptime",
    desc: "Provider down? We tell you. Sitewide status banner, per-provider health, automatic failover when a model goes degraded. No spinning forever, no silent failures.",
  },
  {
    icon: Lock,
    title: "Your work is yours",
    desc: "Commercial rights on all paid plans. Private workspace by default. Submit to the gallery only when you choose. No training on your prompts.",
  },
  {
    icon: Heart,
    title: "Built by creators, for creators",
    desc: "DreamForgeX is independently operated. We answer to users, not investors. If a feature would be cool but doesn't help you ship, we don't build it.",
  },
];

const techStack = [
  { name: "Flux Pro / Dev / Schnell", category: "Image" },
  { name: "DALL-E 3", category: "Image" },
  { name: "Gemini Imagen", category: "Image" },
  { name: "Grok Imagine", category: "Image" },
  { name: "Seedream", category: "Image" },
  { name: "Runway Gen-4.5", category: "Video" },
  { name: "Kling 2.0", category: "Video" },
  { name: "Veo 3", category: "Video" },
  { name: "Wan 2.5", category: "Video" },
  { name: "CogVideoX-5B", category: "Video" },
  { name: "MusicGen", category: "Audio" },
  { name: "AudioGen", category: "Audio" },
  { name: "Bark TTS", category: "Audio" },
  { name: "Stable Audio", category: "Audio" },
  { name: "Sync Labs", category: "Audio" },
  { name: "CatVTON", category: "Specialty" },
  { name: "ESRGAN 4x", category: "Specialty" },
  { name: "DreamForge LoRA", category: "Specialty" },
];

const milestones = [
  { phase: "Phase 1", title: "The studio", desc: "Workspace, gallery, marketplace, brand kits, character sheets" },
  { phase: "Phase 2", title: "100+ tools", desc: "Headshots, logos, upscaling, virtual try-on, comic strips, 3D models, pet portraits, tarot cards, fashion lookbooks, movie posters, and dozens more" },
  { phase: "Phase 3", title: "Self-hosted GPUs", desc: "Our own RunPod fleet for Flux, video, audio, and exclusive LoRAs" },
  { phase: "Phase 4", title: "Reliability layer", desc: "Provider kill-switch, status banner, auto-degrade, failure telemetry" },
  { phase: "Phase 5", title: "Multi-provider fallback", desc: "Every external tool has a backup chain — relight, 3D, image-to-video all fall over cleanly when a provider blinks" },
];

export default function About() {
  const { isAuthenticated } = useAuth();

  return (
    <PageLayout>
      {/* ═══════ HERO ═══════ */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0">
          <img
            src="/showcase/hero-forge.jpg"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/85 to-black" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-24 md:py-32 lg:py-40 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 mb-8"
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white/90">About DreamForgeX</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.05] text-white"
            style={{ textShadow: "0 4px 30px rgba(0,0,0,0.8)" }}
          >
            One platform.<br />
            <span className="gradient-text">Every creative AI worth using.</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-lg md:text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            DreamForgeX is the creative studio for people who use AI to ship — not just to scroll.
            Images, video, music, voice, 3D, virtual try-on, and 100+ specialized tools, all in one workspace.
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
                  Open Studio
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
            <Button
              asChild
              variant="outline"
              size="lg"
              className="font-medium gap-2 px-8 h-13 text-base bg-transparent border-white/20 hover:bg-white/10"
            >
              <Link href="/tools">
                <Wand2 className="h-5 w-5" />
                Browse 100+ Tools
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ═══════ STATS BAR ═══════ */}
      <section className="border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="px-4 py-8 md:py-10 text-center"
              >
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold gradient-text mb-2">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm uppercase tracking-widest text-white/50">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ MISSION ═══════ */}
      <section className="py-20 md:py-28 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em]"
          >
            Why we built this
          </motion.p>
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-8 text-white leading-tight"
          >
            Every AI tool used to live in its own tab.
            <br />
            <span className="gradient-text">We put them in one studio.</span>
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="space-y-6 text-lg text-white/70 leading-relaxed text-left"
          >
            <p>
              If you make things with AI, you know the routine: one site for Flux, another for Runway,
              another for music, another for voice, three more for the niche stuff. Different logins,
              different credits, different prompt formats, different prices, different reliability.
            </p>
            <p>
              We got tired of it. So we built DreamForgeX — a single workspace where every creative AI
              worth using lives behind one credit balance. The big-name foundation models. Self-hosted
              specialty workers we run on our own GPUs. Exclusive LoRA styles you can't get anywhere
              else. All wired into a real studio with brand kits, character sheets, batch processing,
              a marketplace, and an API.
            </p>
            <p>
              We charge fairly, ship constantly, and tell you the truth when something's broken. That's
              the whole pitch.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ PRINCIPLES ═══════ */}
      <section className="py-20 md:py-28 border-t border-white/10 bg-gradient-to-b from-black/0 via-black/40 to-black/0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em]"
            >
              How we operate
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white"
            >
              Six things <span className="gradient-text">we won't compromise on</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {principles.map((p, i) => (
              <motion.div
                key={p.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
                className="group relative rounded-2xl p-6 bg-white/5 backdrop-blur-sm border border-white/10 hover:border-cyan-500/40 transition-all duration-500"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <p.icon className="h-6 w-6 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">{p.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TECH STACK ═══════ */}
      <section className="py-20 md:py-28 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em]"
            >
              The model lineup
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4"
            >
              Every model worth its <span className="gradient-text">credits</span>
            </motion.h2>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={2}
              className="text-white/60 max-w-2xl mx-auto"
            >
              Pick the right tool for the job. We add new models as they ship — and retire ones that don't earn their place.
            </motion.p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {techStack.map((m, i) => (
              <motion.div
                key={m.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i * 0.5}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-white/10 transition-all"
              >
                <span className="text-sm font-medium text-white">{m.name}</span>
                <span className="ml-2 text-xs text-cyan-400/70">{m.category}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ TIMELINE ═══════ */}
      <section className="py-20 md:py-28 border-t border-white/10 bg-gradient-to-b from-black/0 via-black/40 to-black/0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={0}
              className="text-sm font-medium text-cyan-400 mb-4 uppercase tracking-[0.2em]"
            >
              The road so far
            </motion.p>
            <motion.h2
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white"
            >
              Built in the open, <span className="gradient-text">shipped weekly</span>
            </motion.h2>
          </div>

          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/0 via-cyan-500/40 to-cyan-500/0" />
            <div className="space-y-8">
              {milestones.map((m, i) => (
                <motion.div
                  key={m.phase}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                  custom={i}
                  className="relative pl-20"
                >
                  <div className="absolute left-0 top-2 w-16 h-16 rounded-2xl bg-black border border-cyan-500/40 flex items-center justify-center">
                    <Rocket className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div className="text-xs uppercase tracking-widest text-cyan-400 mb-1">{m.phase}</div>
                  <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{m.title}</h3>
                  <p className="text-white/60">{m.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section className="py-20 md:py-28 border-t border-white/10 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/showcase/hero-2.jpg" alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/85 to-black" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 mb-8"
          >
            <Star className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white/90">Free forever plan — no card required</span>
          </motion.div>

          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
            className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6 text-white"
          >
            Make something <span className="gradient-text">today</span>
          </motion.h2>

          <motion.p
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={2}
            className="text-lg text-white/70 mb-10"
          >
            50 free credits a day. Every model, every tool, no watermarks on paid plans, commercial rights when you upgrade.
          </motion.p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {isAuthenticated ? (
              <Button asChild size="lg" className="font-medium gap-2 px-8 h-13 text-base glow-primary">
                <Link href="/workspace">
                  Open Studio <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            ) : (
              <Button
                size="lg"
                className="font-medium gap-2 px-8 h-13 text-base glow-primary"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Start Creating Free <ArrowRight className="h-5 w-5" />
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="font-medium gap-2 px-8 h-13 text-base bg-transparent border-white/20 hover:bg-white/10"
            >
              <Link href="/pricing">
                See Pricing
              </Link>
            </Button>
          </motion.div>

          <p className="mt-12 text-sm text-white/40">
            Questions? <a href="mailto:support@dreamforgex.ai" className="text-cyan-400 hover:text-cyan-300 transition">support@dreamforgex.ai</a>
          </p>
        </div>
      </section>
    </PageLayout>
  );
}
