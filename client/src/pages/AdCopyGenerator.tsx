// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Megaphone, Loader2, Copy, Sparkles, RefreshCw } from "lucide-react";

const PLATFORMS = [
  { value: "google", label: "Google Ads" },
  { value: "facebook", label: "Facebook/Instagram Ads" },
  { value: "linkedin", label: "LinkedIn Ads" },
  { value: "twitter", label: "X/Twitter Ads" },
  { value: "tiktok", label: "TikTok Ads" },
  { value: "email", label: "Email Subject Lines" },
];

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual & Friendly" },
  { value: "urgent", label: "Urgent / FOMO" },
  { value: "luxury", label: "Luxury / Premium" },
  { value: "funny", label: "Funny / Witty" },
  { value: "emotional", label: "Emotional / Story" },
];

interface AdResult {
  headlines: string[];
  descriptions: string[];
  ctas: string[];
}

export default function AdCopyGenerator() {
  const { user } = useAuth();
  const [product, setProduct] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [tone, setTone] = useState("professional");
  const [audience, setAudience] = useState("");
  const [results, setResults] = useState<AdResult | null>(null);

  const generateMutation = trpc.video.generateStoryboard.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.scenes) {
        const parsed: AdResult = {
          headlines: data.scenes.slice(0, 5).map((s: any) => s.title || ""),
          descriptions: data.scenes.slice(0, 3).map((s: any) => s.description || ""),
          ctas: data.scenes.slice(3, 6).map((s: any) => s.title || "Learn More"),
        };
        setResults(parsed);
        toast.success("Ad copy generated!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!product.trim()) return;
    generateMutation.mutate({
      concept: `Generate ${platform} ad copy for: ${product}. Tone: ${tone}. ${audience ? `Target audience: ${audience}.` : ""}
      Create 5 headline variations (short, punchy, under 30 characters each), 3 description variations (under 90 characters), and 3 CTA variations.
      Each scene title = one headline, each scene description = one ad description.`,
      sceneCount: 6,
      style: "cinematic",
      aspectRatio: "16:9",
    });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Megaphone className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">AI Ad Copy Generator</h1>
          <p className="text-muted-foreground mb-6">Sign in to generate high-converting ad copy</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            <a href={getLoginUrl()}>Sign In to Get Started</a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
            <Megaphone className="h-3 w-3" />
            AI Copywriting
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Ad Copy{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Generator
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            Generate high-converting ad copy for Google, Facebook, Instagram, LinkedIn, TikTok, and email campaigns.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                Your Product / Service
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder="Describe what you're selling... e.g. 'AI-powered design tool that creates social media graphics in seconds'" value={product} onChange={(e) => setProduct(e.target.value)} rows={3} className="bg-white/5 border-white/10" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Platform</label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Tone</label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input placeholder="Target audience (optional)" value={audience} onChange={(e) => setAudience(e.target.value)} className="bg-white/5 border-white/10" />
              <Button onClick={handleGenerate} disabled={!product.trim() || generateMutation.isPending} className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Megaphone className="h-4 w-4" /> Generate Ad Copy</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Generated Copy</CardTitle>
            </CardHeader>
            <CardContent>
              {results ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Headlines</p>
                    {results.headlines.filter(Boolean).map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-white/5 mb-1.5">
                        <span className="text-sm">{h}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyText(h)} className="h-6 w-6 p-0"><Copy className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Descriptions</p>
                    {results.descriptions.filter(Boolean).map((d, i) => (
                      <div key={i} className="flex items-start justify-between p-2 rounded bg-white/5 mb-1.5">
                        <span className="text-xs text-white/80">{d}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyText(d)} className="h-6 w-6 p-0 flex-shrink-0"><Copy className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">CTAs</p>
                    <div className="flex flex-wrap gap-2">
                      {results.ctas.filter(Boolean).map((c, i) => (
                        <Badge key={i} className="bg-cyan-500/10 text-cyan-400 border-0 cursor-pointer hover:bg-cyan-500/20" onClick={() => copyText(c)}>{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={handleGenerate} disabled={generateMutation.isPending}>
                    <RefreshCw className="h-3 w-3" /> Regenerate
                  </Button>
                </div>
              ) : generateMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mb-3" />
                  <p className="text-sm">Writing your ad copy...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Megaphone className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Your ad copy will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
