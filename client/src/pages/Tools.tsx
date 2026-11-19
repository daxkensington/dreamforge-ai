import PageLayout from "@/components/PageLayout";
import {
  Maximize, Palette, Scissors, Wand2, ArrowRight, ArrowDown, Search, X, Sparkles,
  PenTool, Smile, Expand, Eraser, Type, Blend, PenLine,
  SunMedium, Pipette, Image, Video, ImagePlus, User, Hexagon,
  Monitor, QrCode, MessageSquare, CircleUser, ShoppingBag,
  FileText, Mic, AudioLines, Waves, Copy, Layers,
  Film, Grid3X3, ScanLine, Sun, AppWindow, Paintbrush,
  Music, Frame, Share2, Users, Laugh, Home, LayoutGrid, Smartphone,
  Shirt, Box, Gamepad2, Pencil, Flame, BookOpen, RotateCw,
  Youtube, Instagram, Sticker, ChefHat, Mail, CreditCard, Cat,
  Moon, Clapperboard, Gem, UtensilsCrossed, Heart, Award,
  Bookmark as BookmarkIcon, Newspaper, Building2, Plane, Megaphone,
  Package, Blocks, Dog,
} from "lucide-react";
// lucide Sparkles/Cat/Gem already imported above — reused for Barbie/Jellycat/POP Mart.
import { Link } from "wouter";
import { useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import type { LucideIcon } from "lucide-react";
import NextImage from "next/image";
import styles from "./Tools.module.css";
interface GridTool {
  title: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  img: string;
  badge?: string;
}

interface FeaturedTool {
  title: string;
  desc: string;
  img: string;
  href: string;
  signedInHref?: string;
}

// ─── Viral Trend Tools (Phase 39 Tier 2 — TikTok/IG-driven) ─────────────────
const viralTools: GridTool[] = [
  { title: "AI Action Figure", desc: "Become a boxed collectible toy", icon: Package, href: "/tools/action-figure", img: "/showcase/tool-action-figure.jpg", badge: "Viral" },
  { title: "AI Funko Pop", desc: "Window-box vinyl figure of yourself", icon: Box, href: "/tools/funko-pop", img: "/showcase/tool-funko-pop.jpg", badge: "Viral" },
  { title: "AI Chibi Figure", desc: "Adorable anime collectible figure", icon: Heart, href: "/tools/chibi-figure", img: "/showcase/tool-chibi-figure.jpg", badge: "Viral" },
  { title: "AI LEGO Mini", desc: "Yourself as a classic LEGO minifig", icon: Blocks, href: "/tools/lego-mini", img: "/showcase/tool-lego-mini.jpg", badge: "Viral" },
  { title: "Pet-to-Person", desc: "See your pet as a human", icon: Dog, href: "/tools/pet-to-person", img: "/showcase/tool-pet-to-person.jpg", badge: "Viral" },
  { title: "AI Barbie Box", desc: "Collector-edition fashion doll", icon: Sparkles, href: "/tools/barbie-box", img: "/showcase/tool-barbie-box.jpg", badge: "Viral" },
  { title: "AI Jellycat Plush", desc: "Ultra-soft squishy plush toy", icon: Cat, href: "/tools/jellycat-plush", img: "/showcase/tool-jellycat-plush.jpg", badge: "Viral" },
  { title: "AI POP Mart", desc: "Designer art-toy blind box", icon: Gem, href: "/tools/pop-mart", img: "/showcase/tool-pop-mart.jpg", badge: "Viral" },
];

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
  { title: "AI Relighting", desc: "Change lighting & mood of any photo", icon: Sun, href: "/tools/relight", img: "/showcase/tool-relight.jpg", badge: "New" },
  { title: "Photo Colorizer", desc: "Era-aware B&W photo colorization", icon: Palette, href: "/tools/photo-colorize", img: "/showcase/tool-photo-colorize.jpg", badge: "New" },
  { title: "Real Estate Twilight", desc: "Daytime exteriors to twilight MLS shots", icon: Home, href: "/tools/real-estate-twilight", img: "/showcase/tool-real-estate-twilight.jpg", badge: "New" },
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
  { title: "Virtual Try-On", desc: "See how any garment looks on you", icon: Shirt, href: "/tools/virtual-tryon", img: "/showcase/tool-tryon.jpg", badge: "New" },
  { title: "3D Model Generator", desc: "Turn any image into a 3D model", icon: Box, href: "/tools/3d-generator", img: "/showcase/tool-3d.jpg", badge: "New" },
  { title: "Comic Strip", desc: "Multi-panel comics from a concept", icon: LayoutGrid, href: "/tools/comic-strip", img: "/showcase/tool-comic.jpg", badge: "New" },
  { title: "T-Shirt Designer", desc: "Print-ready t-shirt designs", icon: Shirt, href: "/tools/tshirt-designer", img: "/showcase/tool-tshirt.jpg", badge: "New" },
  { title: "Pixel Art", desc: "Game-ready 8/16/32-bit sprites", icon: Gamepad2, href: "/tools/pixel-art", img: "/showcase/tool-pixel-art.jpg", badge: "New" },
  { title: "Coloring Book Page", desc: "Printable line-art pages", icon: Pencil, href: "/tools/coloring-book", img: "/showcase/tool-coloring-book.jpg", badge: "New" },
  { title: "Tattoo Designer", desc: "Stencil + color tattoo designs", icon: Flame, href: "/tools/tattoo-design", img: "/showcase/tool-tattoo-design.jpg", badge: "New" },
  { title: "Cover Maker", desc: "Book, album, eBook, audiobook covers", icon: BookOpen, href: "/tools/cover-maker", img: "/showcase/tool-cover-maker.jpg", badge: "New" },
  { title: "Pose Turnaround", desc: "Multi-view character reference sheets", icon: RotateCw, href: "/tools/pose-turnaround", img: "/showcase/tool-pose-turnaround.jpg", badge: "New" },
  { title: "Podcast Cover", desc: "Spotify-ready podcast artwork", icon: Mic, href: "/tools/podcast-cover", img: "/showcase/tool-podcast-cover.jpg", badge: "New" },
  { title: "Listing Photo Pack", desc: "5 angles from one product shot", icon: ShoppingBag, href: "/tools/listing-photos", img: "/showcase/tool-listing-photos.jpg", badge: "New" },
  { title: "Fashion Lookbook", desc: "Editorial multi-scene lookbook", icon: Shirt, href: "/tools/fashion-lookbook", img: "/showcase/tool-fashion-lookbook.jpg", badge: "New" },
  { title: "Meme Template Filler", desc: "Classic meme formats with your captions", icon: Laugh, href: "/tools/meme-template", img: "/showcase/tool-meme-template.jpg", badge: "New" },
  { title: "YouTube Chapter Thumbnails", desc: "Batch per-chapter thumbnails", icon: Youtube, href: "/tools/yt-thumbnails", img: "/showcase/tool-yt-thumbnails.jpg", badge: "New" },
  { title: "Instagram Carousel", desc: "Branded multi-slide IG carousels", icon: Instagram, href: "/tools/ig-carousel", img: "/showcase/tool-ig-carousel.jpg", badge: "New" },
  { title: "Sticker Pack", desc: "Die-cut chat app sticker packs", icon: Sticker, href: "/tools/sticker-pack", img: "/showcase/tool-sticker-pack.jpg", badge: "New" },
  { title: "Recipe Card", desc: "Pinterest-ready recipe cards", icon: ChefHat, href: "/tools/recipe-card", img: "/showcase/tool-recipe-card.jpg", badge: "New" },
  { title: "Invitation Designer", desc: "Print-ready 5x7 invitations", icon: Mail, href: "/tools/invitation", img: "/showcase/tool-invitation.jpg", badge: "New" },
  { title: "Business Card", desc: "Matching front + back design", icon: CreditCard, href: "/tools/business-card", img: "/showcase/tool-business-card.jpg", badge: "New" },
  { title: "Pet Portrait", desc: "Royal, fantasy, artistic pet portraits", icon: Cat, href: "/tools/pet-portrait", img: "/showcase/tool-pet-portrait.jpg", badge: "New" },
  { title: "Tarot Card", desc: "Custom major arcana cards", icon: Moon, href: "/tools/tarot-card", img: "/showcase/tool-tarot-card.jpg", badge: "New" },
  { title: "Movie Poster", desc: "Theatrical-quality one-sheets", icon: Clapperboard, href: "/tools/movie-poster", img: "/showcase/tool-movie-poster.jpg", badge: "New" },
  { title: "Trading Card", desc: "TCG-quality custom cards", icon: Gem, href: "/tools/trading-card", img: "/showcase/tool-trading-card.jpg", badge: "New" },
  { title: "Menu Designer", desc: "Restaurant menus, any format", icon: UtensilsCrossed, href: "/tools/menu-design", img: "/showcase/tool-menu-design.jpg", badge: "New" },
  { title: "Greeting Card", desc: "Front + inside matching set", icon: Heart, href: "/tools/greeting-card", img: "/showcase/tool-greeting-card.jpg", badge: "New" },
  { title: "Emoji Creator", desc: "Discord, Slack, Twitch custom emojis", icon: Smile, href: "/tools/emoji-creator", img: "/showcase/tool-emoji-creator.jpg", badge: "New" },
  { title: "Brand Style Guide", desc: "Logo + palette + typography system", icon: Palette, href: "/tools/brand-style-guide", img: "/showcase/tool-brand-style-guide.jpg", badge: "New" },
  { title: "Event Flyer", desc: "Concerts, clubs, sales, conferences", icon: Megaphone, href: "/tools/event-flyer", img: "/showcase/tool-event-flyer.jpg", badge: "New" },
  { title: "Certificate Designer", desc: "Awards, diplomas, completions", icon: Award, href: "/tools/certificate", img: "/showcase/tool-certificate.jpg", badge: "New" },
  { title: "Bookmark Designer", desc: "Printable literary bookmarks", icon: BookmarkIcon, href: "/tools/bookmark", img: "/showcase/tool-bookmark.jpg", badge: "New" },
  { title: "Zine Spread", desc: "Multi-page editorial zines", icon: Newspaper, href: "/tools/zine-spread", img: "/showcase/tool-zine-spread.jpg", badge: "New" },
  { title: "Concert Poster", desc: "Silkscreen-quality gig posters", icon: Music, href: "/tools/concert-poster", img: "/showcase/tool-concert-poster.jpg", badge: "New" },
  { title: "Architecture Concept", desc: "Photorealistic building renders", icon: Building2, href: "/tools/architecture-concept", img: "/showcase/tool-architecture-concept.jpg", badge: "New" },
  { title: "Cosplay Reference", desc: "Multi-view costume breakdowns", icon: Wand2, href: "/tools/cosplay-reference", img: "/showcase/tool-cosplay-reference.jpg", badge: "New" },
  { title: "Travel Postcard", desc: "Vintage travel postcards, any era", icon: Plane, href: "/tools/travel-postcard", img: "/showcase/tool-travel-postcard.jpg", badge: "New" },
];

// ─── Video Generation Tools ──────────────────────────────────────────────────
const videoTools: GridTool[] = [
  { title: "Text-to-Video", desc: "Generate video from text prompts", icon: Video, href: "/tools/text-to-video", img: "/showcase/tool-t2v.jpg" },
  { title: "Image-to-Video", desc: "Animate still images", icon: Film, href: "/tools/image-to-video", img: "/showcase/tool-i2v.jpg" },
  { title: "Music Video Studio", desc: "Animate an image and loop it over your song", icon: Film, href: "/tools/music-video", img: "/showcase/tool-music-video.jpg", badge: "New" },
  { title: "Social Templates", desc: "TikTok, Reels & Shorts templates", icon: Smartphone, href: "/tools/social-templates", img: "/showcase/tool-social-templates.jpg", badge: "New" },
  { title: "Clip Maker", desc: "Trim and download short clips in your browser", icon: Scissors, href: "/tools/clip-maker", img: "/showcase/tool-clip-maker.jpg", badge: "New" },
];

// ─── Workflow Tools ──────────────────────────────────────────────────────────
const workflowTools: GridTool[] = [
  { title: "Image Templates", desc: "25+ templates: posts, ads, cards, flyers", icon: LayoutGrid, href: "/tools/templates", img: "/showcase/tool-image-templates.jpg", badge: "Hot" },
  { title: "AI Presentations", desc: "Full slide decks from a description", icon: Layers, href: "/tools/presentations", img: "/showcase/tool-presentations.jpg", badge: "Hot" },
  { title: "AI Resume Builder", desc: "Professional ATS-optimized resumes", icon: FileText, href: "/tools/resume-builder", img: "/showcase/tool-blog.jpg", badge: "Hot" },
  { title: "Logo Animator", desc: "Animated video intros from your logo", icon: Film, href: "/tools/logo-animator", img: "/showcase/tool-music-video.jpg", badge: "Hot" },
  { title: "AI Design Canvas", desc: "Drag-drop editor with AI elements", icon: LayoutGrid, href: "/tools/design-canvas", img: "/showcase/tool-canvas.jpg", badge: "New" },
  { title: "Train Custom Model", desc: "LoRA fine-tuning on your images", icon: Layers, href: "/tools/train-model", img: "/showcase/tool-style-transfer.jpg", badge: "New" },
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

// ─── Uncensored 18+ Studio Tools ─────────────────────────────────────────────
const uncensoredTools: GridTool[] = [
  { title: "Uncensored Text-to-Image", desc: "Zero-filter Flux Dev, Pony XL & SDXL renders", icon: Flame, href: "/uncensored?start=1&tab=create", img: "/showcase/uncensored-char-aria-nordic.jpg", badge: "18+ Pro" },
  { title: "Character Face Lock", desc: "Keep the exact same face across unlimited scenes", icon: Users, href: "/uncensored?start=1&tab=create", img: "/showcase/uncensored-char-valentina-glam.jpg", badge: "18+ Pro" },
  { title: "Virtual Outfit Swap", desc: "Change clothing, style, or material on any subject", icon: Shirt, href: "/uncensored?start=1&tab=outfit", img: "/showcase/uncensored-char-sora-cyber.jpg", badge: "18+ Pro" },
  { title: "Brush Inpainting", desc: "Paint over any region to edit or replace details", icon: Paintbrush, href: "/uncensored?start=1&tab=inpaint", img: "/showcase/uncensored-char-chloe-california.jpg", badge: "18+ Pro" },
  { title: "4-View Character Sheet", desc: "Front, side, back & close-up turnaround sheet", icon: RotateCw, href: "/uncensored?start=1&tab=sheet", img: "/showcase/uncensored-char-nyx-fantasy.jpg", badge: "18+ Pro" },
  { title: "Uncensored Video Motion", desc: "Animate any portrait into 5-second Wan 2.2 video", icon: Video, href: "/uncensored?start=1&tab=video", img: "/showcase/uncensored-char-mei-noir.jpg", badge: "18+ Pro" },
];

const toolGroups = [
  { id: "creative", name: "Create images", tools: creativeTools },
  { id: "editing", name: "Edit images", tools: imageTools },
  { id: "video", name: "Video", tools: videoTools },
  { id: "audio", name: "Music & audio", tools: audioTools },
  { id: "workflow", name: "Design & workflow", tools: workflowTools },
  { id: "utilities", name: "Utilities", tools: utilityTools },
  { id: "effects", name: "Viral effects", tools: viralTools },
  { id: "18-plus", name: "Uncensored 18+", tools: uncensoredTools },
] as const;

const featuredTools: FeaturedTool[] = [
  {
    title: "Text-to-Image",
    desc: "Turn a prompt into an image.",
    img: "/showcase/forge-image.webp",
    href: "/demo/text-to-image",
    signedInHref: "/workspace",
  },
  {
    title: "Video Studio",
    desc: "Take an idea from storyboard to motion.",
    img: "/showcase/forge-preview.webp",
    href: "/video-studio",
  },
  {
    title: "Song Creator",
    desc: "Compose full songs with vocals.",
    img: "/showcase/forge-audio.webp",
    href: "/tools/song-creator",
  },
  {
    title: "Design Canvas",
    desc: "Build and edit a design in layers.",
    img: "/showcase/tool-canvas.jpg",
    href: "/tools/design-canvas",
  },
];

type ToolGroup = (typeof toolGroups)[number];
type Category = "all" | ToolGroup["id"];

function toolMatches(tool: GridTool, categoryName: string, terms: string[]) {
  const words = [
    tool.title,
    tool.desc,
    categoryName,
    tool.href.replace(/[-/]/g, " "),
  ]
    .join(" ")
    .toLowerCase();
  return terms.every((term) => words.includes(term));
}

function ToolGrid({ tools }: { tools: GridTool[] }) {
  return (
    <div className={styles.grid}>
      {tools.map((tool) => (
        <Link href={tool.href} className={styles.card} key={tool.title}>
          <img
            src={tool.img}
            alt=""
            loading="lazy"
            decoding="async"
            className={styles.cardImage}
          />
          <div className={styles.cardBody}>
            <div className={styles.cardTitle}>
              <tool.icon size={18} aria-hidden="true" />
              <h4>{tool.title}</h4>
              <ArrowRight size={16} aria-hidden="true" />
            </div>
            <p>{tool.desc}</p>
            {tool.badge?.includes("18+") && (
              <span className={styles.badge}>{tool.badge}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Tools() {
  const { isAuthenticated } = useAuth();
  const imageHref = isAuthenticated ? "/workspace" : "/demo/text-to-image";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const searchInput = useRef<HTMLInputElement>(null);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const groups = toolGroups
    .filter((group) => category === "all" || group.id === category)
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) => toolMatches(tool, group.name, terms)),
    }))
    .filter((group) => group.tools.length > 0);
  const resultCount = groups.reduce((count, group) => count + group.tools.length, 0);

  function clearSearch() {
    setQuery("");
    searchInput.current?.focus();
  }

  function resetFilters() {
    setCategory("all");
    clearSearch();
  }

  return (
    <PageLayout>
      <div className={styles.page}>
        <section aria-labelledby="tools-title" className={styles.hero}>
          <div className={styles.heroArt} aria-hidden="true">
            <NextImage
              src="/showcase/forge-ring.webp"
              alt=""
              fill
              sizes="(max-width: 688px) 100vw, 75vw"
              priority
            />
          </div>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>DreamForgeX Creative Studio</p>
              <h1 id="tools-title">
                AI tools for <em>whatever you make.</em>
              </h1>
              <p>
                Generate images, edit photos, make videos, compose music, and
                design on a canvas.
              </p>
              <div className={styles.heroActions}>
                <a href="#tool-directory" className={styles.primary}>
                  Find a tool <ArrowDown size={17} aria-hidden="true" />
                </a>
                <Link className={styles.secondary} href={imageHref}>
                  {isAuthenticated ? "Open Workspace" : "Try Image Generation"}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="featured-tools" className={styles.featured}>
          <div className={styles.container}>
            <h2 id="featured-tools">Featured tools</h2>
            <div className={styles.featuredGrid}>
              {featuredTools.map((tool) => (
                <Link
                  key={tool.title}
                  href={(isAuthenticated && tool.signedInHref) || tool.href}
                  className={styles.featuredCard}
                >
                  <img
                    src={tool.img}
                    alt=""
                    decoding="async"
                    className={styles.featuredImage}
                  />
                  <div className={styles.featuredCopy}>
                    <span className={styles.featuredTitle}>
                      {tool.title}
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                    <p>{tool.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section
          id="tool-directory"
          aria-labelledby="tool-directory-title"
          className={styles.directory}
        >
          <div className={styles.container}>
            <h2 id="tool-directory-title">Explore all tools</h2>
            <div className={styles.filterPanel}>
              <label className={styles.searchBox}>
                <Search size={20} aria-hidden="true" />
                <span className="sr-only">Search tools</span>
                <input
                  ref={searchInput}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search tools"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              {query && (
                <button
                  type="button"
                  className={styles.clearSearch}
                  aria-label="Clear search"
                  onClick={clearSearch}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className={styles.chips} role="group" aria-label="Tool categories">
              <button
                type="button"
                className={styles.chip}
                aria-pressed={category === "all"}
                onClick={() => setCategory("all")}
              >
                All tools
              </button>
              {toolGroups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  className={styles.chip}
                  aria-pressed={category === group.id}
                  onClick={() => setCategory(group.id)}
                >
                  {group.name}
                </button>
              ))}
            </div>
            <p className={styles.resultCount} role="status">
              {resultCount === 1 ? "1 tool" : `${resultCount} tools`}
            </p>
            {groups.length === 0 && (
              <div className={styles.empty}>
                <p>No tools match your search and category.</p>
                <button type="button" className={styles.secondary} onClick={resetFilters}>
                  Reset filters
                </button>
              </div>
            )}
            {groups.map((group) => (
              <section
                key={group.id}
                aria-labelledby={`tools-${group.id}`}
                className={styles.group}
              >
                <div className={styles.groupHeading}>
                  <h3 id={`tools-${group.id}`}>{group.name}</h3>
                  {group.id === "18-plus" && (
                    <Link className={styles.ageLink} href="/uncensored?start=1">
                      Open 18+ Studio <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <ToolGrid tools={group.tools} />
              </section>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
