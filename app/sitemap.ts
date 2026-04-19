import type { MetadataRoute } from "next";

const BASE_URL = "https://dreamforgex.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Core pages
  const coreRoutes = [
    { url: "", priority: 1.0, changeFrequency: "weekly" as const },
    { url: "/tools", priority: 0.9, changeFrequency: "weekly" as const },
    { url: "/gallery", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/marketplace", priority: 0.8, changeFrequency: "daily" as const },
    { url: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
    { url: "/workspace", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/video-studio", priority: 0.7, changeFrequency: "weekly" as const },
    { url: "/api-docs", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/batch", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/demo/text-to-image", priority: 0.9, changeFrequency: "monthly" as const },
  ];

  // Tool pages
  const toolRoutes = [
    "upscaler", "background", "inpainting", "outpainting", "face-enhancer",
    "color-grading", "style-transfer", "object-eraser", "image-blender",
    "variations", "nl-edit", "photo-restore", "hdr-enhance", "transparent-png",
    "panorama", "film-grain", "depth-map", "headshot", "logo-maker", "avatar",
    "wallpaper", "qr-art", "product-photo", "text-effects", "sketch-to-image",
    "vectorize", "texture", "icon-gen", "canvas", "mockup", "thumbnail",
    "character-sheet", "meme", "interior-design", "collage", "text-to-video",
    "image-to-video", "batch-prompts", "social-resize", "prompt-builder",
    "color-palette", "image-to-prompt", "image-caption", "music-gen",
    "text-to-speech", "audio-enhance", "sound-effects",
    "song-creator", "music-video", "social-templates", "clip-maker",
    "presentations", "templates", "ad-copy", "blog-writer", "caption-writer",
    "pixel-art", "coloring-book", "tattoo-design", "cover-maker",
    "pose-turnaround", "photo-colorize", "podcast-cover", "listing-photos",
    "real-estate-twilight", "fashion-lookbook", "meme-template",
    "yt-thumbnails", "ig-carousel", "sticker-pack", "recipe-card",
    "invitation", "business-card", "pet-portrait", "tarot-card",
    "movie-poster", "trading-card", "menu-design", "greeting-card",
    "emoji-creator", "brand-style-guide", "event-flyer", "certificate",
    "bookmark", "zine-spread", "concert-poster", "architecture-concept",
    "cosplay-reference", "travel-postcard",
  ].map((tool) => ({
    url: `/tools/${tool}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  // Use-case landing pages (high buyer-intent SEO)
  const useCaseRoutes = [
    "etsy-sellers", "podcasters", "real-estate-agents", "cosplayers",
    "indie-devs", "authors", "restaurants", "tattoo-artists",
  ].map((s) => ({
    url: `/for/${s}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  }));

  // Video Studio sub-pages
  const videoRoutes = [
    "storyboard", "scene-director", "script", "style-transfer",
    "upscaler", "soundtrack",
  ].map((page) => ({
    url: `/video-studio/${page}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  return [
    ...coreRoutes,
    { url: "/whats-new", priority: 0.7, changeFrequency: "weekly" as const },
    ...toolRoutes,
    ...useCaseRoutes,
    ...videoRoutes,
  ].map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
