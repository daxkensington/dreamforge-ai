// @ts-nocheck
import { useState, useEffect } from "react";
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
import {
  Scissors, Loader2, Download, Upload, Sparkles,
  TrendingUp, Film, Play, Clock, Smartphone, Zap,
  MessageSquare, Share2,
} from "lucide-react";

const CLIP_STYLES = [
  { value: "viral-hook", label: "Viral Hook", desc: "Attention-grabbing opener that stops the scroll", icon: Zap },
  { value: "highlight-reel", label: "Highlight Reel", desc: "Best moments compiled into a fast-paced montage", icon: TrendingUp },
  { value: "storytelling", label: "Storytelling", desc: "Narrative arc with beginning, middle, end", icon: MessageSquare },
  { value: "tutorial-clip", label: "Tutorial Clip", desc: "Key steps extracted as quick how-to", icon: Sparkles },
  { value: "reaction", label: "Reaction Moments", desc: "Most emotional or surprising moments", icon: Play },
];

export default function ClipMaker() {
  const { user } = useAuth();
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<string>("");

  // Cleanup blob URL on unmount or change
  useEffect(() => {
    return () => { if (videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl); };
  }, [videoUrl]);
  const [description, setDescription] = useState("");
  const [clipStyle, setClipStyle] = useState("viral-hook");
  const [clipCount, setClipCount] = useState("3");
  const [targetPlatform, setTargetPlatform] = useState("tiktok");
  const [clips, setClips] = useState<Array<{ title: string; description: string; timestamp: string; hook: string }>>([]);

  const clipMutation = trpc.video.generateStoryboard.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.scenes) {
        setClips(data.scenes.map((s: any, i: number) => ({
          title: s.title || `Clip ${i + 1}`,
          description: s.description || "",
          timestamp: s.duration ? `0:${String(i * 10).padStart(2, "0")} - 0:${String((i + 1) * 10).padStart(2, "0")}` : `Clip ${i + 1}`,
          hook: s.cameraAngle || "Dynamic cut",
        })));
        toast.success(`${data.scenes.length} clip ideas generated!`);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file.name);
    setVideoUrl(URL.createObjectURL(file));
    toast.success(`Video loaded: ${file.name}`);
  };

  const handleAnalyze = () => {
    const concept = `Analyze this video concept and create ${clipCount} short viral clips for ${targetPlatform}. Style: ${clipStyle}. ${description ? `Context: ${description}` : ""}

    For each clip, provide:
    - A catchy title/hook
    - What to show
    - Camera angles and transitions
    - Why it would go viral`;

    clipMutation.mutate({
      concept,
      sceneCount: parseInt(clipCount),
      style: "cinematic",
      aspectRatio: targetPlatform === "youtube" ? "16:9" : "9:16",
    });
  };


  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
            <Scissors className="h-3 w-3" />
            AI-Powered Editing
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Viral{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Clip Maker
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            AI analyzes your content and creates scroll-stopping short clips optimized for TikTok, Reels, and YouTube Shorts.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Input */}
          <div className="space-y-6">
            {/* Video Source */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Film className="h-5 w-5 text-cyan-400" />
                  Your Content
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {videoUrl ? (
                  <div className="space-y-3">
                    <div className="rounded-xl overflow-hidden bg-black aspect-video">
                      <video src={videoUrl} controls className="w-full h-full" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-cyan-500/15 text-cyan-400 border-0 text-xs">{videoFile}</Badge>
                      <Button variant="outline" size="sm" className="bg-transparent" onClick={() => { setVideoUrl(""); setVideoFile(""); }}>
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/30 transition-colors">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload your video</span>
                      <span className="text-xs text-muted-foreground/50">MP4, MOV, WebM</span>
                      <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                    </label>
                    <div className="text-center text-xs text-muted-foreground">or describe your content</div>
                  </div>
                )}

                <Textarea
                  placeholder="Describe your video content... e.g. 'A 10-minute cooking tutorial showing how to make pasta from scratch'"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-white/5 border-white/10"
                />
              </CardContent>
            </Card>

            {/* Clip Settings */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  Clip Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Clip Style</label>
                  <div className="space-y-2">
                    {CLIP_STYLES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setClipStyle(s.value)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                          clipStyle === s.value
                            ? "bg-cyan-500/15 border border-cyan-500/30"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        <s.icon className={`h-4 w-4 ${clipStyle === s.value ? "text-cyan-400" : "text-muted-foreground"}`} />
                        <div>
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Number of Clips</label>
                    <Select value={clipCount} onValueChange={setClipCount}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "3", "5", "7", "10"].map((n) => (
                          <SelectItem key={n} value={n}>{n} clips</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Platform</label>
                    <Select value={targetPlatform} onValueChange={setTargetPlatform}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="reels">Instagram Reels</SelectItem>
                        <SelectItem value="shorts">YouTube Shorts</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleAnalyze}
                  disabled={(!videoUrl && !description.trim()) || clipMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                >
                  {clipMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing & Creating Clips...</>
                  ) : (
                    <><Scissors className="h-4 w-4" /> Generate Clip Ideas</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Results */}
          <div>
            <Card className="bg-white/5 border-white/10 sticky top-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-cyan-400" />
                  Generated Clips
                  {clips.length > 0 && (
                    <Badge className="bg-cyan-500/15 text-cyan-400 border-0 ml-auto">{clips.length} clips</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clips.length > 0 ? (
                  <div className="space-y-3">
                    {clips.map((clip, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-cyan-400">#{i + 1}</span>
                              <h3 className="font-semibold text-sm">{clip.title}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{clip.description}</p>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-white/5 border-0 text-[10px]">
                                <Clock className="h-2.5 w-2.5 mr-1" />{clip.timestamp}
                              </Badge>
                              <Badge className="bg-white/5 border-0 text-[10px]">{clip.hook}</Badge>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    <div className="pt-3 flex gap-2">
                      <Button variant="outline" className="flex-1 gap-2 bg-transparent text-xs" onClick={() => toast.info("Export feature launching soon — stay tuned!")}>
                        <Share2 className="h-3 w-3" /> Export All
                      </Button>
                      <Button
                        className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs"
                        onClick={() => { setClips([]); handleAnalyze(); }}
                        disabled={clipMutation.isPending}
                      >
                        <Sparkles className="h-3 w-3" /> Regenerate
                      </Button>
                    </div>
                  </div>
                ) : clipMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-12 w-12 animate-spin text-cyan-500 mb-4" />
                    <p className="text-sm font-medium">Analyzing your content...</p>
                    <p className="text-xs text-muted-foreground mt-1">Finding the most viral moments</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <Scissors className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground">Your clips will appear here</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Upload a video or describe your content to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
