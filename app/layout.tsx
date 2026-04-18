import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MetaPixel } from "./MetaPixel";
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
  title: "DreamForgeX — AI Image & Video Generation Studio",
  description:
    "Create stunning AI-generated images and videos with DreamForgeX. Text-to-image, text-to-video, and image-to-video animation — all powered by cutting-edge AI models.",
  openGraph: {
    title: "DreamForgeX — AI Creative Studio",
    description:
      "Turn words into stunning images, videos, and animations — powered by AI.",
    url: "https://dreamforgex.ai",
    siteName: "DreamForgeX",
    images: [
      {
        url: "https://dreamforgex.ai/og-image.jpg",
        width: 1408,
        height: 768,
        alt: "DreamForgeX — AI Creative Studio with 75+ tools",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "DreamForgeX — AI Creative Studio",
    description:
      "Turn words into stunning images, videos, and animations — powered by AI.",
    images: ["https://dreamforgex.ai/og-image.jpg"],
    site: "@dreamforgex_ai",
  },
  metadataBase: new URL("https://dreamforgex.ai"),
  alternates: {
    languages: {
      "en": "https://dreamforgex.ai",
      "es": "https://dreamforgex.ai",
      "fr": "https://dreamforgex.ai",
      "de": "https://dreamforgex.ai",
      "pt": "https://dreamforgex.ai",
      "zh": "https://dreamforgex.ai",
      "ja": "https://dreamforgex.ai",
      "ko": "https://dreamforgex.ai",
      "ar": "https://dreamforgex.ai",
      "hi": "https://dreamforgex.ai",
      "ru": "https://dreamforgex.ai",
      "tr": "https://dreamforgex.ai",
      "it": "https://dreamforgex.ai",
    },
  },
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
      name: "DreamForgeX",
      url: "https://dreamforgex.ai",
      logo: "https://dreamforgex.ai/logo.png",
      description: "AI Creative Studio — 75+ tools for images, video, audio, songs, and design",
      sameAs: ["https://x.com/dreamforgex_ai"],
    },
    {
      "@type": "SoftwareApplication",
      name: "DreamForgeX",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      url: "https://dreamforgex.ai",
      description: "All-in-one AI creative studio with 75+ tools for image generation, video creation, song production, and design",
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "149",
        priceCurrency: "USD",
        offerCount: "6",
      },
      featureList: "AI Image Generation, AI Video Creation, AI Song Creator, Music Video Studio, 50+ Social Templates, 25 Design Templates, AI Presentations, Blog Writer, Ad Copy Generator",
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
          {children}
        </Providers>
      </body>
    </html>
  );
}
