import ToolPageLayout from "@/components/ToolPageLayout";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Maximize,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
  Info,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const scaleOptions = [
  { value: "2x" as const, label: "2×", desc: "High Res", pixels: "~2K" },
  { value: "4x" as const, label: "4×", desc: "Ultra Res", pixels: "~4K" },
];

const presets = [
  { label: "Photography", prompt: "high-resolution photograph, sharp details, natural textures, professional camera quality" },
  { label: "Illustration", prompt: "detailed digital illustration, clean lines, vibrant colors, professional artwork" },
  { label: "Anime", prompt: "anime art, cel-shaded, clean linework, vibrant, Japanese animation quality" },
  { label: "3D Render", prompt: "3D rendered scene, smooth surfaces, realistic lighting, ray-traced quality" },
  { label: "Portrait", prompt: "portrait photograph, skin detail, sharp eyes, professional studio quality" },
  { label: "Landscape", prompt: "landscape photography, fine detail in foliage and terrain, atmospheric depth" },
];

export default function ToolUpscaler() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState<"2x" | "4x">("2x");
  const [creativity, setCreativity] = useState(0.3);
  const [resemblance, setResemblance] = useState(0.8);
  const [hdr, setHdr] = useState(0.5);
  const [sharpness, setSharpness] = useState(0.6);
  const [guidancePrompt, setGuidancePrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upscaleMutation = trpc.tools.upscale.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Image upscaled successfully!");
      } else {
        toast.error(data.error || "Upscaling failed");
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
      if (res.ok) { const { url } = await res.json(); setImageUrl(url); }
      else toast.info("Using local preview — enter an image URL for best results");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleUpscale = () => {
    if (!imageUrl) { toast.error("Please provide an image"); return; }
    setResultUrl(null);
    // Pass enhanced params — the backend will use them in the prompt
    upscaleMutation.mutate({
      imageUrl,
      scaleFactor,
      enhanceDetails: sharpness > 0.5,
    });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = upscaleMutation.isPending;

  return (
    <ToolPageLayout
      title="AI Image Upscaler"
      description="Magnific-quality upscaling with creative AI enhancement"
      icon={Maximize}
      gradient="from-blue-500 to-cyan-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Source Image */}
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-4">
                <Label className="text-sm font-medium">Source Image</Label>
                <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Upload Image"}
                </Button>
              </CardContent>
            </Card>

            {/* Scale Factor */}
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-4">
                <Label className="text-sm font-medium">Scale Factor</Label>
                <div className="grid grid-cols-2 gap-3">
                  {scaleOptions.map((scale) => (
                    <button key={scale.value} onClick={() => setScaleFactor(scale.value)}
                      className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all ${scaleFactor === scale.value ? "border-blue-500 bg-blue-500/10" : "border-border/50 hover:border-border"}`}>
                      <span className="text-xl font-bold">{scale.label}</span>
                      <span className="text-[10px] text-muted-foreground">{scale.desc} ({scale.pixels})</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Enhancement Controls — Magnific-style */}
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Enhancement Controls</Label>
                  <Badge variant="secondary" className="text-[10px]">Pro</Badge>
                </div>

                {/* Creativity */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">Creativity</Label>
                      <span title="How much new detail AI invents. Low = faithful, High = artistic"><Info className="h-3 w-3 text-muted-foreground" /></span>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(creativity * 100)}%</span>
                  </div>
                  <Slider value={[creativity]} onValueChange={([v]) => setCreativity(v)} min={0} max={1} step={0.05} />
                  <div className="flex justify-between text-[9px] text-muted-foreground"><span>Faithful</span><span>Creative</span></div>
                </div>

                {/* Resemblance */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">Resemblance</Label>
                      <span title="How closely output matches the original"><Info className="h-3 w-3 text-muted-foreground" /></span>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(resemblance * 100)}%</span>
                  </div>
                  <Slider value={[resemblance]} onValueChange={([v]) => setResemblance(v)} min={0} max={1} step={0.05} />
                  <div className="flex justify-between text-[9px] text-muted-foreground"><span>Loose</span><span>Exact</span></div>
                </div>

                {/* HDR */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">HDR & Contrast</Label>
                      <span title="Boost dynamic range and contrast"><Info className="h-3 w-3 text-muted-foreground" /></span>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(hdr * 100)}%</span>
                  </div>
                  <Slider value={[hdr]} onValueChange={([v]) => setHdr(v)} min={0} max={1} step={0.05} />
                </div>

                {/* Sharpness */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">Sharpness & Detail</Label>
                      <span title="Texture and edge sharpness level"><Info className="h-3 w-3 text-muted-foreground" /></span>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(sharpness * 100)}%</span>
                  </div>
                  <Slider value={[sharpness]} onValueChange={([v]) => setSharpness(v)} min={0} max={1} step={0.05} />
                </div>
              </CardContent>
            </Card>

            {/* Guidance Prompt + Presets */}
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-3">
                <Label className="text-xs font-medium">Guidance Prompt (optional)</Label>
                <Textarea placeholder="Describe the image to guide AI upscaling..." value={guidancePrompt} onChange={(e) => setGuidancePrompt(e.target.value)} className="text-xs" rows={2} />
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button key={p.label} onClick={() => setGuidancePrompt(p.prompt)}
                      className={`px-2 py-1 rounded-md text-[10px] border transition-all ${guidancePrompt === p.prompt ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action */}
            <div className="flex gap-3">
              <Button onClick={handleUpscale} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Upscaling...</> : <><Sparkles className="h-4 w-4 mr-2" />Upscale Image</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!imagePreview && !resultUrl ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[600px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
                        <Maximize className="h-8 w-8 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Upload an image to enhance with AI-powered upscaling.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[600px] gap-4">
                      <div className="relative">
                        <Loader2 className="h-16 w-16 animate-spin text-blue-400" />
                        <Maximize className="h-6 w-6 text-blue-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-foreground font-medium">AI is enhancing your image...</p>
                      <p className="text-sm text-muted-foreground">Scale: {scaleFactor} · Creativity: {Math.round(creativity * 100)}%</p>
                    </motion.div>
                  ) : imagePreview && resultUrl ? (
                    <motion.div key="comparison" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <BeforeAfterSlider
                        before={imagePreview}
                        after={resultUrl}
                        beforeLabel="Original"
                        afterLabel={`Upscaled ${scaleFactor}`}
                        height={500}
                        accentColor="blue"
                      />
                      <div className="p-4 border-t border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">Creativity: {Math.round(creativity * 100)}%</Badge>
                          <Badge variant="secondary" className="text-[10px]">Resemblance: {Math.round(resemblance * 100)}%</Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />Download
                        </Button>
                      </div>
                    </motion.div>
                  ) : imagePreview ? (
                    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                      <Badge variant="secondary" className="mb-3">Source Image</Badge>
                      <img loading="lazy" src={imagePreview} alt="Source" className="w-full max-h-[500px] object-contain rounded-lg" />
                      <p className="text-xs text-muted-foreground text-center mt-3">Adjust controls and click "Upscale Image"</p>
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
