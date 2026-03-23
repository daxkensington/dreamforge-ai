import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Maximize,
  Palette,
  Scissors,
  Wand2,
  ArrowRight,
  Sparkles,
  Zap,
  Star,
  Pipette,
  Layers,
  PenTool,
  Smile,
  ScanSearch,
  Expand,
  Eraser,
  Type,
  Blend,
  PenLine,
  SunMedium,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

const tools = [
  {
    id: "upscaler",
    title: "Image Upscaler",
    description: "Enhance resolution and sharpen details. Transform low-res images into crisp, high-quality visuals with AI-powered upscaling.",
    icon: Maximize,
    href: "/tools/upscaler",
    gradient: "from-blue-500 to-cyan-400",
    bgGlow: "bg-blue-500/10",
    badge: "Popular",
    features: ["2x & 4x upscaling", "Detail enhancement", "Noise reduction"],
  },
  {
    id: "style-transfer",
    title: "Style Transfer",
    description: "Apply artistic styles to any image. Transform photos into oil paintings, watercolors, anime, cyberpunk, and more.",
    icon: Palette,
    href: "/tools/style-transfer",
    gradient: "from-violet-500 to-fuchsia-400",
    bgGlow: "bg-violet-500/10",
    badge: "Creative",
    features: ["10 art styles", "Adjustable intensity", "Instant preview"],
  },
  {
    id: "background",
    title: "Background Editor",
    description: "Remove or replace backgrounds instantly. Isolate subjects with clean edges or place them in entirely new scenes.",
    icon: Scissors,
    href: "/tools/background",
    gradient: "from-emerald-500 to-teal-400",
    bgGlow: "bg-emerald-500/10",
    badge: "Essential",
    features: ["Background removal", "Scene replacement", "Clean edges"],
  },
  {
    id: "prompt-builder",
    title: "Smart Prompt Builder",
    description: "Craft the perfect prompt with visual controls. Our AI assembles optimized prompts from your creative inputs.",
    icon: Wand2,
    href: "/tools/prompt-builder",
    gradient: "from-amber-500 to-orange-400",
    bgGlow: "bg-amber-500/10",
    badge: "AI-Powered",
    features: ["Visual controls", "Style presets", "One-click generate"],
  },
  {
    id: "color-palette",
    title: "Color Palette Extractor",
    description: "Extract dominant colors from any image and discover harmonious palettes, complementary schemes, and mood analysis.",
    icon: Pipette,
    href: "/tools/color-palette",
    gradient: "from-pink-500 to-rose-400",
    bgGlow: "bg-pink-500/10",
    badge: "New",
    features: ["Hex extraction", "Color harmonies", "Mood analysis"],
  },
  {
    id: "variations",
    title: "Image Variations",
    description: "Generate multiple creative variations of any image with different styles, moods, and artistic interpretations.",
    icon: Layers,
    href: "/tools/variations",
    gradient: "from-indigo-500 to-purple-400",
    bgGlow: "bg-indigo-500/10",
    badge: "New",
    features: ["2-6 variations", "4 style modes", "Batch download"],
  },
  {
    id: "inpainting",
    title: "Inpainting Editor",
    description: "Edit specific parts of your image with natural language. Describe what to change and AI handles the rest.",
    icon: PenTool,
    href: "/tools/inpainting",
    gradient: "from-teal-500 to-cyan-400",
    bgGlow: "bg-teal-500/10",
    badge: "New",
    features: ["Text-based editing", "Region targeting", "Style preservation"],
  },
  {
    id: "face-enhancer",
    title: "Face Enhancer",
    description: "Enhance and restore portrait quality with AI-powered retouching. Fix artifacts, sharpen details, and improve faces.",
    icon: Smile,
    href: "/tools/face-enhancer",
    gradient: "from-rose-500 to-pink-400",
    bgGlow: "bg-rose-500/10",
    badge: "New",
    features: ["3 enhancement levels", "Identity preservation", "Portrait retouching"],
  },
  {
    id: "image-to-prompt",
    title: "Image to Prompt",
    description: "Reverse-engineer any image into a detailed generation prompt. Analyze style, mood, composition, and more.",
    icon: ScanSearch,
    href: "/tools/image-to-prompt",
    gradient: "from-amber-500 to-yellow-400",
    bgGlow: "bg-amber-500/10",
    badge: "New",
    features: ["Prompt extraction", "Tag detection", "Use in Studio"],
  },
  {
    id: "outpainting",
    title: "Image Expander",
    description: "Extend images beyond their borders with AI outpainting. Choose direction, expansion size, and describe the fill content.",
    icon: Expand,
    href: "/tools/outpainting",
    gradient: "from-sky-500 to-cyan-400",
    bgGlow: "bg-sky-500/10",
    badge: "New",
    features: ["5 directions", "3 expansion sizes", "Custom fill"],
  },
  {
    id: "object-eraser",
    title: "Object Eraser",
    description: "Remove unwanted objects from images cleanly. Describe what to remove and AI fills the gap naturally.",
    icon: Eraser,
    href: "/tools/object-eraser",
    gradient: "from-rose-500 to-pink-400",
    bgGlow: "bg-rose-500/10",
    badge: "New",
    features: ["Smart removal", "3 fill methods", "Quick presets"],
  },
  {
    id: "text-effects",
    title: "AI Text Effects",
    description: "Generate stunning stylized text with AI-powered effects. Fire, neon, gold, ice, galaxy, and more.",
    icon: Type,
    href: "/tools/text-effects",
    gradient: "from-amber-500 to-orange-400",
    bgGlow: "bg-amber-500/10",
    badge: "Creative",
    features: ["10 effect styles", "4 backgrounds", "4 sizes"],
  },
  {
    id: "image-blender",
    title: "Image Blender",
    description: "Blend and mashup two images into one creative output. Merge, double-exposure, collage, morph, or dreamscape.",
    icon: Blend,
    href: "/tools/image-blender",
    gradient: "from-fuchsia-500 to-violet-500",
    bgGlow: "bg-fuchsia-500/10",
    badge: "Creative",
    features: ["5 blend modes", "Strength control", "Dual upload"],
  },
  {
    id: "sketch-to-image",
    title: "Sketch to Image",
    description: "Transform rough sketches and drawings into polished images. Choose output style and fidelity level.",
    icon: PenLine,
    href: "/tools/sketch-to-image",
    gradient: "from-teal-500 to-emerald-400",
    bgGlow: "bg-teal-500/10",
    badge: "New",
    features: ["6 output styles", "3 fidelity levels", "Description hints"],
  },
  {
    id: "color-grading",
    title: "AI Color Grading",
    description: "Apply cinematic color grades and film looks to your images. 10 professional presets with adjustable intensity.",
    icon: SunMedium,
    href: "/tools/color-grading",
    gradient: "from-orange-500 to-amber-400",
    bgGlow: "bg-orange-500/10",
    badge: "New",
    features: ["10 film grades", "3 intensities", "Before/after"],
  },
];

export default function Tools() {
  const { isAuthenticated } = useAuth();

  return (
    <PageLayout>
      <div className="min-h-[calc(100vh-4rem)]">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

          <div className="container relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI-Powered Creative Suite</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                <span className="gradient-text">AI Tools</span>
                <br />
                <span className="text-foreground">for Every Creative Need</span>
              </h1>

              <p className="text-lg text-foreground/70 max-w-2xl mx-auto mb-8">
                15 professional-grade AI tools that transform your creative workflow.
                Upscale, stylize, edit, blend, sketch, grade, and build — all in one place.
              </p>

              <div className="flex items-center justify-center gap-6 text-sm text-foreground/60">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span>Instant Processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" />
                  <span>Pro Quality</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>AI-Enhanced</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Tools Grid */}
        <section className="container pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="group relative overflow-hidden border-border/50 bg-white/5 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 h-full">
                  {/* Glow effect on hover */}
                  <div className={`absolute inset-0 ${tool.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                  <CardContent className="relative p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} shadow-lg`}>
                        <tool.icon className="h-7 w-7 text-white" />
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {tool.badge}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                      {tool.title}
                    </h3>

                    <p className="text-foreground/60 text-sm leading-relaxed mb-6">
                      {tool.description}
                    </p>

                    {/* Feature chips */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {tool.features.map((feature) => (
                        <span
                          key={feature}
                          className="text-xs px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground border border-border/50"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    {isAuthenticated ? (
                      <Link href={tool.href}>
                        <Button className="w-full group/btn" variant="outline">
                          <span>Open Tool</span>
                          <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => (window.location.href = getLoginUrl())}
                      >
                        Sign in to Use
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 overflow-hidden">
              <CardContent className="p-10">
                <h2 className="text-2xl font-bold mb-3">Need More Power?</h2>
                <p className="text-muted-foreground mb-6">
                  Head to the Studio for full image and video generation with advanced controls,
                  model selection, and animation tools.
                </p>
                {isAuthenticated ? (
                  <Link href="/workspace">
                    <Button size="lg" className="font-medium">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Open Studio
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    className="font-medium"
                    onClick={() => (window.location.href = getLoginUrl())}
                  >
                    Get Started Free
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </div>
    </PageLayout>
  );
}
