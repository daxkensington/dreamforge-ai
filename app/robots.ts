import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/profile", "/credits", "/notifications", "/api-keys", "/brand-kits", "/characters"],
      },
    ],
    sitemap: "https://genesis-synth-lab.vercel.app/sitemap.xml",
  };
}
