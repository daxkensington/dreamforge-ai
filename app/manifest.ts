import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DreamForgeX — AI Creative Studio",
    short_name: "DreamForgeX",
    description:
      "Create stunning AI-generated images, videos, and audio with 71+ creative tools.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#7c3aed",
    orientation: "portrait-primary",
    categories: ["entertainment", "productivity", "photo", "design"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Generate Image",
        short_name: "Image",
        url: "/tools/prompt-builder",
        description: "Create AI-generated images from text prompts",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Create Video",
        short_name: "Video",
        url: "/tools/text-to-video",
        description: "Generate AI videos from text descriptions",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Music Studio",
        short_name: "Music",
        url: "/tools/music-gen",
        description: "Create AI-generated music and audio",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My Gallery",
        short_name: "Gallery",
        url: "/gallery",
        description: "Browse your generated creations",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
