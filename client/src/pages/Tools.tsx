import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Maximize, Palette, Scissors, Wand2, ArrowRight, Sparkles,
  PenTool, Smile, Expand, Eraser, Type, Blend, PenLine,
  SunMedium, Pipette, Image, Video,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import type { LucideIcon } from "lucide-react";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } };

interface GridTool {
  title: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  img: string;
}

const gridTools: GridTool[] = [
  { title: "Image Upscaler", desc: "Enhance resolution with AI upscaling", icon: Maximize, href: "/tools/upscaler", img: "/showcase/tool-upscale.jpg" },
  { title: "Background Remove", desc: "Isolate subjects with clean edges", icon: Scissors, href: "/tools/background", img: "/showcase/demo-bg-after.jpg" },
  { title: "Inpainting", desc: "Edit regions with natural language", icon: PenTool, href: "/tools/inpainting", img: "/showcase/gallery-7.jpg" },
  { title: "Outpainting", desc: "Extend images beyond their borders", icon: Expand, href: "/tools/outpainting", img: "/showcase/gallery-6.jpg" },
  { title: "Face Enhancer", desc: "AI-powered portrait retouching", icon: Smile, href: "/tools/face-enhancer", img: "/showcase/gallery-5.jpg" },
  { title: "Color Grading", desc: "Cinematic film looks and presets", icon: SunMedium, href: "/tools/color-grading", img: "/showcase/gallery-8.jpg" },
  { title: "Prompt Builder", desc: "Craft perfect prompts visually", icon: Wand2, href: "/tools/prompt-builder", img: "/showcase/gallery-11.jpg" },
  { title: "Text Effects", desc: "Stunning stylized AI text art", icon: Type, href: "/tools/text-effects", img: "/showcase/gallery-12.jpg" },
  { title: "Image Blender", desc: "Merge two images creatively", icon: Blend, href: "/tools/image-blender", img: "/showcase/gallery-9.jpg" },
  { title: "Sketch to Image", desc: "Turn drawings into polished art", icon: PenLine, href: "/tools/sketch-to-image", img: "/showcase/gallery-3.jpg" },
  { title: "Color Palette", desc: "Extract colors and harmonies", icon: Pipette, href: "/tools/color-palette", img: "/showcase/gallery-1.jpg" },
  { title: "Object Eraser", desc: "Remove unwanted objects cleanly", icon: Eraser, href: "/tools/object-eraser", img: "/showcase/gallery-10.jpg" },
];

export default function Tools() {
  const { isAuthenticated } = useAuth();

  const cta = (href: string, label: string) =>
    isAuthenticated ? (
      <Link href={href}>
        <Button size="lg" className="font-semibold gap-2">
          {label} <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    ) : (
      <Button size="lg" className="font-semibold" onClick={() => (window.location.href = getLoginUrl())}>
        Sign in to Start
      </Button>
    );

  return (
    <PageLayout>
      <div className="min-h-screen">
        {/* Hero */}
        <section className="relative h-[520px] flex items-center justify-center overflow-hidden">
          <img src="/showcase/gallery-4.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible"
            transition={{ duration: 0.7 }}
            className="relative text-center px-4 max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-400/30 bg-purple-500/10 text-purple-300 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" /> AI-Powered Creative Suite
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                15 Professional Tools
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-8">
              Transform your creative workflow with studio-grade AI
            </p>
            {cta("/workspace", "Start Creating")}
          </motion.div>
        </section>

        {/* Featured Tools */}
        <section className="container max-w-6xl py-16 space-y-8">
          {/* Text-to-Image */}
          <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <Link href="/workspace">
              <div className="group grid md:grid-cols-2 rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all duration-300 hover:scale-[1.01]">
                <div className="aspect-[16/10] md:aspect-auto overflow-hidden">
                  <img src="/showcase/gallery-2.jpg" alt="Text to Image" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                      <Image className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Flagship</span>
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold mb-3">Text-to-Image Generation</h3>
                  <p className="text-foreground/60 mb-2">Generate any scene from a text prompt with photorealistic quality.</p>
                  <p className="text-foreground/50 text-sm mb-6">Choose from 3 AI models: Grok, DALL-E 3, Gemini</p>
                  <Button variant="outline" className="w-fit gap-2 group-hover:border-purple-500/50">
                    Try It <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Style Transfer */}
          <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
            <Link href="/tools/style-transfer">
              <div className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all duration-300 hover:scale-[1.01]">
                <div className="p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                      <Palette className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Creative</span>
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold mb-3">Style Transfer</h3>
                  <p className="text-foreground/60 mb-6">Transform any image into any artistic style — Van Gogh, anime, cyberpunk, and more.</p>
                </div>
                <div className="grid grid-cols-2 gap-1 px-8 pb-8 lg:px-12 lg:pb-12">
                  <div className="rounded-xl overflow-hidden relative">
                    <img src="/showcase/demo-style-before.jpg" alt="Before" className="w-full aspect-[4/3] object-cover" />
                    <span className="absolute bottom-2 left-2 text-xs font-medium bg-black/60 px-2 py-0.5 rounded text-white">Before</span>
                  </div>
                  <div className="rounded-xl overflow-hidden relative">
                    <img src="/showcase/demo-style-after.jpg" alt="After" className="w-full aspect-[4/3] object-cover" />
                    <span className="absolute bottom-2 left-2 text-xs font-medium bg-black/60 px-2 py-0.5 rounded text-white">After</span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* AI Video */}
          <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Link href="/video-studio">
              <div className="group relative rounded-2xl overflow-hidden h-72 hover:scale-[1.01] transition-all duration-300">
                <img src="/showcase/tool-video.jpg" alt="AI Video" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                <div className="relative h-full flex flex-col justify-center p-8 lg:p-12 max-w-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <Video className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Motion</span>
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">AI Video Generation</h3>
                  <p className="text-white/70 mb-6">Bring still images to life with cinematic motion</p>
                  <Button variant="outline" className="w-fit gap-2 border-white/20 text-white hover:bg-white/10">
                    Try It <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Link>
          </motion.div>
        </section>

        {/* All Tools Grid */}
        <section className="container max-w-6xl pb-16">
          <motion.h2
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            Every Tool You Need
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gridTools.map((tool, i) => (
              <motion.div
                key={tool.title}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Link href={tool.href}>
                  <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.03] transition-transform duration-300">
                    <img
                      src={tool.img} alt={tool.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center mb-2">
                        <tool.icon className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="text-white font-semibold text-sm">{tool.title}</h3>
                      <p className="text-white/60 text-xs mt-0.5">{tool.desc}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="container max-w-3xl pb-20">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center rounded-2xl bg-gradient-to-br from-purple-500/10 via-transparent to-fuchsia-500/10 border border-purple-500/20 p-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to Transform Your Workflow?</h2>
            <p className="text-foreground/60 mb-8">All 15 tools, unlimited creativity, zero friction.</p>
            {cta("/workspace", "Get Started Free")}
          </motion.div>
        </section>
      </div>
    </PageLayout>
  );
}
