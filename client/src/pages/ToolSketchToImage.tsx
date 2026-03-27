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
  PenTool,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const OUTPUT_STYLES = [
  { value: "photorealistic", label: "Photorealistic", description: "Lifelike photo quality" },
  { value: "digital-art", label: "Digital Art", description: "Polished digital illustration" },
  { value: "anime", label: "Anime", description: "Japanese animation style" },
  { value: "oil-painting", label: "Oil Painting", description: "Classical painting look" },
  { value: "watercolor", label: "Watercolor", description: "Soft watercolor aesthetic" },
  { value: "3d-render", label: "3D Render", description: "Clean 3D rendered output" },
] as const;

const FIDELITY_LEVELS = [
  { value: "low", label: "Creative", description: "Loose interpretation, more AI creativity" },
  { value: "medium", label: "Balanced", description: "Follows sketch structure with artistic freedom" },
  { value: "high", label: "Faithful", description: "Closely follows the sketch layout" },
] as const;

export default function ToolSketchToImage() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [outputStyle, setOutputStyle] = useState<string>("digital-art");
  const [fidelity, setFidelity] = useState<"low" | "medium" | "high">("medium");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sketchMutation = trpc.tools.sketchToImage.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Sketch transformed successfully!");
      } else {
        toast.error(data.error || "Transformation failed");
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
    if (!imageUrl) { toast.error("Please provide a sketch"); return; }
    setResultUrl(null);
    sketchMutation.mutate({
      imageUrl,
      description: description || "",
      outputStyle: outputStyle as any,
      detailLevel: fidelity,
    });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null); setDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = sketchMutation.isPending;

  return (
    <ToolPageLayout
      title="Sketch to Image"
      description="Transform rough sketches and drawings into polished images"
      icon={PenTool}
      gradient="from-teal-500 to-emerald-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Your Sketch</Label>
                <Input placeholder="Paste sketch image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Upload Sketch"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea placeholder="Describe what the sketch represents... (e.g., 'a cozy cabin in a snowy forest')" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-sm" />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Output Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {OUTPUT_STYLES.map((s) => (
                      <button key={s.value} onClick={() => setOutputStyle(s.value)}
                        className={`flex flex-col items-start p-3 rounded-lg border text-sm transition-all ${outputStyle === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <span className="font-medium">{s.label}</span>
                        <span className="text-xs opacity-70">{s.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Sketch Fidelity</Label>
                  <div className="space-y-2">
                    {FIDELITY_LEVELS.map((f) => (
                      <button key={f.value} onClick={() => setFidelity(f.value)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${fidelity === f.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <span className="font-medium">{f.label}</span>
                        <span className="text-xs opacity-70">{f.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleProcess} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Transforming...</> : <><Sparkles className="h-4 w-4 mr-2" />Transform Sketch</>}
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
                    <div className="h-16 w-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4">
                      <PenTool className="h-8 w-8 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Upload Your Sketch</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload a rough sketch, doodle, or wireframe and watch AI transform it into a polished image.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Sketch</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img loading="lazy" src={imagePreview} alt="Sketch" className="w-full h-auto max-h-[350px] object-contain" />}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-teal-500/20 text-teal-400 border-teal-500/30">{resultUrl ? "Transformed" : "Result"}</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                                <p className="text-sm text-muted-foreground">Transforming sketch...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Transformed" className="w-full h-auto max-h-[350px] object-contain" />
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
                          <Download className="h-4 w-4 mr-2" />Download
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
