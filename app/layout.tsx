import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MetaPixel } from "./MetaPixel";
import { Analytics } from "./Analytics";
import { MetaPixelConversions } from "./MetaPixelConversions";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#7c3aed" },
    { media: "(prefers-color-scheme: light)", color: "#7c3aed" },
  ],
};

export const metadata: Metadata = {
  title: "DreamForgeX — AI Image & Video Generation Studio (100+ Tools & Uncensored 18+ Studio)",
  description:
    "Create stunning AI images, cinematic videos, songs, and consistent characters with 100+ AI tools and 30+ models (FLUX, Veo 3, Runway Gen-4, Wan 2.2) — plus an Uncensored 18+ Pro Studio with 3 free previews.",
  openGraph: {
    title: "DreamForgeX — AI Creative Studio (100+ AI Tools & 30+ Models)",
    description:
      "Turn words into stunning images, cinematic videos, consistent characters, and songs — powered by 30+ frontier & self-hosted AI models.",
    url: "https://dreamforgex.ai",
    siteName: "DreamForgeX",
    images: [
      {
        url: "https://dreamforgex.ai/og-image.jpg",
        width: 1408,
        height: 768,
        alt: "DreamForgeX — AI Creative Studio with 100+ tools",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DreamForgeX — AI Creative Studio (100+ Tools)",
    description:
      "Turn words into stunning images, cinematic videos, consistent characters, and songs — powered by 30+ frontier & self-hosted AI models.",
    images: ["https://dreamforgex.ai/og-image.jpg"],
    site: "@dreamforgex_ai",
  },
  metadataBase: new URL("https://dreamforgex.ai"),
  // NOTE: no root-level `alternates` here on purpose. A previous version
  // declared 13 hreflang language versions all pointing at the homepage —
  // the site is English-only, so that advertised non-existent translations
  // and (being inherited by every page) muddied canonicalization. Each page
  // sets its own self-referential canonical via its own `alternates`.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DreamForgeX",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://dreamforgex.ai/#organization",
      name: "DreamForgeX",
      url: "https://dreamforgex.ai",
      logo: "https://dreamforgex.ai/logo.png",
      description:
        "All-in-one AI Creative Studio with 100+ tools and 30+ models for AI image generation, video production, audio & song synthesis, character consistency, and an Uncensored 18+ Pro Studio.",
      sameAs: ["https://x.com/dreamforgex_ai"],
    },
    {
      "@type": "WebSite",
      "@id": "https://dreamforgex.ai/#website",
      url: "https://dreamforgex.ai",
      name: "DreamForgeX",
      publisher: { "@id": "https://dreamforgex.ai/#organization" },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://dreamforgex.ai/#app",
      name: "DreamForgeX",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: "https://dreamforgex.ai",
      description:
        "All-in-one AI creative studio with 100+ tools and 30+ models (FLUX.1, Imagen 4, Veo 3, Runway Gen-4, Kling 2.0, Wan 2.2) plus a self-hosted Uncensored 18+ Pro Studio with Character Face Lock, Virtual Outfit Swap, Brush Inpainting, and 4-View Character Sheets.",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "79",
        priceCurrency: "USD",
        offerCount: "8",
      },
      featureList:
        "AI Image Generation (FLUX.1, Imagen 4, Recraft V3, Ideogram V3), AI Video Studio (Google Veo 3, Runway Gen-4, Kling 2.0, Wan 2.2), Uncensored 18+ Pro Studio (No Content Filter, 3 Free Previews, Card/Apple Pay or Bitcoin), Character Face Lock, Virtual Outfit Swap, 4-View Character Turnaround Sheet, Canvas Brush Inpainting, AI Song & Music Video Creator, 4K Image & Video Upscaling",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <MetaPixel />
        <Providers>
          <MetaPixelConversions />
          <Analytics />
          {children}
        </Providers>
      </body>
    </html>
  );
}
