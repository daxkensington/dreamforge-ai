"use client";

import { useState } from "react";
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
import { getLoginUrl } from "@/const";

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
        toast.success("Done! Sign up to make more.");
      } else {
        toast.error(("error" in data && data.error) || "Generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const isLoading = generate.isPending;
  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      toast.error("Tell us what to make — at least a few words.");
      return;
    }
    setResultUrl(null);
    generate.mutate({ prompt: trimmed });
  };

  return (
    <PageLayout>
      <div className="container max-w-5xl py-12 md:py-20">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" />
            Free demo — no signup, no card
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Try AI image generation free
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            One free generation per day. See what DreamForgeX can do before you
            sign up — then unlock 100+ tools and 30+ models.
          </p>
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
      </div>
    </PageLayout>
  );
}
