// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SocialPublish } from "@/components/SocialPublish";
import { Play, Loader2, Download, Sparkles, Upload, Film } from "lucide-react";

const ANIMATION_STYLES = [
  { value: "particle-reveal", label: "Particle Reveal", desc: "Logo assembles from floating particles" },
  { value: "glitch", label: "Glitch Effect", desc: "Digital glitch transition reveal" },
  { value: "liquid-morph", label: "Liquid Morph", desc: "Logo forms from liquid metal" },
  { value: "neon-glow", label: "Neon Glow", desc: "Neon sign flicker-on effect" },
  { value: "3d-rotate", label: "3D Rotation", desc: "Logo rotates in 3D space" },
  { value: "smoke-reveal", label: "Smoke Reveal", desc: "Logo emerges from smoke/fog" },
  { value: "shatter", label: "Shatter & Reform", desc: "Logo shatters then reforms" },
  { value: "minimal-fade", label: "Minimal Fade", desc: "Clean, elegant fade-in" },
];

export default function LogoAnimator() {
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [brandName, setBrandName] = useState("");
  const [animStyle, setAnimStyle] = useState("particle-reveal");
  const [resultUrl, setResultUrl] = useState("");

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setLogoPreview(reader.result as string); setLogoUrl(reader.result as string); };
    reader.readAsDataURL(file);
  };

  const videoMutation = trpc.tools.textToVideo.useMutation({
    onSuccess: (data) => {
      if (data.videoUrl) { setResultUrl(data.videoUrl); toast.success("Logo animation created!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    const styleDescs: Record<string, string> = {
      "particle-reveal": "Logo assembles from thousands of glowing particles that swirl and converge",
      "glitch": "Digital glitch effect, RGB split, scanlines, then clean logo reveal",
      "liquid-morph": "Liquid chrome metal flows and morphs into the logo shape",
      "neon-glow": "Neon sign effect, tubes flicker on one by one, buzzing glow",
      "3d-rotate": "Logo rotates smoothly in 3D space with reflective surface",
      "smoke-reveal": "Thick atmospheric smoke parts to reveal the logo behind",
      "shatter": "Logo explodes into fragments then time-reverses back together",
      "minimal-fade": "Clean elegant fade from black, subtle scale animation",
    };
    const prompt = `Animated logo intro for "${brandName || "brand"}". ${styleDescs[animStyle]}. Dark background, professional quality, 4 seconds, broadcast quality motion graphics.`;
    videoMutation.mutate({ prompt, duration: "4", aspectRatio: "16:9", style: "cinematic" });
  };

  return (
    <PageLayout>
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-blue-900/10" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-3">
            <Film className="h-3 w-3" /> Logo Animation
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Logo{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Animator</span>
          </h1>
          <p className="text-muted-foreground max-w-md">Upload your logo and AI creates a stunning animated video intro.</p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Your Logo</label>
                {logoPreview ? (
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 rounded-xl bg-white/10 p-2 overflow-hidden">
                      <img src={logoPreview} alt="Your logo" className="w-full h-full object-contain" />
                    </div>
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={() => { setLogoUrl(""); setLogoPreview(""); }}>Change</Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/30 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload your logo (PNG, SVG, JPG)</span>
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </label>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Brand Name</label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Your brand name" className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Animation Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {ANIMATION_STYLES.map((s) => (
                    <button key={s.value} onClick={() => setAnimStyle(s.value)}
                      className={`p-3 rounded-lg text-left transition-all ${animStyle === s.value ? "bg-cyan-500/15 border border-cyan-500/30" : "bg-white/5 border border-white/10 hover:border-white/20"}`}>
                      <p className="text-xs font-medium">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={videoMutation.isPending} className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                {videoMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Animating...</> : <><Sparkles className="h-4 w-4" /> Animate Logo</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6">
              {resultUrl ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden bg-black aspect-video">
                    <video src={resultUrl} controls autoPlay loop className="w-full h-full" />
                  </div>
                  <Button variant="outline" className="w-full gap-2 bg-transparent" asChild>
                    <a href={resultUrl} download="logo-animation.mp4"><Download className="h-4 w-4" /> Download</a>
                  </Button>
                  <SocialPublish contentUrl={resultUrl} contentType="video" title="Logo Animation" />
                </div>
              ) : videoMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-12 w-12 animate-spin text-cyan-500 mb-4" />
                  <p className="text-sm">Animating your logo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Film className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Your animation will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
