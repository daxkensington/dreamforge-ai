import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Layers,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Play,
  ArrowRight,
  Image,
  Video,
  Zap,
  Download,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

interface PromptItem {
  id: string;
  prompt: string;
  mediaType: "image" | "video";
}

interface BatchResult {
  id: number;
  status: string;
  prompt: string;
  error?: string;
  imageUrl?: string | null;
}

const MODEL_OPTIONS = [
  { value: "built-in-v1", label: "Built-in Generator v1" },
  { value: "stable-diffusion-xl", label: "Stable Diffusion XL" },
  { value: "stable-diffusion-3", label: "Stable Diffusion 3" },
];

export default function BatchStudio() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [prompts, setPrompts] = useState<PromptItem[]>([
    { id: crypto.randomUUID(), prompt: "", mediaType: "image" },
  ]);
  const [modelVersion, setModelVersion] = useState("built-in-v1");
  const [width, setWidth] = useState(768);
  const [height, setHeight] = useState(768);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const batchMutation = trpc.generation.batchCreate.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setProcessing(false);
      setCurrentIndex(-1);
      toast.success(`Batch complete: ${data.completed}/${data.total} succeeded`);
    },
    onError: (err) => {
      setProcessing(false);
      setCurrentIndex(-1);
      toast.error(err.message);
    },
  });

  const addPrompt = () => {
    if (prompts.length >= 10) {
      toast.info("Maximum 10 prompts per batch");
      return;
    }
    setPrompts([...prompts, { id: crypto.randomUUID(), prompt: "", mediaType: "image" }]);
  };

  const removePrompt = (id: string) => {
    if (prompts.length <= 1) return;
    setPrompts(prompts.filter((p) => p.id !== id));
  };

  const updatePrompt = (id: string, field: keyof PromptItem, value: string) => {
    setPrompts(prompts.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const validPrompts = prompts.filter((p) => p.prompt.trim().length > 0);

  const handleGenerate = () => {
    if (validPrompts.length === 0) {
      toast.error("Add at least one prompt");
      return;
    }
    setProcessing(true);
    setResults([]);
    setCurrentIndex(0);

    batchMutation.mutate({
      prompts: validPrompts.map((p) => ({
        prompt: p.prompt,
        mediaType: p.mediaType,
        width,
        height,
        modelVersion,
      })),
    });
  };

  // Auth gate
  if (authLoading) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="max-w-md w-full bg-card/50 border-border/50">
            <CardContent className="pt-8 pb-8 text-center">
              <Layers className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Sign in to use Batch Studio</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Generate up to 10 images or videos at once with batch processing.
              </p>
              <Button onClick={() => (window.location.href = getLoginUrl())} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Sign in to Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 shadow-lg">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Batch Studio</h1>
              <Badge variant="secondary" className="text-xs">
                Up to 10 at once
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Queue multiple prompts and generate them all in one go. Perfect for exploring variations.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="hidden md:flex gap-2 bg-transparent">
            <Link href="/workspace">
              Single Mode
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Prompt Input */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Prompts ({prompts.length}/10)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addPrompt}
                    disabled={prompts.length >= 10 || processing}
                    className="gap-1.5 bg-transparent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Prompt
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnimatePresence>
                  {prompts.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative"
                    >
                      <div className="flex gap-3 items-start p-3 rounded-xl border border-border/50 bg-background/50">
                        <div className="flex flex-col items-center gap-2 pt-2">
                          <span className="text-xs font-bold text-muted-foreground w-6 h-6 flex items-center justify-center rounded-full bg-muted">
                            {index + 1}
                          </span>
                          {processing && currentIndex >= 0 && (
                            <div className="text-xs">
                              {results[index]?.status === "completed" ? (
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                              ) : results[index]?.status === "failed" ? (
                                <XCircle className="h-4 w-4 text-red-400" />
                              ) : index <= currentIndex ? (
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-border/50" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <Textarea
                            placeholder={`Prompt ${index + 1} — describe what you want to create...`}
                            value={item.prompt}
                            onChange={(e) => updatePrompt(item.id, "prompt", e.target.value)}
                            disabled={processing}
                            className="min-h-[60px] resize-none bg-transparent border-0 p-0 focus-visible:ring-0 text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updatePrompt(
                                  item.id,
                                  "mediaType",
                                  item.mediaType === "image" ? "video" : "image"
                                )
                              }
                              disabled={processing}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                item.mediaType === "image"
                                  ? "bg-violet-500/10 text-violet-400"
                                  : "bg-fuchsia-500/10 text-fuchsia-400"
                              }`}
                            >
                              {item.mediaType === "image" ? (
                                <Image className="h-3 w-3" />
                              ) : (
                                <Video className="h-3 w-3" />
                              )}
                              {item.mediaType === "image" ? "Image" : "Video"}
                            </button>
                          </div>
                        </div>
                        {prompts.length > 1 && !processing && (
                          <button
                            onClick={() => removePrompt(item.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Results Grid */}
            {results.length > 0 && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Results
                    <Badge variant="secondary" className="text-xs">
                      {results.filter((r) => r.status === "completed").length}/{results.length} completed
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {results.map((result, i) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative group rounded-xl overflow-hidden border border-border/50 bg-background/50"
                      >
                        {result.status === "completed" && result.imageUrl ? (
                          <>
                            <div className="aspect-square">
                              <img
                                src={result.imageUrl}
                                alt={result.prompt}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute bottom-0 left-0 right-0 p-3">
                                <p className="text-xs text-white/80 line-clamp-2 mb-2">{result.prompt}</p>
                                <div className="flex gap-2">
                                  <a
                                    href={result.imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Open
                                  </a>
                                  <a
                                    href={result.imageUrl}
                                    download={`dreamforge-batch-${result.id}.png`}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
                                  >
                                    <Download className="h-3 w-3" />
                                    Save
                                  </a>
                                </div>
                              </div>
                            </div>
                            <div className="absolute top-2 right-2">
                              <CheckCircle className="h-5 w-5 text-emerald-400 drop-shadow-lg" />
                            </div>
                          </>
                        ) : (
                          <div className="aspect-square flex flex-col items-center justify-center p-4 text-center">
                            <XCircle className="h-8 w-8 text-red-400 mb-2" />
                            <p className="text-xs text-muted-foreground line-clamp-2">{result.prompt}</p>
                            {result.error && (
                              <p className="text-[10px] text-red-400 mt-1 line-clamp-1">{result.error}</p>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Settings */}
          <div className="space-y-4">
            <Card className="bg-card/50 border-border/50 sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Batch Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Model */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <Select value={modelVersion} onValueChange={setModelVersion} disabled={processing}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Resolution */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Resolution</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { w: 512, h: 512, label: "512²" },
                      { w: 768, h: 768, label: "768²" },
                      { w: 1024, h: 1024, label: "1024²" },
                    ].map((res) => (
                      <button
                        key={res.label}
                        onClick={() => {
                          setWidth(res.w);
                          setHeight(res.h);
                        }}
                        disabled={processing}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          width === res.w && height === res.h
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-muted/30 text-muted-foreground border border-border/50 hover:bg-muted/50"
                        }`}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Valid prompts</span>
                    <span className="font-medium">{validPrompts.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Images</span>
                    <span className="font-medium">
                      {validPrompts.filter((p) => p.mediaType === "image").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Videos</span>
                    <span className="font-medium">
                      {validPrompts.filter((p) => p.mediaType === "video").length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Est. time</span>
                    <span className="font-medium">~{validPrompts.length * 10}s</span>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={validPrompts.length === 0 || processing}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white border-0"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing Batch...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Generate All ({validPrompts.length})
                    </>
                  )}
                </Button>

                {processing && (
                  <div className="space-y-2">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                        style={{
                          width: `${results.length > 0 ? (results.length / validPrompts.length) * 100 : 5}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {results.length}/{validPrompts.length} completed
                    </p>
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
