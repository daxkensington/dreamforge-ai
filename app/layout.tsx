import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "DreamForgeX — AI Image & Video Generation Studio",
  description:
    "Create stunning AI-generated images and videos with DreamForgeX. Text-to-image, text-to-video, and image-to-video animation — all powered by cutting-edge AI models.",
  openGraph: {
    title: "DreamForgeX — AI Creative Studio",
    description:
      "Turn words into stunning images, videos, and animations — powered by AI.",
    images: ["/showcase/hero-forge.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DreamForgeX — AI Creative Studio",
    description:
      "Turn words into stunning images, videos, and animations — powered by AI.",
    images: ["/showcase/hero-forge.jpg"],
  },
  metadataBase: new URL("https://dreamforgex.ai"),
  other: {
    "theme-color": "#7c3aed",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
