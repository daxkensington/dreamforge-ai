"use client";

import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Twitter,
  Facebook,
  MessageCircle,
} from "lucide-react";

interface ShareGenerationViewProps {
  id: number;
  prompt: string;
  mediaType: "image" | "video";
  imageUrl: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/**
 * Public-facing share page UI. Optimised for non-logged-in viewers landing
 * from a social share — leads with the asset, then the prompt, then the
 * "make your own" CTA. Designed to convert curious viewers into trial users.
 */
export function ShareGenerationView({
  id,
  prompt,
  mediaType,
  imageUrl,
  width,
  height,
  createdAt,
}: ShareGenerationViewProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/g/${id}`
      : `https://dreamforgex.ai/g/${id}`;
  const tryNowUrl = `/workspace?prompt=${encodeURIComponent(prompt)}`;
  const aspect =
    width && height ? `${width} / ${height}` : mediaType === "video" ? "16 / 9" : "1 / 1";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  const shareText = `Check out this AI ${mediaType} I made on DreamForgeX:`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  return (
    <PageLayout>
      <div className="container max-w-5xl py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Asset */}
          <div className="lg:col-span-3">
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-card/40 border border-border/50 shadow-2xl"
              style={{ aspectRatio: aspect }}
            >
              {mediaType === "video" ? (
                <video
                  src={imageUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={prompt.slice(0, 200)}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                  loading="eager"
                />
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={imageUrl}
                download={`dreamforgex-${id}.${mediaType === "video" ? "mp4" : "png"}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </a>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-cyan-400 font-medium mb-2">
                Prompt
              </p>
              <p className="text-base leading-relaxed text-foreground/90">
                {prompt}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Generated {new Date(createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 p-5">
              <h2 className="text-lg font-semibold mb-1.5">Like this? Try it yourself.</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Generate {mediaType === "video" ? "videos" : "images"} like this on
                DreamForgeX with 100+ AI tools and 30+ models.
              </p>
              <a href={tryNowUrl} className="block">
                <Button className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
                  <Sparkles className="h-4 w-4" />
                  Try this prompt — free
                </Button>
              </a>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                Share
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleCopy}
                  aria-label="Copy share link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <a href={xUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Twitter className="h-4 w-4" />X
                  </Button>
                </a>
                <a href={fbUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Facebook className="h-4 w-4" />
                    Facebook
                  </Button>
                </a>
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
