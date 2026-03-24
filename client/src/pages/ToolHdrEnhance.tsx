import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sun, Upload, Loader2, Download, ArrowRight, Sparkles, RotateCcw } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const effects = [
  { value: "hdr", label: "HDR", desc: "Full dynamic range" },
  { value: "golden-hour", label: "Golden Hour", desc: "Warm sunset tones" },
  { value: "blue-hour", label: "Blue Hour", desc: "Twilight blues" },
  { value: "dramatic", label: "Dramatic", desc: "Deep contrast" },
  { value: "soft-light", label: "Soft Light", desc: "Gentle diffused" },
  { value: "backlit", label: "Backlit", desc: "Rim glow" },
  { value: "neon-night", label: "Neon Night", desc: "Cyberpunk neons" },
  { value: "foggy", label: "Foggy", desc: "Atmospheric haze" },
  { value: "harsh-sun", label: "Harsh Sun", desc: "Midday vivid" },
  { value: "studio", label: "Studio", desc: "Pro lighting" },
];

export default function ToolHdrEnhance() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [effect, setEffect] = useState("hdr");
  const [intensity, setIntensity] = useState(0.7);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.hdrEnhance.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Enhancement applied!"); }
      else toast.error(data.error || "Failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="HDR & Lighting Enhancer" description="Transform lighting and enhance dynamic range" icon={Sun} gradient="from-yellow-500 to-orange-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Source Image</Label>
                  <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Upload Image"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Lighting Effect</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {effects.map((e) => (
                      <button key={e.value} onClick={() => setEffect(e.value)}
                        className={`p-2.5 rounded-xl border-2 transition-all text-left ${effect === e.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{e.label}</span>
                        <p className="text-[10px] text-muted-foreground">{e.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Intensity</Label>
                    <Badge variant="secondary">{intensity <= 0.3 ? "Subtle" : intensity <= 0.7 ? "Moderate" : "Strong"}</Badge>
                  </div>
                  <Slider value={[intensity]} onValueChange={([v]) => setIntensity(v)} min={0.1} max={1.0} step={0.1} />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ imageUrl, effect: effect as any, intensity }); }}
                    disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enhancing...</> : <><Sparkles className="h-4 w-4 mr-2" />Enhance Lighting</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setImageUrl(""); setImagePreview(null); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4"><Sun className="h-8 w-8 text-yellow-400" /></div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload an image to transform its lighting.</p>
                  </div>
                ) : (
                  <div>
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                        <p className="text-sm text-muted-foreground">Enhancing lighting...</p>
                      </div>
                    ) : imagePreview && resultUrl ? (
                      <BeforeAfterSlider
                        before={imagePreview}
                        after={resultUrl}
                        beforeLabel="Original"
                        afterLabel="Enhanced"
                        height={450}
                        accentColor="amber"
                      />
                    ) : (
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img src={imagePreview} alt="Original" className="w-full h-auto max-h-[300px] object-contain" />}
                        </div>
                        <div className="flex flex-col items-center gap-2 py-12">
                          <ArrowRight className="h-6 w-6 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">Select an effect and enhance</p>
                        </div>
                      </div>
                    )}
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
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
