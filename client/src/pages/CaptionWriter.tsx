// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MessageSquare, Loader2, Copy, Sparkles, Hash, RefreshCw } from "lucide-react";

const PLATFORMS = [
  { value: "instagram", label: "Instagram", maxLength: 2200 },
  { value: "tiktok", label: "TikTok", maxLength: 4000 },
  { value: "twitter", label: "X / Twitter", maxLength: 280 },
  { value: "linkedin", label: "LinkedIn", maxLength: 3000 },
  { value: "youtube", label: "YouTube Description", maxLength: 5000 },
  { value: "facebook", label: "Facebook", maxLength: 63206 },
];

const VIBES = [
  { value: "engaging", label: "Engaging & Fun" },
  { value: "professional", label: "Professional" },
  { value: "witty", label: "Witty & Clever" },
  { value: "inspirational", label: "Inspirational" },
  { value: "informative", label: "Informative" },
  { value: "controversial", label: "Hot Take / Controversial" },
];

interface CaptionResult {
  captions: string[];
  hashtags: string[];
}

export default function CaptionWriter() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [vibe, setVibe] = useState("engaging");
  const [results, setResults] = useState<CaptionResult | null>(null);

  const generateMutation = trpc.video.generateStoryboard.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.scenes) {
        const captions = data.scenes.slice(0, 5).map((s: any) => s.description || "").filter(Boolean);
        const hashtagScene = data.scenes.find((s: any) => s.title?.toLowerCase().includes("hashtag"));
        const hashtags = hashtagScene
          ? (hashtagScene.description || "").split(/\s+/).filter((w: string) => w.startsWith("#"))
          : ["#AI", "#content", "#creative", "#DreamForgeX"];
        setResults({ captions, hashtags: hashtags.length > 0 ? hashtags : ["#AI", "#creative", "#DreamForgeX"] });
        toast.success("Captions generated!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!content.trim()) return;
    const plat = PLATFORMS.find((p) => p.value === platform);
    generateMutation.mutate({
      concept: `Generate 5 ${platform} captions for this content: ${content}. Vibe: ${vibe}. Max ${plat?.maxLength || 2200} characters each.
      Each scene description = one complete caption variation.
      Last scene title should be "Hashtags" with description containing 15-20 relevant hashtags.
      Make captions hook-driven, platform-native, and engagement-optimized.`,
      sceneCount: 6,
      style: "cinematic",
      aspectRatio: "16:9",
    });
  };

  const copyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Caption copied!");
  };

  const copyHashtags = () => {
    if (!results) return;
    navigator.clipboard.writeText(results.hashtags.join(" "));
    toast.success("Hashtags copied!");
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">AI Caption Writer</h1>
          <p className="text-muted-foreground mb-6">Sign in to generate social media captions</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white"><a href={getLoginUrl()}>Sign In to Get Started</a></Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-blue-900/10" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-3">
            <Hash className="h-3 w-3" /> AI Captions
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Caption{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Writer</span>
          </h1>
          <p className="text-muted-foreground max-w-md">Generate platform-perfect captions and hashtags. 5 variations per generation.</p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-400" /> Your Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Describe your post... e.g. 'Photo of a sunset at the beach, feeling grateful for summer'" value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="bg-white/5 border-white/10" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Platform</label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Vibe</label>
                  <Select value={vibe} onValueChange={setVibe}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>{VIBES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={!content.trim() || generateMutation.isPending} className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing...</> : <><MessageSquare className="h-4 w-4" /> Generate Captions</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader><CardTitle className="text-base">Generated Captions</CardTitle></CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-4">
                  {results.captions.map((c, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <Badge className="bg-cyan-500/10 text-cyan-400 border-0 text-[9px] mb-2">Option {i + 1}</Badge>
                          <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{c}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyCaption(c)} className="h-7 w-7 p-0 flex-shrink-0"><Copy className="h-3 w-3" /></Button>
                      </div>
                    </motion.div>
                  ))}
                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-purple-400 flex items-center gap-1"><Hash className="h-3 w-3" /> Hashtags</p>
                      <Button variant="ghost" size="sm" onClick={copyHashtags} className="h-6 text-[10px] gap-1"><Copy className="h-2.5 w-2.5" /> Copy All</Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {results.hashtags.map((h, i) => (
                        <Badge key={i} className="bg-purple-500/10 text-purple-300 border-0 text-[10px] cursor-pointer hover:bg-purple-500/20" onClick={() => { navigator.clipboard.writeText(h); toast.success("Copied!"); }}>
                          {h}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2 bg-transparent text-xs" onClick={handleGenerate} disabled={generateMutation.isPending}>
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </Button>
                </div>
              ) : generateMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mb-3" />
                  <p className="text-sm">Writing captions...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Captions will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
