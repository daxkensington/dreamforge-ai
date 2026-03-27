import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Grid3X3, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { value: "wood", label: "Wood" }, { value: "stone", label: "Stone" }, { value: "metal", label: "Metal" },
  { value: "fabric", label: "Fabric" }, { value: "organic", label: "Organic" }, { value: "sci-fi", label: "Sci-Fi" },
  { value: "abstract", label: "Abstract" }, { value: "brick", label: "Brick" }, { value: "concrete", label: "Concrete" },
  { value: "water", label: "Water" }, { value: "custom", label: "Custom" },
];

const styles = [
  { value: "photorealistic", label: "Photorealistic" }, { value: "stylized", label: "Stylized" },
  { value: "hand-painted", label: "Hand-Painted" }, { value: "pixel-art", label: "Pixel Art" },
  { value: "pbr", label: "PBR-Ready" },
];

export default function ToolTexture() {
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("custom");
  const [style, setStyle] = useState("photorealistic");
  const [tiling, setTiling] = useState(true);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.textureGen.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Texture generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Texture Generator" description="Create seamless tileable textures for 3D and design" icon={Grid3X3} gradient="from-lime-500 to-green-400">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/tool-texture.jpg" alt="AI texture generation" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Describe Your Texture</Label>
                  <Textarea placeholder="Weathered oak planks with visible grain, warm honey tones..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-sm" rows={3} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Category</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button key={c.value} onClick={() => setCategory(c.value)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${category === c.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Style</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {styles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Seamless Tiling</Label>
                    <p className="text-xs text-muted-foreground">Repeats perfectly in all directions</p>
                  </div>
                  <Switch checked={tiling} onCheckedChange={setTiling} />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ prompt, category: category as any, style: style as any, tiling }); }}
                    disabled={!prompt.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Texture</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setPrompt(""); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!resultUrl && !isProcessing ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-lime-500/10 flex items-center justify-center mb-4"><Grid3X3 className="h-8 w-8 text-lime-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Texture Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe a texture to generate seamless, tileable materials.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-lime-400" /><p className="text-muted-foreground">Creating texture...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Single Tile</p>
                            <img loading="lazy" src={resultUrl} alt="Texture" className="w-full rounded-lg" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">2×2 Tiled Preview</p>
                            <div className="grid grid-cols-2 rounded-lg overflow-hidden">
                              <img loading="lazy" src={resultUrl} alt="Tile" className="w-full" />
                              <img loading="lazy" src={resultUrl} alt="Tile" className="w-full" />
                              <img loading="lazy" src={resultUrl} alt="Tile" className="w-full" />
                              <img loading="lazy" src={resultUrl} alt="Tile" className="w-full" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
