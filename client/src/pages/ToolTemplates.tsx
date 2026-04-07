// @ts-nocheck
import { useState, useMemo } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  LayoutGrid,
  Search,
  ArrowRight,
  Sparkles,
  Image,
  Video,
  Palette,
  Camera,
  Music,
  PenTool,
  Megaphone,
  Instagram,
  Youtube,
  Layers,
  Zap,
  Crown,
  Star,
  Clock,
  Wand2,
  Package,
  Film,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  preview: string;
  tools: string[];
  credits: number;
  featured?: boolean;
  pieces: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  link: string;
}

type TemplateCategory =
  | "social-media"
  | "marketing"
  | "art"
  | "design"
  | "photography"
  | "video";

/* ------------------------------------------------------------------ */
/*  Categories                                                         */
/* ------------------------------------------------------------------ */

const CATEGORIES: { id: TemplateCategory | "all"; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All Templates", icon: LayoutGrid },
  { id: "social-media", label: "Social Media", icon: Instagram },
  { id: "marketing", label: "Marketing", icon: Megaphone },
  { id: "art", label: "Art", icon: Palette },
  { id: "design", label: "Design", icon: PenTool },
  { id: "photography", label: "Photography", icon: Camera },
  { id: "video", label: "Video", icon: Film },
];

/* ------------------------------------------------------------------ */
/*  Template Data                                                      */
/* ------------------------------------------------------------------ */

const TEMPLATES: ProjectTemplate[] = [
  // --- Social Media ---
  {
    id: "youtube-thumbnail-pack",
    title: "YouTube Thumbnail Pack",
    description:
      "10 scroll-stopping thumbnail designs with bold text, vibrant backgrounds, and face-reaction frames. Optimized for maximum CTR.",
    category: "social-media",
    preview: "/showcase/tool-thumbnail.jpg",
    tools: ["Text to Image", "Text Effects", "Upscaler"],
    credits: 30,
    featured: true,
    pieces: 10,
    difficulty: "Beginner",
    link: "/tools/thumbnail",
  },
  {
    id: "social-media-kit",
    title: "Social Media Kit",
    description:
      "Complete branded post set for Instagram, Facebook, Twitter/X, and LinkedIn. Consistent look across every platform.",
    category: "social-media",
    preview: "/showcase/tool-social-templates.jpg",
    tools: ["Image Templates", "Social Resize", "Text Effects"],
    credits: 25,
    featured: true,
    pieces: 12,
    difficulty: "Beginner",
    link: "/tools/social-templates",
  },
  {
    id: "meme-template-pack",
    title: "Meme Template Pack",
    description:
      "8 viral-ready meme formats with customizable text zones, reaction images, and trending layouts. Perfect for social engagement.",
    category: "social-media",
    preview: "/showcase/tool-meme.jpg",
    tools: ["Meme Generator", "Text Effects", "Image Blender"],
    credits: 15,
    pieces: 8,
    difficulty: "Beginner",
    link: "/tools/meme",
  },
  {
    id: "instagram-stories-bundle",
    title: "Instagram Stories Bundle",
    description:
      "20 story templates with polls, countdowns, Q&A layouts, and swipe-up frames. Branded gradients and animated-ready designs.",
    category: "social-media",
    preview: "/showcase/tool-social.jpg",
    tools: ["Image Templates", "Social Resize", "Color Palette"],
    credits: 35,
    pieces: 20,
    difficulty: "Intermediate",
    link: "/tools/templates",
  },

  // --- Marketing ---
  {
    id: "product-photography-set",
    title: "Product Photography Set",
    description:
      "Studio-quality product shots with clean backgrounds, lifestyle scenes, and flat-lay compositions. E-commerce ready.",
    category: "marketing",
    preview: "/showcase/tool-product.jpg",
    tools: ["Product Photo", "Background Remover", "Upscaler"],
    credits: 40,
    featured: true,
    pieces: 8,
    difficulty: "Intermediate",
    link: "/tools/product-photo",
  },
  {
    id: "ad-creative-suite",
    title: "Ad Creative Suite",
    description:
      "High-converting ad creatives for Facebook, Google Display, and Instagram. A/B test variations included with copy suggestions.",
    category: "marketing",
    preview: "/showcase/tool-adcopy.jpg",
    tools: ["Ad Copy Generator", "Image Templates", "Social Resize"],
    credits: 35,
    pieces: 15,
    difficulty: "Intermediate",
    link: "/tools/ad-copy",
  },
  {
    id: "email-campaign-visuals",
    title: "Email Campaign Visuals",
    description:
      "Newsletter headers, promotional banners, and CTA graphics. Perfectly sized for every major email platform.",
    category: "marketing",
    preview: "/showcase/tool-image-templates.jpg",
    tools: ["Image Templates", "Text Effects", "Color Palette"],
    credits: 20,
    pieces: 10,
    difficulty: "Beginner",
    link: "/tools/templates",
  },
  {
    id: "presentation-deck",
    title: "Presentation Deck",
    description:
      "Professional slide backgrounds, data viz templates, and section dividers. Make every pitch look world-class.",
    category: "marketing",
    preview: "/showcase/tool-presentations.jpg",
    tools: ["Presentations", "Text Effects", "Color Palette"],
    credits: 25,
    pieces: 12,
    difficulty: "Intermediate",
    link: "/tools/presentations",
  },

  // --- Art ---
  {
    id: "character-design-sheet",
    title: "Character Design Sheet",
    description:
      "Full character turnaround with front, side, and back views. Expression sheet, outfit variants, and prop designs included.",
    category: "art",
    preview: "/showcase/tool-charsheet.jpg",
    tools: ["Character Sheet", "Variations", "Style Transfer"],
    credits: 50,
    featured: true,
    pieces: 6,
    difficulty: "Advanced",
    link: "/tools/character-sheet",
  },
  {
    id: "album-cover-art",
    title: "Album Cover Art",
    description:
      "Stunning album artwork in multiple styles -- from minimalist to psychedelic. Includes square and banner variants for streaming platforms.",
    category: "art",
    preview: "/showcase/gallery-5.jpg",
    tools: ["Text to Image", "Style Transfer", "Text Effects"],
    credits: 30,
    pieces: 5,
    difficulty: "Intermediate",
    link: "/tools/style-transfer",
  },
  {
    id: "concept-art-series",
    title: "Concept Art Series",
    description:
      "Environment concepts, prop sheets, and mood paintings. Perfect for game dev, film pre-production, or world-building.",
    category: "art",
    preview: "/showcase/gallery-3.jpg",
    tools: ["Text to Image", "Sketch to Image", "Outpainting"],
    credits: 45,
    pieces: 8,
    difficulty: "Advanced",
    link: "/tools/sketch-to-image",
  },
  {
    id: "digital-collage-pack",
    title: "Digital Collage Pack",
    description:
      "Mixed-media collage templates blending photography, illustration, and texture. Layered compositions with a modern editorial feel.",
    category: "art",
    preview: "/showcase/tool-collage.jpg",
    tools: ["Collage", "Image Blender", "Color Grading"],
    credits: 25,
    pieces: 6,
    difficulty: "Intermediate",
    link: "/tools/collage",
  },

  // --- Design ---
  {
    id: "logo-brand-kit",
    title: "Logo & Brand Kit",
    description:
      "Logo mark, wordmark, color palette, typography pairings, and brand asset mockups. Everything to launch a brand identity.",
    category: "design",
    preview: "/showcase/tool-logo.jpg",
    tools: ["Logo Maker", "Color Palette", "Mockup Generator"],
    credits: 55,
    featured: true,
    pieces: 10,
    difficulty: "Advanced",
    link: "/tools/logo-maker",
  },
  {
    id: "icon-set",
    title: "Custom Icon Set",
    description:
      "24 matching icons in your chosen style -- flat, line, glyph, or 3D. Exported as transparent PNGs ready for web or app.",
    category: "design",
    preview: "/showcase/tool-icon.jpg",
    tools: ["Icon Generator", "Transparent PNG", "Batch Studio"],
    credits: 40,
    pieces: 24,
    difficulty: "Intermediate",
    link: "/tools/icon-gen",
  },
  {
    id: "wallpaper-collection",
    title: "Wallpaper Collection",
    description:
      "Desktop and mobile wallpapers in 4K. Abstract, nature, geometric, and dark-mode themes. Fresh art for every screen.",
    category: "design",
    preview: "/showcase/tool-wallpaper.jpg",
    tools: ["Wallpaper Generator", "Upscaler", "HDR Enhance"],
    credits: 20,
    pieces: 8,
    difficulty: "Beginner",
    link: "/tools/wallpaper",
  },
  {
    id: "texture-material-pack",
    title: "Texture & Material Pack",
    description:
      "Seamless tileable textures for 3D, game assets, and design backgrounds. Wood, metal, fabric, stone, and abstract materials.",
    category: "design",
    preview: "/showcase/tool-texture.jpg",
    tools: ["Texture Generator", "Upscaler", "Panorama"],
    credits: 30,
    pieces: 12,
    difficulty: "Intermediate",
    link: "/tools/texture",
  },

  // --- Photography ---
  {
    id: "headshot-portfolio",
    title: "Professional Headshot Portfolio",
    description:
      "AI-enhanced professional headshots with studio lighting, background options, and subtle retouching. LinkedIn-ready in minutes.",
    category: "photography",
    preview: "/showcase/tool-headshot.jpg",
    tools: ["AI Headshot", "Face Enhancer", "Background Remover"],
    credits: 35,
    pieces: 6,
    difficulty: "Beginner",
    link: "/tools/headshot",
  },
  {
    id: "photo-restoration-batch",
    title: "Photo Restoration Batch",
    description:
      "Breathe life into old or damaged photos. Colorization, scratch removal, face enhancement, and upscaling in one workflow.",
    category: "photography",
    preview: "/showcase/tool-restore.jpg",
    tools: ["Photo Restore", "Face Enhancer", "Upscaler", "Color Grading"],
    credits: 40,
    pieces: 5,
    difficulty: "Intermediate",
    link: "/tools/photo-restore",
  },
  {
    id: "real-estate-photos",
    title: "Real Estate Photo Suite",
    description:
      "Interior staging, HDR enhancement, sky replacement, and virtual twilight edits. Make every listing shine.",
    category: "photography",
    preview: "/showcase/tool-interior.jpg",
    tools: ["Interior Design", "HDR Enhance", "Outpainting"],
    credits: 45,
    pieces: 10,
    difficulty: "Intermediate",
    link: "/tools/interior-design",
  },
  {
    id: "qr-art-collection",
    title: "QR Art Collection",
    description:
      "Beautiful scannable QR codes with artistic overlays. Works for menus, business cards, events, and social links.",
    category: "photography",
    preview: "/showcase/tool-qr.jpg",
    tools: ["QR Art", "Style Transfer"],
    credits: 15,
    pieces: 6,
    difficulty: "Beginner",
    link: "/tools/qr-art",
  },

  // --- Video ---
  {
    id: "music-video-kit",
    title: "Music Video Kit",
    description:
      "AI-generated video clips, visual effects overlays, and lyric motion graphics. Assemble a full music video from prompts.",
    category: "video",
    preview: "/showcase/tool-music-video.jpg",
    tools: ["Text to Video", "Image to Video", "Music Gen"],
    credits: 80,
    featured: true,
    pieces: 8,
    difficulty: "Advanced",
    link: "/tools/music-video",
  },
  {
    id: "short-form-clips",
    title: "Short-Form Clip Pack",
    description:
      "TikTok, Reels, and Shorts-ready vertical video clips with captions, transitions, and trending visual styles.",
    category: "video",
    preview: "/showcase/tool-clip-maker.jpg",
    tools: ["Clip Maker", "Caption Writer", "Text to Video"],
    credits: 50,
    pieces: 6,
    difficulty: "Intermediate",
    link: "/tools/clip-maker",
  },
  {
    id: "avatar-animation-set",
    title: "Avatar Animation Set",
    description:
      "Custom AI avatars with lip-sync, gestures, and background scenes. Perfect for explainers, intros, and social content.",
    category: "video",
    preview: "/showcase/tool-avatar.jpg",
    tools: ["AI Avatar", "Text to Speech", "Image to Video"],
    credits: 60,
    pieces: 4,
    difficulty: "Intermediate",
    link: "/tools/avatar",
  },
  {
    id: "product-demo-video",
    title: "Product Demo Video",
    description:
      "Animated product showcases with 360 rotations, feature callouts, and cinematic transitions. Turn any product into a video ad.",
    category: "video",
    preview: "/showcase/tool-i2v.jpg",
    tools: ["Image to Video", "Text to Video", "Audio Enhance"],
    credits: 55,
    pieces: 5,
    difficulty: "Advanced",
    link: "/tools/image-to-video",
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const difficultyColor: Record<string, string> = {
  Beginner: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  Advanced: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const categoryGradient: Record<TemplateCategory, string> = {
  "social-media": "from-pink-500 to-purple-600",
  marketing: "from-orange-500 to-red-600",
  art: "from-violet-500 to-indigo-600",
  design: "from-cyan-500 to-blue-600",
  photography: "from-emerald-500 to-teal-600",
  video: "from-red-500 to-rose-600",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ToolTemplates() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let list = TEMPLATES;
    if (activeCategory !== "all") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tools.some((tool) => tool.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  const featuredTemplates = TEMPLATES.filter((t) => t.featured);

  return (
    <PageLayout>
      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/10" />
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-purple-500/8 rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-cyan-500/6 rounded-full blur-[120px]" />

        <div className="container relative py-12 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-4">
              <Package className="h-3.5 w-3.5" />
              Project Template Gallery
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
              Creative{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                Project Templates
              </span>
            </h1>
            <p className="text-muted-foreground max-w-lg text-base md:text-lg">
              {TEMPLATES.length} ready-to-use project templates. Pick a template, customize it, and
              launch studio-quality creative work in minutes -- not hours.
            </p>

            {/* Search */}
            <div className="relative mt-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates, tools, styles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 focus:border-cyan-500/40 h-11"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---- Featured Row ---- */}
      {!searchQuery && activeCategory === "all" && (
        <section className="container py-10">
          <div className="flex items-center gap-2 mb-5">
            <Crown className="h-4 w-4 text-amber-400" />
            <h2 className="text-lg font-semibold">Featured Templates</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredTemplates.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07, duration: 0.45 }}
              >
                <TemplateCard template={t} featured />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Category Filter + Grid ---- */}
      <section className="container pb-16">
        {/* Divider when featured shows */}
        {!searchQuery && activeCategory === "all" && (
          <div className="border-t border-white/5 pt-10 mb-6">
            <h2 className="text-lg font-semibold mb-5">Browse All Templates</h2>
          </div>
        )}

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.08)]"
                    : "bg-white/5 text-muted-foreground border border-white/10 hover:border-white/20 hover:bg-white/8"
                }`}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mb-5">
          {filtered.length} template{filtered.length !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>

        {/* Template grid */}
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03, duration: 0.35 }}
                >
                  <TemplateCard template={t} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Search className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground">No templates found. Try a different search or category.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </PageLayout>
  );
}

/* ------------------------------------------------------------------ */
/*  Template Card                                                      */
/* ------------------------------------------------------------------ */

function TemplateCard({
  template: t,
  featured = false,
}: {
  template: ProjectTemplate;
  featured?: boolean;
}) {
  return (
    <Link href={t.link}>
      <Card
        className={`group relative bg-white/[0.03] border-white/10 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden cursor-pointer ${
          featured ? "ring-1 ring-amber-500/10" : ""
        }`}
      >
        {/* Preview image */}
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            loading="lazy"
            src={t.preview}
            alt={t.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Featured badge */}
          {t.featured && (
            <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
              <Star className="h-2.5 w-2.5 fill-current" />
              Featured
            </div>
          )}

          {/* Category pill */}
          <div className="absolute top-2.5 right-2.5">
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r ${
                categoryGradient[t.category]
              } text-white/90 shadow-lg`}
            >
              {CATEGORIES.find((c) => c.id === t.category)?.label}
            </span>
          </div>

          {/* Bottom overlay stats */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-white/70">
              <Layers className="h-3 w-3" />
              {t.pieces} pieces
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/70">
              <Zap className="h-3 w-3 text-amber-400" />
              ~{t.credits} credits
            </div>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm leading-tight mb-1 group-hover:text-cyan-400 transition-colors">
              {t.title}
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
              {t.description}
            </p>
          </div>

          {/* Tools used */}
          <div className="flex flex-wrap gap-1">
            {t.tools.map((tool) => (
              <Badge
                key={tool}
                className="bg-white/5 text-white/50 border-white/10 text-[9px] px-1.5 py-0 font-normal"
              >
                {tool}
              </Badge>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <Badge
              className={`text-[10px] border ${difficultyColor[t.difficulty]} font-medium`}
            >
              {t.difficulty}
            </Badge>
            <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-medium group-hover:gap-2 transition-all">
              Use Template <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
