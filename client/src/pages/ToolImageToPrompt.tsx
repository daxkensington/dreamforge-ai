import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ScanSearch,
  Upload,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Wand2,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";

interface AnalysisResult {
  prompt: string;
  negativePrompt: string;
  tags: string[];
  analysis: {
    subject: string;
    style: string;
    mood: string;
    lighting: string;
    composition: string;
    colorPalette: string;
    technicalDetails: string;
  };
  status: string;
}

export default function ToolImageToPrompt() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const analyzeMutation = trpc.tools.analyzeImage.useMutation({
    onSuccess: (data: AnalysisResult & { status: string }) => {
      if (data.status === "completed" || data.status === "fallback") {
        setResult(data);
        toast.success("Image analyzed successfully!");
      }
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setImageUrl(url);
      } else {
        toast.info("Using local preview — enter an image URL for best results");
      }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleAnalyze = () => {
    if (!imageUrl) { toast.error("Please provide an image URL"); return; }
    setResult(null);
    analyzeMutation.mutate({ imageUrl });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const useInStudio = () => {
    if (result?.prompt) {
      navigate(`/workspace?prompt=${encodeURIComponent(result.prompt)}`);
    }
  };

  const isProcessing = analyzeMutation.isPending;

  return (
    <ToolPageLayout
      title="Image to Prompt"
      description="Reverse-engineer any image into a detailed generation prompt"
      icon={ScanSearch}
      gradient="from-cyan-500 to-yellow-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Source Image</Label>
                  <Input
                    placeholder="Paste image URL..."
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }}
                    className="text-sm"
                  />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Or Upload Image"}
                  </Button>
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img loading="lazy" src={imagePreview} alt="Source" className="w-full h-auto max-h-[250px] object-contain bg-muted/30" />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleAnalyze} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Analyze Image</>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-6">
            <AnimatePresence mode="wait">
              {!result && !isProcessing ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
                        <ScanSearch className="h-8 w-8 text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Upload any image and AI will reverse-engineer a detailed prompt you can use to recreate or remix it.</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : isProcessing ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center h-[500px] p-8">
                      <Loader2 className="h-10 w-10 animate-spin text-cyan-400 mb-4" />
                      <p className="text-muted-foreground">AI is analyzing your image...</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Generated Prompt */}
                  <Card className="border-border/50 border-cyan-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Wand2 className="h-4 w-4 text-cyan-400" /> Generated Prompt
                        </h3>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => copyText(result.prompt, "prompt")}>
                            {copiedField === "prompt" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                            Copy
                          </Button>
                          <Button size="sm" onClick={useInStudio} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30">
                            <ArrowRight className="h-3 w-3 mr-1" /> Use in Studio
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-sm leading-relaxed">{result.prompt}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Negative Prompt */}
                  {result.negativePrompt && (
                    <Card className="border-border/50">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-sm">Negative Prompt</h3>
                          <Button variant="ghost" size="sm" onClick={() => copyText(result.negativePrompt, "negative")}>
                            {copiedField === "negative" ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                            Copy
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{result.negativePrompt}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Tags */}
                  {result.tags.length > 0 && (
                    <Card className="border-border/50">
                      <CardContent className="p-6">
                        <h3 className="font-semibold text-sm mb-3">Detected Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.tags.map((tag, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.03 }}
                            >
                              <Badge
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => copyText(tag, `tag-${i}`)}
                              >
                                {tag}
                              </Badge>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Analysis */}
                  <Card className="border-border/50">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-sm mb-4">Detailed Analysis</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {Object.entries(result.analysis).map(([key, value], i) => (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-3 rounded-lg bg-muted/30 border border-border/50"
                          >
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </p>
                            <p className="text-sm">{value}</p>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
