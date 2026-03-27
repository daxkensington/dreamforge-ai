import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Maximize, Palette, Scissors, Wand2, ArrowRight, Sparkles,
  PenTool, Smile, Expand, Eraser, Type, Blend, PenLine,
  SunMedium, Pipette, Image, Video, ImagePlus, User, Hexagon,
  Monitor, QrCode, MessageSquare, CircleUser, ShoppingBag,
  FileText, Mic, AudioLines, Waves, Copy, Layers,
  Film, Grid3X3, ScanLine, Sun, AppWindow, Paintbrush,
  Music, Frame, Share2, Users, Laugh, Home, LayoutGrid, Smartphone,
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
  badge?: string;
}

// ─── Image Editing Tools ─────────────────────────────────────────────────────
const imageTools: GridTool[] = [
  { title: "Image Upscaler", desc: "Enhance resolution with AI upscaling", icon: Maximize, href: "/tools/upscaler", img: "/showcase/tool-upscale.jpg" },
  { title: "Background Remove", desc: "Isolate subjects with clean edges", icon: Scissors, href: "/tools/background", img: "/showcase/tool-bg-remove.jpg" },
  { title: "Inpainting", desc: "Edit regions with AI precision", icon: PenTool, href: "/tools/inpainting", img: "/showcase/tool-inpaint.jpg" },
  { title: "Outpainting", desc: "Extend images beyond borders", icon: Expand, href: "/tools/outpainting", img: "/showcase/tool-outpaint.jpg" },
  { title: "Face Enhancer", desc: "AI portrait retouching", icon: Smile, href: "/tools/face-enhancer", img: "/showcase/tool-face.jpg" },
  { title: "Color Grading", desc: "Cinematic film presets", icon: SunMedium, href: "/tools/color-grading", img: "/showcase/tool-colorgrade.jpg" },
  { title: "Style Transfer", desc: "Transform into any art style", icon: Palette, href: "/tools/style-transfer", img: "/showcase/tool-style-transfer.jpg" },
  { title: "Object Eraser", desc: "Remove unwanted objects", icon: Eraser, href: "/tools/object-eraser", img: "/showcase/tool-eraser.jpg" },
  { title: "Image Blender", desc: "Merge two images creatively", icon: Blend, href: "/tools/image-blender", img: "/showcase/tool-blend.jpg" },
  { title: "Variations", desc: "Generate creative variations", icon: Copy, href: "/tools/variations", img: "/showcase/tool-variations.jpg" },
  { title: "NL Image Editor", desc: "Edit by describing changes", icon: MessageSquare, href: "/tools/nl-edit", img: "/showcase/tool-nl-edit.jpg", badge: "New" },
  { title: "Photo Restorer", desc: "Restore old & damaged photos", icon: ImagePlus, href: "/tools/photo-restore", img: "/showcase/tool-restore.jpg", badge: "New" },
  { title: "HDR Enhancer", desc: "Transform lighting & contrast", icon: Sun, href: "/tools/hdr-enhance", img: "/showcase/tool-hdr.jpg", badge: "New" },
  { title: "Transparent PNG", desc: "Clean background removal", icon: Layers, href: "/tools/transparent-png", img: "/showcase/tool-transparent.jpg", badge: "New" },
  { title: "Panorama", desc: "Extend to panoramic views", icon: ScanLine, href: "/tools/panorama", img: "/showcase/tool-panorama.jpg", badge: "New" },
  { title: "Film & Grain", desc: "Vintage film effects", icon: Film, href: "/tools/film-grain", img: "/showcase/tool-filmgrain.jpg", badge: "New" },
  { title: "Depth Map", desc: "3D depth from 2D images", icon: Layers, href: "/tools/depth-map", img: "/showcase/tool-depthmap.jpg", badge: "New" },
];

// ─── Creative Generation Tools ───────────────────────────────────────────────
const creativeTools: GridTool[] = [
  { title: "AI Headshots", desc: "Professional headshots from any photo", icon: User, href: "/tools/headshot", img: "/showcase/tool-headshot.jpg", badge: "New" },
  { title: "Logo Maker", desc: "Generate logos for any brand", icon: Hexagon, href: "/tools/logo-maker", img: "/showcase/tool-logo.jpg", badge: "New" },
  { title: "AI Avatars", desc: "Custom avatars in any style", icon: CircleUser, href: "/tools/avatar", img: "/showcase/tool-avatar.jpg", badge: "New" },
  { title: "Wallpaper Gen", desc: "Stunning wallpapers for any device", icon: Monitor, href: "/tools/wallpaper", img: "/showcase/tool-wallpaper.jpg", badge: "New" },
  { title: "QR Code Art", desc: "Beautiful artistic QR codes", icon: QrCode, href: "/tools/qr-art", img: "/showcase/tool-qr.jpg", badge: "New" },
  { title: "Product Photos", desc: "Pro e-commerce photography", icon: ShoppingBag, href: "/tools/product-photo", img: "/showcase/tool-product.jpg", badge: "New" },
  { title: "Text Effects", desc: "Stunning stylized AI text art", icon: Type, href: "/tools/text-effects", img: "/showcase/tool-texteffect.jpg" },
  { title: "Sketch to Image", desc: "Turn drawings into art", icon: PenLine, href: "/tools/sketch-to-image", img: "/showcase/tool-sketch.jpg" },
  { title: "Vectorizer", desc: "Convert images to vector style", icon: PenTool, href: "/tools/vectorize", img: "/showcase/tool-vector.jpg", badge: "New" },
  { title: "Texture Generator", desc: "Seamless tileable textures", icon: Grid3X3, href: "/tools/texture", img: "/showcase/tool-texture.jpg", badge: "New" },
  { title: "Icon Generator", desc: "App icons & favicons", icon: AppWindow, href: "/tools/icon-gen", img: "/showcase/tool-icon.jpg", badge: "New" },
  { title: "AI Canvas", desc: "Draw & AI transforms live", icon: Paintbrush, href: "/tools/canvas", img: "/showcase/tool-canvas.jpg", badge: "New" },
  { title: "Mockup Generator", desc: "Place designs on products", icon: Frame, href: "/tools/mockup", img: "/showcase/tool-mockup.jpg", badge: "New" },
  { title: "Thumbnails", desc: "YouTube & social thumbnails", icon: Image, href: "/tools/thumbnail", img: "/showcase/tool-thumbnail.jpg", badge: "New" },
  { title: "Character Sheets", desc: "Consistent character designs", icon: Users, href: "/tools/character-sheet", img: "/showcase/tool-charsheet.jpg", badge: "New" },
  { title: "Meme Generator", desc: "AI-powered viral memes", icon: Laugh, href: "/tools/meme", img: "/showcase/tool-meme.jpg", badge: "New" },
  { title: "Interior Design", desc: "AI room redesign", icon: Home, href: "/tools/interior-design", img: "/showcase/tool-interior.jpg", badge: "New" },
  { title: "Collage Maker", desc: "AI-arranged photo collages", icon: LayoutGrid, href: "/tools/collage", img: "/showcase/tool-collage.jpg", badge: "New" },
];

// ─── Video Generation Tools ──────────────────────────────────────────────────
const videoTools: GridTool[] = [
  { title: "Text-to-Video", desc: "Generate video from text prompts", icon: Video, href: "/tools/text-to-video", img: "/showcase/tool-t2v.jpg" },
  { title: "Image-to-Video", desc: "Animate still images", icon: Film, href: "/tools/image-to-video", img: "/showcase/tool-i2v.jpg" },
  { title: "Music Video Studio", desc: "Create AI music videos from your photo", icon: Film, href: "/tools/music-video", img: "/showcase/tool-music-video.jpg", badge: "New" },
  { title: "Social Templates", desc: "TikTok, Reels & Shorts templates", icon: Smartphone, href: "/tools/social-templates", img: "/showcase/tool-social-templates.jpg", badge: "New" },
  { title: "Viral Clip Maker", desc: "AI picks best moments for clips", icon: Scissors, href: "/tools/clip-maker", img: "/showcase/tool-clip-maker.jpg", badge: "New" },
];

// ─── Workflow Tools ──────────────────────────────────────────────────────────
const workflowTools: GridTool[] = [
  { title: "Image Templates", desc: "25+ templates: posts, ads, cards, flyers", icon: LayoutGrid, href: "/tools/templates", img: "/showcase/tool-image-templates.jpg", badge: "Hot" },
  { title: "AI Presentations", desc: "Full slide decks from a description", icon: Layers, href: "/tools/presentations", img: "/showcase/tool-presentations.jpg", badge: "Hot" },
  { title: "Batch Generator", desc: "Generate multiple images at once", icon: Layers, href: "/tools/batch-prompts", img: "/showcase/tool-batch.jpg" },
  { title: "Social Resizer", desc: "Auto-resize for all platforms", icon: Share2, href: "/tools/social-resize", img: "/showcase/tool-social.jpg" },
];

// ─── AI Utility Tools ────────────────────────────────────────────────────────
const utilityTools: GridTool[] = [
  { title: "Prompt Builder", desc: "Craft perfect prompts visually", icon: Wand2, href: "/tools/prompt-builder", img: "/showcase/tool-promptbuild.jpg" },
  { title: "Color Palette", desc: "Extract colors and harmonies", icon: Pipette, href: "/tools/color-palette", img: "/showcase/tool-palette.jpg" },
  { title: "Image-to-Prompt", desc: "Reverse-engineer any image's prompt", icon: FileText, href: "/tools/image-to-prompt", img: "/showcase/tool-img2prompt.jpg" },
  { title: "Image Caption", desc: "Alt text, social captions, SEO", icon: FileText, href: "/tools/image-caption", img: "/showcase/tool-caption.jpg" },
  { title: "Ad Copy Generator", desc: "Google, Facebook, TikTok ad copy", icon: FileText, href: "/tools/ad-copy", img: "/showcase/tool-adcopy.jpg", badge: "Hot" },
  { title: "Blog Writer", desc: "Full SEO blog posts with AI", icon: FileText, href: "/tools/blog-writer", img: "/showcase/tool-blog.jpg", badge: "Hot" },
  { title: "Caption Writer", desc: "Platform-perfect captions + hashtags", icon: FileText, href: "/tools/caption-writer", img: "/showcase/tool-captions.jpg", badge: "Hot" },
];

// ─── Audio Tools ─────────────────────────────────────────────────────────────
const audioTools: GridTool[] = [
  { title: "AI Song Creator", desc: "Full songs with vocals from a concept", icon: Music, href: "/tools/song-creator", img: "/showcase/tool-songcreator.jpg", badge: "Hot" },
  { title: "AI Music Composer", desc: "Generate instrumentals & scores", icon: Music, href: "/tools/music-gen", img: "/showcase/tool-audio.jpg" },
  { title: "Text-to-Speech", desc: "Natural AI voiceovers", icon: Mic, href: "/tools/text-to-speech", img: "/showcase/tool-tts.jpg" },
  { title: "Audio Enhancer", desc: "Professional audio cleanup", icon: AudioLines, href: "/tools/audio-enhance", img: "/showcase/tool-audio-enhance.jpg" },
  { title: "Sound Effects", desc: "Custom AI sound design", icon: Waves, href: "/tools/sound-effects", img: "/showcase/tool-sfx.jpg" },
];

const allToolCount = imageTools.length + creativeTools.length + videoTools.length + workflowTools.length + utilityTools.length + audioTools.length;

function ToolGrid({ tools, delay = 0 }: { tools: GridTool[]; delay?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tools.map((tool, i) => (
        <motion.div
          key={tool.title}
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          transition={{ duration: 0.4, delay: delay + i * 0.04 }}
        >
          <Link href={tool.href}>
            <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.03] transition-transform duration-300">
              <img
                src={tool.img} alt={tool.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              {tool.badge && (
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/90 text-white text-[10px] font-bold uppercase tracking-wider">
                    {tool.badge}
                  </span>
                </div>
              )}
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
  );
}

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
          <img src="/showcase/gallery-4.jpg" alt="AI generated showcase" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible"
            transition={{ duration: 0.7 }}
            className="relative text-center px-4 max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" /> AI-Powered Creative Suite
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                {allToolCount}+ Professional Tools
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 mb-8">
              Image editing, creative generation, audio production — everything you need in one studio
            </p>
            {cta("/workspace", "Start Creating")}
          </motion.div>
        </section>

        {/* Featured Tools */}
        <section className="container max-w-6xl py-16 space-y-8">
          {/* Text-to-Image */}
          <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <Link href="/workspace">
              <div className="group grid md:grid-cols-2 rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all duration-300 hover:scale-[1.01]">
                <div className="aspect-[16/10] md:aspect-auto overflow-hidden">
                  <img src="/showcase/gallery-2.jpg" alt="Text to Image" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-12">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <Image className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Flagship</span>
                  </div>
                  <h3 className="text-2xl lg:text-3xl font-bold mb-3">Text-to-Image Generation</h3>
                  <p className="text-foreground/60 mb-2">Generate any scene from a text prompt with photorealistic quality.</p>
                  <p className="text-foreground/50 text-sm mb-6">Choose from 3 AI models: Grok, DALL-E 3, Gemini</p>
                  <Button variant="outline" className="w-fit gap-2 group-hover:border-cyan-500/50">
                    Try It <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* NL Edit + Headshots row */}
          <div className="grid md:grid-cols-2 gap-8">
            <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}>
              <Link href="/tools/nl-edit">
                <div className="group relative rounded-2xl overflow-hidden h-72 hover:scale-[1.01] transition-all duration-300">
                  <img src="/showcase/tool-nl-edit.jpg" alt="NL Edit" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                  <div className="absolute top-4 right-4"><span className="px-2 py-0.5 rounded-full bg-green-500/90 text-white text-[10px] font-bold uppercase">New</span></div>
                  <div className="relative h-full flex flex-col justify-center p-8 max-w-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-400">AI Edit</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Natural Language Editor</h3>
                    <p className="text-white/70 text-sm">Just describe what to change — "remove the car", "add snow"</p>
                  </div>
                </div>
              </Link>
            </motion.div>

            <motion.div variants={scaleIn} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}>
              <Link href="/tools/headshot">
                <div className="group relative rounded-2xl overflow-hidden h-72 hover:scale-[1.01] transition-all duration-300">
                  <img src="/showcase/tool-headshot.jpg" alt="Headshots" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
                  <div className="absolute top-4 right-4"><span className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold uppercase">New</span></div>
                  <div className="relative h-full flex flex-col justify-center p-8 max-w-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Portrait</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">AI Headshot Generator</h3>
                    <p className="text-white/70 text-sm">Professional headshots from any photo — corporate, creative, LinkedIn</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>

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
                  <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">AI Video Studio</h3>
                  <p className="text-white/70 mb-6">Storyboards, scripts, scene direction, style transfer — full video pipeline</p>
                  <Button variant="outline" className="w-fit gap-2 border-white/20 text-white hover:bg-white/10">
                    Try It <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Link>
          </motion.div>
        </section>

        {/* Video Generation */}
        <section className="container max-w-6xl pb-16">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2 block">Video Generation</span>
            <h2 className="text-3xl md:text-4xl font-bold">AI Video</h2>
            <p className="text-foreground/50 mt-2">Generate and animate video clips with Google Veo 2</p>
          </motion.div>
          <ToolGrid tools={videoTools} />
        </section>

        {/* Image Editing Tools */}
        <section className="container max-w-6xl pb-16">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2 block">Image Editing</span>
            <h2 className="text-3xl md:text-4xl font-bold">Edit & Enhance</h2>
            <p className="text-foreground/50 mt-2">Professional image editing powered by multi-model AI</p>
          </motion.div>
          <ToolGrid tools={imageTools} />
        </section>

        {/* Creative Generation Tools */}
        <section className="container max-w-6xl pb-16">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2 block">Creative Generation</span>
            <h2 className="text-3xl md:text-4xl font-bold">Create & Generate</h2>
            <p className="text-foreground/50 mt-2">Generate logos, avatars, wallpapers, product shots and more</p>
          </motion.div>
          <ToolGrid tools={creativeTools} delay={0.1} />
        </section>

        {/* Utility Tools */}
        <section className="container max-w-6xl pb-16">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2 block">AI Utilities</span>
            <h2 className="text-3xl md:text-4xl font-bold">Analyze & Optimize</h2>
            <p className="text-foreground/50 mt-2">Smart tools for prompts, captions, colors and analysis</p>
          </motion.div>
          <ToolGrid tools={utilityTools} delay={0.2} />
        </section>

        {/* Workflow Tools */}
        <section className="container max-w-6xl pb-16">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-2 block">Workflow</span>
            <h2 className="text-3xl md:text-4xl font-bold">Batch & Automation</h2>
            <p className="text-foreground/50 mt-2">Scale your creative output with bulk processing</p>
          </motion.div>
          <ToolGrid tools={workflowTools} delay={0.25} />
        </section>

        {/* Audio Tools */}
        <section className="container max-w-6xl pb-16">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2 block">Audio Production</span>
            <h2 className="text-3xl md:text-4xl font-bold">Sound & Voice</h2>
            <p className="text-foreground/50 mt-2">AI-powered voiceovers, sound design, and audio enhancement</p>
          </motion.div>
          <ToolGrid tools={audioTools} delay={0.3} />
        </section>

        {/* Bottom CTA */}
        <section className="container max-w-3xl pb-20">
          <motion.div
            variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="text-center rounded-2xl bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 border border-cyan-500/20 p-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to Transform Your Workflow?</h2>
            <p className="text-foreground/60 mb-8">All {allToolCount}+ tools, unlimited creativity, one platform.</p>
            {cta("/workspace", "Get Started Free")}
          </motion.div>
        </section>
      </div>
    </PageLayout>
  );
}
