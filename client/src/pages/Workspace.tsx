import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles,
  Wand2,
  Image,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Clock,
  ExternalLink,
  Video,
  Film,
  Settings2,
  Zap,
  RotateCcw,
  Timer,
  Cpu,
  Maximize,
  Play,
  ArrowRight,
  Clapperboard,
  Link2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MODEL_OPTIONS = [
  // Image models
  { value: "auto", label: "Auto (Best Available)", desc: "Automatically picks the best model", types: ["image"], tier: "free", badge: "Recommended" },
  { value: "grok", label: "Grok Image Gen", desc: "Fast generation via xAI", types: ["image"], tier: "free" },
  { value: "flux-pro", label: "Flux 1.1 Pro", desc: "Highest quality, photorealistic", types: ["image"], tier: "creator", badge: "Premium" },
  { value: "flux-schnell", label: "Flux Schnell", desc: "Fast, high-quality iteration", types: ["image"], tier: "free" },
  { value: "dall-e-3", label: "DALL-E 3", desc: "Excellent prompt following by OpenAI", types: ["image"], tier: "creator" },
  { value: "sd3", label: "Stable Diffusion 3", desc: "Great detail and text rendering", types: ["image"], tier: "creator" },
  { value: "gemini", label: "Gemini Imagen", desc: "Google's image generation", types: ["image"], tier: "free" },
  // Video models
  { value: "veo-3", label: "Google Veo 3", desc: "State-of-the-art video with audio", types: ["video"], tier: "free", badge: "Best" },
  { value: "minimax", label: "Minimax Video", desc: "High-quality short video clips", types: ["video"], tier: "creator" },
];

const PRESET_PROMPTS = [
  "A crystalline dragon perched atop a floating island surrounded by aurora borealis, digital art style",
  "Biomechanical jellyfish drifting through a neon-lit underwater cyberpunk city, volumetric lighting",
  "Ancient mythological temple overgrown with bioluminescent flora, surreal dreamscape",
  "Abstract geometric forms dancing in zero gravity, iridescent metallic surfaces, art nouveau influence",
  "Ethereal forest spirit composed of flowing light particles, impressionist watercolor style",
];

const VIDEO_PRESETS = [
  "A phoenix rising from crystalline flames, cinematic slow motion, particle effects",
  "Ocean waves transforming into liquid mercury under a neon sky, smooth motion",
  "Mechanical clockwork butterfly taking flight from a steampunk garden, fluid animation",
  "Abstract paint strokes flowing and morphing into cosmic nebula patterns, dreamlike motion",
];

export default function Workspace() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [prompt, setPrompt] = useState("");

  // Accept prompt from onboarding wizard via URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wizardPrompt = params.get("prompt");
    if (wizardPrompt) {
      setPrompt(wizardPrompt);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [duration, setDuration] = useState(4);
  const [modelVersion, setModelVersion] = useState("built-in-v1");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitGenId, setSubmitGenId] = useState<number | null>(null);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitDesc, setSubmitDesc] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [seed, setSeed] = useState("");
  const [styleRef, setStyleRef] = useState("");
  const [aspectPreset, setAspectPreset] = useState("1:1");
  const [variationStrength, setVariationStrength] = useState(50); // 0-100 slider
  const [creativityLevel, setCreativityLevel] = useState(70); // for upscale/variation quality
  const [animateDialogOpen, setAnimateDialogOpen] = useState(false);
  const [animateGenId, setAnimateGenId] = useState<number | null>(null);
  const [animateDuration, setAnimateDuration] = useState(4);
  const [animateStyle, setAnimateStyle] = useState<string>("smooth-pan");

  const { data: tags } = trpc.tags.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: generations, refetch: refetchGens } = trpc.generation.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  const utils = trpc.useUtils();

  const filteredModels = useMemo(
    () => MODEL_OPTIONS.filter((m) => m.types.includes(mediaType)),
    [mediaType]
  );

  const generateMutation = trpc.generation.create.useMutation({
    onSuccess: (data: any) => {
      if (data.status === "completed") {
        toast.success(`${data.mediaType === "video" ? "Video" : "Image"} generation completed!`);
        // Show achievement unlock toasts
        if (data.newAchievements && data.newAchievements.length > 0) {
          data.newAchievements.forEach((a: any) => {
            setTimeout(() => {
              toast.success(`\uD83C\uDFC6 Achievement Unlocked: ${a.name}!`, {
                description: a.description,
                duration: 6000,
              });
            }, 1500);
          });
        }
      } else if (data.status === "failed") {
        toast.error(`Generation failed: ${data.error || "Unknown error"}`);
      }
      refetchGens();
    },
    onError: (err) => toast.error(err.message),
  });

  const enhanceMutation = trpc.generation.enhancePrompt.useMutation({
    onSuccess: (data) => {
      setPrompt(data.enhanced);
      toast.success("Prompt enhanced with AI!");
    },
    onError: () => toast.error("Failed to enhance prompt"),
  });

  const submitMutation = trpc.generation.submitToGallery.useMutation({
    onSuccess: () => {
      toast.success("Submitted for review!");
      setSubmitDialogOpen(false);
      setSubmitTitle("");
      setSubmitDesc("");
      setSubmitGenId(null);
      refetchGens();
    },
    onError: (err) => toast.error(err.message),
  });

  const animateMutation = trpc.generation.animateImage.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") {
        toast.success("Image animated into video clip!");
      } else if (data.status === "failed") {
        toast.error(`Animation failed: ${data.error || "Unknown error"}`);
      }
      setAnimateDialogOpen(false);
      setAnimateGenId(null);
      refetchGens();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAnimate = () => {
    if (!animateGenId) return;
    animateMutation.mutate({
      sourceGenerationId: animateGenId,
      duration: animateDuration,
      animationStyle: animateStyle as any,
    });
  };

  const handleMediaTypeChange = (type: "image" | "video") => {
    setMediaType(type);
    // Auto-select appropriate model
    if (type === "video") {
      setModelVersion("animatediff-v2");
    } else {
      setModelVersion("built-in-v1");
    }
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    generateMutation.mutate({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      mediaType,
      width,
      height,
      duration: mediaType === "video" ? duration : undefined,
      modelVersion,
      tagIds: selectedTags.length > 0 ? selectedTags : undefined,
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const usePreset = (p: string) => {
    setPrompt(p);
    toast.info("Preset prompt loaded");
  };

  // Compute stats
  const genStats = useMemo(() => {
    if (!generations) return { total: 0, completed: 0, images: 0, videos: 0 };
    return {
      total: generations.length,
      completed: generations.filter((g: any) => g.status === "completed").length,
      images: generations.filter((g: any) => g.mediaType === "image" && g.status === "completed").length,
      videos: generations.filter((g: any) => g.mediaType === "video" && g.status === "completed").length,
    };
  }, [generations]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <div className="lg:col-span-3">
              <Skeleton className="h-[500px] rounded-xl" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <div className="max-w-md mx-auto">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-6">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Sign in to Access Workspace</h1>
            <p className="text-muted-foreground mb-8">
              The prompt workspace requires authentication. Sign in to begin generating synthetic research media.
            </p>
            <Button onClick={() => (window.location.href = getLoginUrl())} size="lg" className="glow-primary">
              Sign in to Continue
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  const currentPresets = mediaType === "video" ? VIDEO_PRESETS : PRESET_PROMPTS;

  return (
    <PageLayout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]" />
        </div>
        <div className="container relative py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
                <Wand2 className="h-3 w-3" />
                AI Creative Studio
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Create{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Something Amazing
                </span>
              </h1>
              <p className="text-muted-foreground max-w-md">
                Describe your vision and let AI bring it to life — images, videos, and animations powered by 6 AI models.
              </p>
            </div>
            <div className="flex gap-2">
              {["/showcase/gallery-13.jpg", "/showcase/gallery-17.jpg", "/showcase/gallery-20.jpg"].map((img, i) => (
                <div key={i} className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70">
                  <img src={img} alt="AI generated showcase" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 md:py-10">

        {/* Mini Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Total", value: genStats.total, icon: Sparkles, color: "text-primary" },
            { label: "Completed", value: genStats.completed, icon: CheckCircle, color: "text-emerald-500" },
            { label: "Images", value: genStats.images, icon: Image, color: "text-blue-500" },
            { label: "Videos", value: genStats.videos, icon: Film, color: "text-fuchsia-500" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/50"
            >
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <div>
                <p className="text-lg font-bold leading-none">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Panel - Prompt Configuration */}
          <div className="lg:col-span-2 space-y-5">
            {/* Media Type Toggle */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <Tabs value={mediaType} onValueChange={(v) => handleMediaTypeChange(v as "image" | "video")}>
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="image" className="gap-2">
                      <Image className="h-4 w-4" />
                      Image
                    </TabsTrigger>
                    <TabsTrigger value="video" className="gap-2">
                      <Video className="h-4 w-4" />
                      Video Clip
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {mediaType === "video" && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Timer className="h-3 w-3" />
                        Duration: {duration}s
                      </Label>
                      <span className="text-[10px] text-muted-foreground">2-8 seconds</span>
                    </div>
                    <Slider
                      value={[duration]}
                      onValueChange={([v]) => setDuration(v)}
                      min={2}
                      max={8}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <Film className="h-3 w-3" />
                      Creates a {duration}-second animated video clip
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Selector - Always Visible */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Cpu className="h-3 w-3" />
                  Model
                </Label>
                <Select value={modelVersion} onValueChange={setModelVersion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredModels.map((m: any) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex items-center gap-2">
                          <span>{m.label}</span>
                          {m.badge && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-semibold">
                              {m.badge}
                            </span>
                          )}
                          {m.tier === "creator" && !m.badge && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold">
                              Pro
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">— {m.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Main Prompt Card */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Scene Description
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      mediaType === "video"
                        ? "Describe a motion scene... e.g., 'A phoenix rising from crystalline flames, cinematic slow motion, particle effects'"
                        : "Describe a fictional scene... e.g., 'A crystalline dragon perched atop a floating island surrounded by aurora borealis, digital art style'"
                    }
                    rows={6}
                    className="font-mono text-sm resize-none"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {prompt.length}/2000
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enhanceMutation.mutate({ prompt })}
                      disabled={!prompt.trim() || enhanceMutation.isPending}
                      className="text-xs gap-1.5 text-primary hover:text-primary"
                    >
                      {enhanceMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Zap className="h-3 w-3" />
                      )}
                      Enhance with AI
                    </Button>
                  </div>
                </div>

                {/* Preset Prompts */}
                <div>
                  <Label className="text-xs text-muted-foreground">
                    {mediaType === "video" ? "Video Presets" : "Quick Presets"}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {currentPresets.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => usePreset(p)}
                        className="text-[10px] px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
                        title={p}
                      >
                        {p.slice(0, 40)}...
                      </button>
                    ))}
                  </div>
                </div>

                {/* Negative Prompt */}
                <div>
                  <Label htmlFor="negative" className="text-sm">Negative Prompt</Label>
                  <Textarea
                    id="negative"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Elements to avoid..."
                    rows={2}
                    className="mt-1.5 font-mono text-sm resize-none"
                    maxLength={1000}
                  />
                </div>

                {/* Aspect Ratio Presets */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Aspect Ratio</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { label: "1:1", w: 1024, h: 1024, icon: "■" },
                      { label: "4:3", w: 1024, h: 768, icon: "▬" },
                      { label: "16:9", w: 1024, h: 576, icon: "▬▬" },
                      { label: "3:4", w: 768, h: 1024, icon: "▮" },
                      { label: "9:16", w: 576, h: 1024, icon: "▮▮" },
                    ].map((ar) => (
                      <button
                        key={ar.label}
                        onClick={() => { setAspectPreset(ar.label); setWidth(ar.w); setHeight(ar.h); }}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition-all ${
                          aspectPreset === ar.label ? "border-cyan-500 bg-cyan-500/10 text-cyan-400" : "border-border/50 text-muted-foreground hover:border-border"
                        }`}
                      >
                        <span>{ar.icon}</span>
                        <span>{ar.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced Settings
                  <span className="ml-auto text-[10px]">{showAdvanced ? "Hide" : "Show"}</span>
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-4"
                    >
                      {/* Seed Control */}
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          Seed
                          <span className="text-[10px]">(leave empty for random)</span>
                        </Label>
                        <div className="flex gap-2 mt-1.5">
                          <Input
                            type="number"
                            placeholder="Random"
                            value={seed}
                            onChange={(e) => setSeed(e.target.value)}
                            className="text-sm font-mono"
                          />
                          <Button variant="outline" size="sm" onClick={() => setSeed(String(Math.floor(Math.random() * 2147483647)))}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Style Reference */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Style Reference Image URL</Label>
                        <Input
                          placeholder="Paste a style reference image URL..."
                          value={styleRef}
                          onChange={(e) => setStyleRef(e.target.value)}
                          className="mt-1.5 text-sm"
                        />
                        {styleRef && (
                          <div className="mt-2 flex items-center gap-2">
                            <img loading="lazy" src={styleRef} alt="Style ref" className="h-12 w-12 rounded object-cover border border-border/50" />
                            <span className="text-[10px] text-muted-foreground">Style will be applied to generation</span>
                          </div>
                        )}
                      </div>

                      {/* Variation Strength */}
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>Variation Strength</span>
                          <span className="text-[10px] font-mono">{variationStrength}%</span>
                        </Label>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">Subtle</span>
                          <Slider
                            value={[variationStrength]}
                            onValueChange={([v]) => setVariationStrength(v)}
                            min={10}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <span className="text-[10px] text-muted-foreground">Strong</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Low = subtle tweaks. High = creative reimagination.</p>
                      </div>

                      {/* Creativity Level */}
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>Detail Creativity</span>
                          <span className="text-[10px] font-mono">{creativityLevel}%</span>
                        </Label>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">Faithful</span>
                          <Slider
                            value={[creativityLevel]}
                            onValueChange={([v]) => setCreativityLevel(v)}
                            min={0}
                            max={100}
                            step={5}
                            className="flex-1"
                          />
                          <span className="text-[10px] text-muted-foreground">Creative</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">How much new detail the AI invents (Magnific-style).</p>
                      </div>

                      {/* Dimensions */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm flex items-center gap-1.5">
                            <Maximize className="h-3 w-3" />
                            Width
                          </Label>
                          <Select value={String(width)} onValueChange={(v) => setWidth(Number(v))}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="512">512px</SelectItem>
                              <SelectItem value="576">576px</SelectItem>
                              <SelectItem value="768">768px</SelectItem>
                              <SelectItem value="1024">1024px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-sm flex items-center gap-1.5">
                            <Maximize className="h-3 w-3" />
                            Height
                          </Label>
                          <Select value={String(height)} onValueChange={(v) => setHeight(Number(v))}>
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="512">512px</SelectItem>
                              <SelectItem value="576">576px</SelectItem>
                              <SelectItem value="768">768px</SelectItem>
                              <SelectItem value="1024">1024px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tags */}
                {tags && tags.length > 0 && (
                  <div>
                    <Label className="text-sm">Research Tags</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                          className={`cursor-pointer transition-all text-xs ${
                            selectedTags.includes(tag.id)
                              ? "shadow-sm"
                              : "bg-transparent hover:bg-accent"
                          }`}
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generateMutation.isPending}
                  className="w-full font-medium h-12 text-base glow-primary"
                  size="lg"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating {mediaType === "video" ? "Video" : "Image"}...
                    </>
                  ) : (
                    <>
                      {mediaType === "video" ? (
                        <Video className="h-5 w-5 mr-2" />
                      ) : (
                        <Sparkles className="h-5 w-5 mr-2" />
                      )}
                      Generate {mediaType === "video" ? `${duration}s Video Clip` : "Image"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Generation History */}
          <div className="lg:col-span-3 space-y-4">
            {/* Generation In Progress Banner */}
            <AnimatePresence>
              {generateMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-sm p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 shrink-0">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                        {mediaType === "video" ? (
                          <Video className="h-4 w-4 text-primary" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-primary" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        Generating {mediaType === "video" ? "Video" : "Image"}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {prompt.slice(0, 80)}{prompt.length > 80 ? "..." : ""}
                      </p>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full animate-pulse" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Image className="h-4 w-4 text-primary" />
                    Generation History
                  </CardTitle>
                  {generations && generations.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {generations.length} items
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => refetchGens()} className="h-7 w-7 p-0">
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!generations || generations.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
                      <Image className="h-8 w-8 opacity-30" />
                    </div>
                    <p className="text-sm font-medium mb-1">No generations yet</p>
                    <p className="text-xs max-w-xs mx-auto">
                      Enter a prompt and generate your first synthetic output. Try one of the preset prompts to get started.
                    </p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {generations.map((gen) => (
                        <motion.div
                          key={gen.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group rounded-xl border border-border/50 overflow-hidden hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                        >
                          {/* Media Preview */}
                          <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
                            {gen.status === "completed" && gen.imageUrl ? (
                              <>
                                <img
                                  src={gen.imageUrl}
                                  alt="Synthetic output"
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                {gen.mediaType === "video" && (
                                  <div className="absolute top-2 left-2 video-badge px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Film className="h-3 w-3 text-white" />
                                    <span className="text-[10px] text-white font-medium">
                                      {gen.duration || 4}s
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : gen.status === "generating" || gen.status === "pending" ? (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                <div className="relative">
                                  <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    {gen.mediaType === "video" ? (
                                      <Video className="h-4 w-4 text-primary/60" />
                                    ) : (
                                      <Sparkles className="h-4 w-4 text-primary/60" />
                                    )}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <span className="text-xs text-muted-foreground capitalize block">{gen.status}...</span>
                                  <span className="text-[10px] text-muted-foreground/60">
                                    {gen.mediaType === "video" ? "Rendering video frames" : "Generating image"}
                                  </span>
                                </div>
                              </div>
                            ) : gen.status === "failed" ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-destructive gap-2">
                                <XCircle className="h-8 w-8" />
                                <span className="text-xs">Generation Failed</span>
                                {gen.errorMessage && (
                                  <span className="text-[10px] text-muted-foreground max-w-[200px] text-center">{gen.errorMessage}</span>
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Clock className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}

                            {/* Hover overlay */}
                            {gen.status === "completed" && gen.imageUrl && (
                              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSubmitGenId(gen.id);
                                    setSubmitDialogOpen(true);
                                  }}
                                  className="text-xs h-8 gap-1.5"
                                >
                                  <Send className="h-3 w-3" />
                                  Submit to Gallery
                                </Button>
                                {gen.mediaType === "image" && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setAnimateGenId(gen.id);
                                      setAnimateDialogOpen(true);
                                    }}
                                    className="text-xs h-8 gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-0"
                                  >
                                    <Play className="h-3 w-3" />
                                    Animate
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  asChild
                                  className="text-xs h-8 gap-1.5"
                                >
                                  <a href={gen.imageUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                    Open
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3 space-y-2">
                            <p className="text-xs text-foreground line-clamp-2 leading-relaxed">{gen.prompt}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(gen.createdAt).toLocaleDateString()}
                                </span>
                                {gen.mediaType === "video" && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-transparent border-fuchsia-500/30 text-fuchsia-400">
                                    <Film className="h-2.5 w-2.5 mr-0.5" />
                                    {gen.duration || 4}s Video
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {gen.status === "completed" && (
                                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                                )}
                                {gen.status === "generating" && (
                                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                )}
                                {gen.status === "failed" && (
                                  <XCircle className="h-3 w-3 text-destructive" />
                                )}
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  {gen.status}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground font-mono">
                                {gen.modelVersion}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {gen.width}x{gen.height}
                              </span>
                              {(gen as any).parentGenerationId && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-transparent border-cyan-500/30 text-cyan-400">
                                  <Link2 className="h-2.5 w-2.5 mr-0.5" />
                                  Animated
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit to Gallery Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Share to Gallery
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Your creation will be reviewed before appearing in the community gallery.
            </p>
            <div>
              <Label htmlFor="submit-title">Title</Label>
              <Input
                id="submit-title"
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                placeholder="Give your generation a descriptive title"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="submit-desc">Description (optional)</Label>
              <Textarea
                id="submit-desc"
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                placeholder="Describe the research context or artistic intent..."
                rows={3}
                className="mt-1.5"
              />
            </div>
            </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!submitGenId || !submitTitle.trim()) {
                  toast.error("Please enter a title");
                  return;
                }
                submitMutation.mutate({
                  generationId: submitGenId,
                  title: submitTitle.trim(),
                  description: submitDesc.trim() || undefined,
                });
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Animate Image Dialog */}
      <Dialog open={animateDialogOpen} onOpenChange={setAnimateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-fuchsia-500" />
              Animate Image to Video
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <p className="text-sm text-muted-foreground">
              Transform your static image into a short animated video clip. Choose a motion style and duration below.
            </p>

            {/* Source Image Preview */}
            {animateGenId && generations && (() => {
              const sourceGen = generations.find((g: any) => g.id === animateGenId);
              if (!sourceGen || !sourceGen.imageUrl) return null;
              return (
                <div className="relative rounded-lg overflow-hidden border border-border/50">
                  <img
                    src={sourceGen.imageUrl}
                    alt="Source image"
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <p className="text-xs text-white/80 line-clamp-1">{sourceGen.prompt}</p>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-primary/80 text-white text-[10px]">
                      <Image className="h-2.5 w-2.5 mr-1" />
                      Source Image
                    </Badge>
                  </div>
                </div>
              );
            })()}

            {/* Animation Style */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Motion Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "smooth-pan", label: "Smooth Pan", desc: "Gentle horizontal/vertical movement" },
                  { value: "gentle-zoom", label: "Gentle Zoom", desc: "Slow zoom in or out" },
                  { value: "parallax-drift", label: "Parallax Drift", desc: "Layered depth movement" },
                  { value: "cinematic-sweep", label: "Cinematic Sweep", desc: "Dramatic camera sweep" },
                  { value: "breathing-motion", label: "Breathing Motion", desc: "Subtle pulsing effect" },
                  { value: "particle-flow", label: "Particle Flow", desc: "Flowing particle overlay" },
                ].map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setAnimateStyle(style.value)}
                    className={`text-left p-3 rounded-lg border transition-all duration-200 ${
                      animateStyle === style.value
                        ? "border-fuchsia-500 bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-xs font-medium block">{style.label}</span>
                    <span className="text-[10px] text-muted-foreground">{style.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Duration</Label>
                <span className="text-sm font-mono text-fuchsia-400">{animateDuration}s</span>
              </div>
              <Slider
                value={[animateDuration]}
                onValueChange={([v]) => setAnimateDuration(v)}
                min={2}
                max={8}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">2s</span>
                <span className="text-[10px] text-muted-foreground">8s</span>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnimateDialogOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={handleAnimate}
              disabled={animateMutation.isPending}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
            >
              {animateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Animating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Animate to Video
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
