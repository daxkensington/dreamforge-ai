// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Smartphone, Film, Loader2, Play, Download, Upload, Sparkles,
  TrendingUp, ShoppingBag, MessageSquare, Music, Timer, Camera,
  Zap, ArrowRight, Video,
} from "lucide-react";

const TEMPLATES = [
  {
    id: "dance-trend",
    name: "Dance Trend",
    desc: "Trending dance video with your photo",
    icon: Music,
    color: "from-pink-500 to-rose-500",
    platform: "TikTok",
    aspect: "9:16",
    prompt: "Person dancing to a trending beat, dynamic camera angles, colorful lighting, high energy, viral dance trend style",
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    desc: "Cinematic product reveal with effects",
    icon: ShoppingBag,
    color: "from-cyan-500 to-blue-500",
    platform: "Reels",
    aspect: "9:16",
    prompt: "Cinematic product showcase, dramatic lighting, slow reveal, premium feel, floating product with particle effects",
  },
  {
    id: "talking-head",
    name: "Talking Head",
    desc: "Professional talking-head style video",
    icon: MessageSquare,
    color: "from-violet-500 to-purple-500",
    platform: "YouTube Shorts",
    aspect: "9:16",
    prompt: "Professional talking head video, clean background, good lighting, confident speaker, engaging and dynamic",
  },
  {
    id: "before-after",
    name: "Before & After",
    desc: "Dramatic transformation reveal",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
    platform: "Reels",
    aspect: "9:16",
    prompt: "Dramatic before and after transformation, split screen transition, smooth morph effect, satisfying reveal",
  },
  {
    id: "countdown",
    name: "Top 5 Countdown",
    desc: "Countdown list with transitions",
    icon: Timer,
    color: "from-emerald-500 to-teal-500",
    platform: "TikTok",
    aspect: "9:16",
    prompt: "Dynamic countdown video, bold numbers, energetic transitions between items, engaging pacing, trending format",
  },
  {
    id: "aesthetic-montage",
    name: "Aesthetic Montage",
    desc: "Dreamy montage with music sync",
    icon: Camera,
    color: "from-blue-500 to-indigo-500",
    platform: "Reels",
    aspect: "9:16",
    prompt: "Aesthetic montage video, dreamy color grading, smooth transitions, cinematic slow motion, mood-driven visuals",
  },
  {
    id: "tutorial-hook",
    name: "Tutorial Hook",
    desc: "Attention-grabbing tutorial opener",
    icon: Sparkles,
    color: "from-rose-500 to-pink-500",
    platform: "TikTok",
    aspect: "9:16",
    prompt: "Eye-catching tutorial intro, bold text overlays, step-by-step format, clean graphics, professional editing",
  },
  {
    id: "cinematic-intro",
    name: "Cinematic Intro",
    desc: "Epic movie-trailer style intro",
    icon: Film,
    color: "from-slate-500 to-zinc-500",
    platform: "YouTube",
    aspect: "16:9",
    prompt: "Epic cinematic intro, dramatic music, lens flares, dark moody atmosphere, text reveal with particles, movie trailer quality",
  },
];

export default function SocialTemplates() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const template = TEMPLATES.find((t) => t.id === selectedTemplate);

  const videoMutation = trpc.tools.textToVideo.useMutation({
    onSuccess: (data) => {
      if (data.videoUrl) {
        setResultUrl(data.videoUrl);
        toast.success("Video generated!");
      } else {
        toast.error(data.error || "Generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!template) return;
    const prompt = customPrompt
      ? `${template.prompt}. Additional details: ${customPrompt}`
      : template.prompt;

    videoMutation.mutate({
      prompt,
      duration: "8",
      aspectRatio: template.aspect as any,
      style: "cinematic",
    });
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Social Video Templates</h1>
          <p className="text-muted-foreground mb-6">Sign in to create viral social media videos</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            <a href={getLoginUrl()}>Sign In to Get Started</a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/15 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium mb-3">
            <TrendingUp className="h-3 w-3" />
            Trending Templates
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Social Video{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Templates
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            One-click video templates for TikTok, Instagram Reels, and YouTube Shorts. Pick a template, customize, generate.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-6xl">
        {!selectedTemplate ? (
          /* Template Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <button
                  onClick={() => setSelectedTemplate(t.id)}
                  className="w-full text-left group"
                >
                  <Card className="bg-white/5 border-white/10 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden">
                    <div className={`h-32 bg-gradient-to-br ${t.color} opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                      <t.icon className="h-12 w-12 text-white/80" />
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm">{t.name}</h3>
                        <Badge className="bg-white/10 text-white/60 border-0 text-[10px]">{t.platform}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Template Editor */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
            <Button variant="outline" className="bg-transparent gap-2" onClick={() => { setSelectedTemplate(null); setResultUrl(""); }}>
              <ArrowRight className="h-4 w-4 rotate-180" /> Back to Templates
            </Button>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-6">
                {/* Template header */}
                <div className="flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${template?.color} flex items-center justify-center`}>
                    {template && <template.icon className="h-7 w-7 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{template?.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-white/10 border-0 text-xs">{template?.platform}</Badge>
                      <Badge className="bg-white/10 border-0 text-xs">{template?.aspect}</Badge>
                    </div>
                  </div>
                </div>

                {/* Custom prompt */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Customize (Optional)</label>
                  <Textarea
                    placeholder="Add custom details... e.g. 'Use neon lighting and a city background'"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                {/* Generate */}
                <Button
                  onClick={handleGenerate}
                  disabled={videoMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                >
                  {videoMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating Video...</>
                  ) : (
                    <><Video className="h-4 w-4" /> Generate {template?.name} Video</>
                  )}
                </Button>

                {/* Result */}
                {resultUrl && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className={`rounded-xl overflow-hidden bg-black ${template?.aspect === "9:16" ? "aspect-[9/16] max-w-[280px] mx-auto" : template?.aspect === "1:1" ? "aspect-square max-w-[400px] mx-auto" : "aspect-video"}`}>
                      <video src={resultUrl} controls className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" className="gap-2 bg-transparent" asChild>
                        <a href={resultUrl} download={`${template?.id}-video.mp4`}>
                          <Download className="h-4 w-4" /> Download
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
