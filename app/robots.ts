import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const privateRoutes = [
    "/admin",
    "/api/",
    "/profile",
    "/credits",
    "/notifications",
    "/api-keys",
    "/brand-kits",
    "/characters",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/llms.txt", "/llms-full.txt"],
        disallow: privateRoutes,
      },
      {
        userAgent: [
          "OAI-SearchBot",
          "ChatGPT-User",
          "GPTBot",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Google-Extended",
          "Applebot-Extended",
        ],
        allow: ["/", "/llms.txt", "/llms-full.txt", "/uncensored", "/tools", "/pricing", "/video-studio"],
        disallow: privateRoutes,
      },
    ],
    sitemap: "https://dreamforgex.ai/sitemap.xml",
  };
}
