import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Pipette,
  Upload,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Minus,
  Plus,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PaletteResult {
  colors: Array<{ hex: string; name: string; percentage: number }>;
  mood: string;
  complementary: Array<{ hex: string; name: string }>;
  harmonies: {
    analogous: string[];
    triadic: string[];
    splitComplementary: string[];
  };
  status: string;
}

export default function ToolColorPalette() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState(6);
  const [includeComplementary, setIncludeComplementary] = useState(true);
  const [result, setResult] = useState<PaletteResult | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractMutation = trpc.tools.extractPalette.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" || data.status === "fallback") {
        setResult(data as PaletteResult);
        toast.success("Color palette extracted!");
      }
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

  const handleExtract = () => {
    if (!imageUrl) { toast.error("Please provide an image URL or upload an image"); return; }
    setResult(null);
    extractMutation.mutate({ imageUrl, paletteSize, includeComplementary });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    toast.success(`Copied ${hex}`);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const copyAllColors = () => {
    if (!result) return;
    const text = result.colors.map(c => `${c.hex} - ${c.name} (${c.percentage}%)`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("All colors copied!");
  };

  const isProcessing = extractMutation.isPending;

  return (
    <ToolPageLayout
      title="Color Palette Extractor"
      description="Extract dominant colors and discover harmonious palettes from any image"
      icon={Pipette}
      gradient="from-pink-500 to-rose-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
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

                {/* Palette Size */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Palette Size</Label>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPaletteSize(Math.max(3, paletteSize - 1))} disabled={paletteSize <= 3}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-2xl font-bold w-8 text-center">{paletteSize}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPaletteSize(Math.min(10, paletteSize + 1))} disabled={paletteSize >= 10}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">colors</span>
                  </div>
                </div>

                {/* Include Complementary */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Complementary Colors</Label>
                    <p className="text-xs text-muted-foreground">Include suggested complementary palette</p>
                  </div>
                  <Switch checked={includeComplementary} onCheckedChange={setIncludeComplementary} />
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img loading="lazy" src={imagePreview} alt="Source" className="w-full h-auto max-h-[200px] object-contain bg-muted/30" />
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleExtract} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Extract Palette</>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-6">
            <AnimatePresence mode="wait">
              {!result && !isProcessing ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4">
                        <Pipette className="h-8 w-8 text-pink-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No Palette Yet</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Upload an image to extract its dominant color palette with AI analysis.</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : isProcessing ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card className="border-border/50">
                    <CardContent className="flex flex-col items-center justify-center h-[500px] p-8">
                      <Loader2 className="h-10 w-10 animate-spin text-pink-400 mb-4" />
                      <p className="text-muted-foreground">AI is analyzing your image colors...</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : result ? (
                <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Dominant Colors */}
                  <Card className="border-border/50">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Dominant Colors</h3>
                        <Button variant="ghost" size="sm" onClick={copyAllColors}>
                          <Copy className="h-3 w-3 mr-1" /> Copy All
                        </Button>
                      </div>

                      {/* Color Strip */}
                      <div className="flex rounded-xl overflow-hidden h-16 mb-4">
                        {result.colors.map((color, i) => (
                          <motion.div
                            key={i}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className="cursor-pointer relative group/swatch"
                            style={{ backgroundColor: color.hex, flex: color.percentage }}
                            onClick={() => copyHex(color.hex)}
                            title={`${color.name} - ${color.hex}`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/swatch:opacity-100 transition-opacity bg-black/30">
                              {copiedHex === color.hex ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4 text-white" />}
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Color Swatches */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {result.colors.map((color, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => copyHex(color.hex)}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-all text-left group/item"
                          >
                            <div className="h-10 w-10 rounded-lg shrink-0 shadow-sm border border-white/10" style={{ backgroundColor: color.hex }} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{color.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{color.hex}</p>
                              <p className="text-[10px] text-muted-foreground">{color.percentage}%</p>
                            </div>
                            {copiedHex === color.hex ? (
                              <Check className="h-3 w-3 text-green-400 ml-auto shrink-0" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                            )}
                          </motion.button>
                        ))}
                      </div>

                      {/* Mood */}
                      <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Mood</p>
                        <p className="text-sm">{result.mood}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Complementary Colors */}
                  {result.complementary.length > 0 && (
                    <Card className="border-border/50">
                      <CardContent className="p-6">
                        <h3 className="font-semibold mb-4">Complementary Colors</h3>
                        <div className="flex gap-3 flex-wrap">
                          {result.complementary.map((color, i) => (
                            <motion.button
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              onClick={() => copyHex(color.hex)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 hover:border-primary/30 transition-all"
                            >
                              <div className="h-6 w-6 rounded-md shadow-sm border border-white/10" style={{ backgroundColor: color.hex }} />
                              <span className="text-xs font-mono">{color.hex}</span>
                              <span className="text-xs text-muted-foreground">{color.name}</span>
                            </motion.button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Color Harmonies */}
                  <Card className="border-border/50">
                    <CardContent className="p-6">
                      <h3 className="font-semibold mb-4">Color Harmonies</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(["analogous", "triadic", "splitComplementary"] as const).map((harmony) => (
                          <div key={harmony} className="space-y-2">
                            <p className="text-xs font-medium capitalize text-muted-foreground">
                              {harmony === "splitComplementary" ? "Split Complementary" : harmony}
                            </p>
                            <div className="flex rounded-lg overflow-hidden h-10">
                              {result.harmonies[harmony].map((hex, i) => (
                                <div
                                  key={i}
                                  className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                                  style={{ backgroundColor: hex }}
                                  onClick={() => copyHex(hex)}
                                  title={hex}
                                />
                              ))}
                            </div>
                            <div className="flex gap-1">
                              {result.harmonies[harmony].map((hex, i) => (
                                <span key={i} className="text-[10px] font-mono text-muted-foreground flex-1 text-center">{hex}</span>
                              ))}
                            </div>
                          </div>
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
