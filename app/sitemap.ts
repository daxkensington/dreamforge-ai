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
  ].map((tool) => ({
    url: `/tools/${tool}`,
    priority: 0.6,
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

  return [...coreRoutes, ...toolRoutes, ...videoRoutes].map((route) => ({
    url: `${BASE_URL}${route.url}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
