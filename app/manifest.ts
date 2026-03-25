import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DreamForgeX — AI Creative Studio",
    short_name: "DreamForgeX",
    description: "Create stunning AI-generated images, videos, and audio with 53+ creative tools.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#06b6d4",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
