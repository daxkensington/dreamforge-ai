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
          "Claude-SearchBot",
          "Claude-Web",
          "ClaudeBot",
          "Anthropic-AI",
          "anthropic-ai",
          "PerplexityBot",
          "Perplexity-User",
          "Google-Extended",
          "Applebot-Extended",
          "DuckAssistBot",
          "YouBot",
        ],
        allow: ["/", "/llms.txt", "/llms-full.txt", "/uncensored", "/tools", "/pricing", "/marketplace", "/explore", "/video-studio", "/blog"],
        disallow: privateRoutes,
      },
      {
        userAgent: ["Bytespider", "CCBot", "MJ12bot"],
        disallow: ["/"],
      },
    ],
    sitemap: "https://dreamforgex.ai/sitemap.xml",
  };
}
