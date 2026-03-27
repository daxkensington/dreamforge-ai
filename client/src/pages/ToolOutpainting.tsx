import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Expand,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize2,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DIRECTIONS = [
  { value: "all", label: "All Sides", icon: Maximize2 },
  { value: "up", label: "Up", icon: ArrowUp },
  { value: "down", label: "Down", icon: ArrowDown },
  { value: "left", label: "Left", icon: ArrowLeft },
  { value: "right", label: "Right", icon: ArrowRight },
] as const;

const EXPANSION_SIZES = [
  { value: "small", label: "Small (25%)", description: "Subtle extension" },
  { value: "medium", label: "Medium (50%)", description: "Balanced expansion" },
  { value: "large", label: "Large (100%)", description: "Double the canvas" },
] as const;

export default function ToolOutpainting() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [direction, setDirection] = useState<"up" | "down" | "left" | "right" | "all">("all");
  const [expansionAmount, setExpansionAmount] = useState<"small" | "medium" | "large">("medium");
  const [fillDescription, setFillDescription] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const outpaintMutation = trpc.tools.outpaint.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Image expanded successfully!");
      } else {
        toast.error(data.error || "Expansion failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) { const { url } = await res.json(); setImageUrl(url); }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleProcess = () => {
    if (!imageUrl) { toast.error("Please provide an image"); return; }
    setResultUrl(null);
    outpaintMutation.mutate({
      imageUrl,
      direction,
      expansionAmount,
      fillDescription: fillDescription || undefined,
    });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null); setFillDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = outpaintMutation.isPending;

  return (
    <ToolPageLayout
      title="Image Expander"
      description="Extend images beyond their borders with AI outpainting"
      icon={Expand}
      gradient="from-sky-500 to-cyan-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/example-outpaint-1.jpg" alt="AI outpainting example" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Source Image</Label>
                <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Or Upload Image"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Expansion Direction</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {DIRECTIONS.map((d) => {
                      const Icon = d.icon;
                      return (
                        <button key={d.value} onClick={() => setDirection(d.value)}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all ${direction === d.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                          <Icon className="h-4 w-4" />
                          <span>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Expansion Size</Label>
                  <div className="space-y-2">
                    {EXPANSION_SIZES.map((s) => (
                      <button key={s.value} onClick={() => setExpansionAmount(s.value)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${expansionAmount === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <span className="font-medium">{s.label}</span>
                        <span className="text-xs opacity-70">{s.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Fill Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea placeholder="Describe what should fill the new area... (e.g., 'more forest and mountains')" value={fillDescription} onChange={(e) => setFillDescription(e.target.value)} rows={3} className="text-sm" />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleProcess} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Expanding...</> : <><Sparkles className="h-4 w-4 mr-2" />Expand Image</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-4">
                      <Expand className="h-8 w-8 text-sky-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload an image to extend it beyond its borders with AI outpainting.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img loading="lazy" src={imagePreview} alt="Original" className="w-full h-auto max-h-[350px] object-contain" />}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-sky-500/20 text-sky-400 border-sky-500/30">{resultUrl ? "Expanded" : "Result"}</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                                <p className="text-sm text-muted-foreground">Expanding image...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Expanded" className="w-full h-auto max-h-[350px] object-contain" />
                            ) : (
                              <motion.p key="empty" className="text-sm text-muted-foreground py-12">Result will appear here</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />Download Result
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
