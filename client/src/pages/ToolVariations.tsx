import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Layers,
  Upload,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  Minus,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const variationTypes = [
  { id: "subtle" as const, label: "Subtle", description: "Minor tweaks to color and lighting", color: "text-blue-400" },
  { id: "moderate" as const, label: "Moderate", description: "Noticeable style and mood changes", color: "text-violet-400" },
  { id: "dramatic" as const, label: "Dramatic", description: "Bold reinterpretations of the image", color: "text-orange-400" },
  { id: "style-mix" as const, label: "Style Mix", description: "Reimagined in different art styles", color: "text-emerald-400" },
];

export default function ToolVariations() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [count, setCount] = useState(4);
  const [variationType, setVariationType] = useState<"subtle" | "moderate" | "dramatic" | "style-mix">("moderate");
  const [results, setResults] = useState<Array<{ url: string | null; variation: string; status: string }> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variationsMutation = trpc.tools.generateVariations.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      toast.success(`Generated ${data.completed}/${data.total} variations`);
    },
    onError: (err) => toast.error(err.message),
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

  const handleGenerate = () => {
    if (!imageUrl) { toast.error("Please provide an image URL or upload an image"); return; }
    setResults(null);
    variationsMutation.mutate({ imageUrl, count, variationType });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = variationsMutation.isPending;

  return (
    <ToolPageLayout
      title="Image Variations"
      description="Generate multiple creative variations of any image"
      icon={Layers}
      gradient="from-indigo-500 to-purple-400"
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

                {/* Preview */}
                {imagePreview && (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img src={imagePreview} alt="Source" className="w-full h-auto max-h-[180px] object-contain bg-muted/30" />
                  </div>
                )}

                {/* Variation Count */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Number of Variations</Label>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCount(Math.max(2, count - 1))} disabled={count <= 2}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-2xl font-bold w-8 text-center">{count}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCount(Math.min(6, count + 1))} disabled={count >= 6}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Variation Type */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Variation Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {variationTypes.map((vt) => (
                      <button
                        key={vt.id}
                        onClick={() => setVariationType(vt.id)}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                          variationType === vt.id
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <p className={`text-sm font-semibold ${vt.color}`}>{vt.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{vt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleGenerate} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating {count} Variations...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Generate Variations</>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <AnimatePresence mode="wait">
              {!results && !isProcessing ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                        <Layers className="h-8 w-8 text-indigo-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No Variations Yet</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Upload an image and choose a variation style to generate creative alternatives.</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : isProcessing ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center h-[500px] p-8">
                      <Loader2 className="h-10 w-10 animate-spin text-indigo-400 mb-4" />
                      <p className="text-muted-foreground mb-2">Generating {count} variations...</p>
                      <p className="text-xs text-muted-foreground">This may take a moment for multiple images</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : results ? (
                <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Variations</h3>
                        <Badge variant="secondary">
                          {results.filter(r => r.status === "completed").length}/{results.length} generated
                        </Badge>
                      </div>

                      <div className={`grid gap-4 ${results.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                        {results.map((r, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="group relative rounded-xl overflow-hidden border border-border/50"
                          >
                            {r.status === "completed" && r.url ? (
                              <>
                                <img src={r.url} alt={`Variation ${i + 1}`} className="w-full aspect-square object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="absolute bottom-0 left-0 right-0 p-3">
                                    <p className="text-xs text-white/80 mb-2 line-clamp-2">{r.variation}</p>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="w-full text-xs"
                                      onClick={() => window.open(r.url!, "_blank")}
                                    >
                                      <Download className="h-3 w-3 mr-1" /> Download
                                    </Button>
                                  </div>
                                </div>
                                <div className="absolute top-2 right-2">
                                  <CheckCircle2 className="h-5 w-5 text-green-400 drop-shadow-lg" />
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center aspect-square bg-muted/30 p-4">
                                <XCircle className="h-6 w-6 text-red-400 mb-2" />
                                <p className="text-xs text-muted-foreground text-center">Failed</p>
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                            </div>
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
