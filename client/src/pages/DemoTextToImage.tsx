"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Wand2,
  Lock,
  CheckCircle2,
  Download,
  ArrowRight,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { buildAdultRedirectUrl, isAdultRedirect } from "@shared/adultRouting";
import { getLoginUrl } from "@/const";
import { track } from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (event: string, name: string, params?: Record<string, unknown>) => void;
  }
}

/**
 * Meta custom conversion for demo activations, so paid campaigns can
 * optimize on "person actually got a generation out of the demo", not just
 * clicks. Guarded like the pixel code in app/MetaPixelConversions.tsx: the
 * pixel may be blocked or absent, and that must never break the demo.
 * Called from the mutation's onSuccess — i.e. once per completed demo
 * generation, never per render.
 */
function trackDemoActivation(): void {
  try {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("trackCustom", "DemoGenerationCompleted", { content_type: "demo" });
    }
  } catch {
    /* measurement failure must never surface to the visitor */
  }
}

const DEMO_PROMPTS = [
  "An astronaut riding a horse on Mars at sunset, photorealistic",
  "A cyberpunk Tokyo street market in heavy rain, neon reflections",
  "A snow leopard wearing a tiny crown, studio portrait, soft lighting",
  "A futuristic floating city above the clouds, dramatic golden hour",
  "A magical library inside a hollow tree, glowing books, ethereal",
];

/**
 * Public demo page — one free generation per IP per day, no signup.
 *
 * Conversion choreography:
 *   1) prompt input + 5 example prompts to remove "what do I type?" friction
 *   2) one-click generate, no model picker, no settings (cognitive load = 0)
 *   3) result + soft watermark text + "make 100+ more" CTA wired to /signin
 *
 * The CTA is the whole point — bouncing visitors from this page is fine,
 * losing the converted ones to a sign-up wall isn't.
 */
export default function DemoTextToImage() {
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultPrompt, setResultPrompt] = useState<string | null>(null);

  const generate = trpc.demo.generate.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        setResultPrompt(data.prompt ?? prompt);
        track("generation_completed", { kind: "demo" });
        trackDemoActivation();
        toast.success("Done! Sign up to make more.");
      } else {
        const err = ("error" in data && data.error) || "";
        // Adult prompt — hand it to the uncensored funnel rather than serving
        // it free and anonymously on the demo's no-safety chain.
        if (isAdultRedirect(err)) {
          toast.info("That one needs Uncensored mode — taking you there…");
          window.location.href = buildAdultRedirectUrl(prompt);
          return;
        }
        toast.error(err || "Generation failed");
      }
    },
    onError: (err) => {
      if (isAdultRedirect(err.message)) {
        window.location.href = buildAdultRedirectUrl(prompt);
        return;
      }
      toast.error(err.message);
    },
  });

  // Continuity from the homepage "Try It Now" box: if it handed us a prompt
  // via ?prompt=, prefill it and fire one generation immediately so the
  // "I typed → it generated" illusion survives the page hop.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    const incoming = new URLSearchParams(window.location.search).get("prompt");
    const trimmed = (incoming ?? "").trim().slice(0, 500);
    if (trimmed.length >= 3) {
      autoRan.current = true;
      setPrompt(trimmed);
      setResultUrl(null);
      track("generation_started", { kind: "demo", source: "autogen" });
      generate.mutate({ prompt: trimmed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = generate.isPending;
  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      toast.error("Tell us what to make — at least a few words.");
      return;
    }
    setResultUrl(null);
    track("generation_started", { kind: "demo" });
    generate.mutate({ prompt: trimmed });
  };

  return (
    <PageLayout>
      <div className="container max-w-5xl py-12 md:py-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/50 p-6 md:p-10 text-center mb-10 shadow-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.18),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.16),transparent_60%)] pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-4 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" />
              Free Instant Demo — No Signup, No Card Required
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
              Try AI Image Generation{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                Free
              </span>
            </h1>
            <p className="text-base md:text-lg text-white/75 max-w-2xl mx-auto mb-6">
              One free photorealistic generation per day. See what DreamForgeX can render in seconds — then unlock 100+ studio tools, 4K upscaling, and Uncensored Pro.
            </p>
            <div className="grid grid-cols-4 gap-2.5 max-w-2xl mx-auto">
              {[
                { src: "/showcase/gallery-2.jpg", label: "Cyberpunk" },
                { src: "/showcase/uncensored-char-aria-nordic.jpg", label: "Portrait" },
                { src: "/showcase/gallery-10.jpg", label: "Fantasy" },
                { src: "/showcase/gallery-4.jpg", label: "Sci-Fi" },
              ].map((art) => (
                <div key={art.label} className="relative rounded-xl overflow-hidden aspect-[16/10] border border-white/15 group">
                  <img src={art.src} alt={art.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-2">
                    <span className="text-[10px] font-semibold text-white/90">{art.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Input */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
              <label className="text-sm font-medium mb-2 block">Describe an image</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="An astronaut riding a horse on Mars at sunset, photorealistic..."
                rows={5}
                className="resize-none mb-3"
                maxLength={500}
                disabled={isLoading}
              />
              <Button
                onClick={handleGenerate}
                disabled={isLoading || prompt.trim().length < 3}
                className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate (free)
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2 text-center">
                One free image per day per IP. Sign up for unlimited.
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/40 p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
                Try these
              </p>
              <div className="space-y-2">
                {DEMO_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrompt(p)}
                    disabled={isLoading}
                    className="block w-full text-left text-xs px-3 py-2 rounded-md bg-background/40 hover:bg-accent border border-border/30 transition-colors disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="lg:col-span-3">
            <div className="aspect-square w-full rounded-2xl bg-card/40 border border-border/50 overflow-hidden flex items-center justify-center relative">
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <p className="text-sm text-muted-foreground">
                    Conjuring pixels…
                  </p>
                </div>
              )}
              {!isLoading && resultUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultUrl}
                  alt={resultPrompt ?? "Generated image"}
                  className="w-full h-full object-contain"
                />
              )}
              {!isLoading && !resultUrl && (
                <div className="text-center px-8 max-w-sm">
                  <Wand2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Your generation will appear here.
                  </p>
                </div>
              )}
            </div>

            {resultUrl && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 p-5"
              >
                <div className="flex items-center gap-2 mb-2 text-emerald-300 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Done — that's your free one for today.
                </div>
                <h3 className="text-xl font-semibold mb-1">
                  Want to make 100 more this month?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign up free for 50 credits/day, 100+ tools, video gen, and
                  no daily limit.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => (window.location.href = getLoginUrl())}
                    className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                  >
                    Sign up free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                  >
                    <a
                      href={resultUrl}
                      download={`dreamforgex-demo.png`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Why DreamForgeX */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Sparkles, title: "100+ AI tools", desc: "From upscaling to virtual try-on, character consistency to video generation." },
            { icon: Lock, title: "Your work stays yours", desc: "Commercial license on all paid plans, no watermarks." },
            { icon: Wand2, title: "30+ models, one bill", desc: "Flux, Veo, Kling, Ideogram, Sora — all in one credit pool." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/50 bg-card/40 p-5">
              <f.icon className="h-5 w-5 text-cyan-400 mb-2.5" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Discreet 18+ entry — captures unfiltered intent without putting
            adult positioning in front of SFW visitors, and gives /uncensored
            an internal inbound link. */}
        <p className="mt-10 text-center text-xs text-muted-foreground/70">
          Looking for unfiltered generation?{" "}
          <a
            href="/uncensored"
            className="underline underline-offset-2 hover:text-rose-400 transition-colors"
          >
            Uncensored mode (18+)
          </a>
        </p>
      </div>
    </PageLayout>
  );
}
