import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Film,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EFFECTS = [
  { value: "35mm-grain", label: "35mm Grain", desc: "Classic film grain texture" },
  { value: "vintage-kodak", label: "Vintage Kodak", desc: "Warm Kodak film tones" },
  { value: "polaroid", label: "Polaroid", desc: "Instant camera look" },
  { value: "vhs", label: "VHS", desc: "Retro video tape distortion" },
  { value: "infrared", label: "Infrared", desc: "IR photography effect" },
  { value: "cross-process", label: "Cross Process", desc: "Color shift experiment" },
  { value: "bleach-bypass", label: "Bleach Bypass", desc: "Desaturated high contrast" },
  { value: "lomo", label: "Lomo", desc: "Vibrant lomography" },
  { value: "daguerreotype", label: "Daguerreotype", desc: "Early photography look" },
  { value: "cyanotype", label: "Cyanotype", desc: "Blueprint blue tones" },
] as const;

type EffectValue = typeof EFFECTS[number]["value"];

export default function ToolFilmGrain() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [effect, setEffect] = useState<EffectValue>("35mm-grain");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.filmGrain.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Film effect applied!");
      } else {
        toast.error(data.error || "Effect application failed");
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

  const handleApply = () => {
    if (!imageUrl) { toast.error("Please provide an image"); return; }
    setResultUrl(null);
    mutation.mutate({ imageUrl, effect: effect as any });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = mutation.isPending;
  const activeEffect = EFFECTS.find((e) => e.value === effect);

  return (
    <ToolPageLayout
      title="Film Grain & Effects"
      description="Apply authentic film grain and analog photography effects"
      icon={Film}
      gradient="from-amber-600 to-yellow-500"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Input */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
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
              </CardContent>
            </Card>

            {/* Effect Selection */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Film Effect</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                  {EFFECTS.map((fx) => (
                    <button
                      key={fx.value}
                      onClick={() => { setEffect(fx.value); setResultUrl(null); }}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 text-left text-sm transition-all ${
                        effect === fx.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <span className="font-medium text-xs">{fx.label}</span>
                      <span className="text-[10px] text-muted-foreground">{fx.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={handleApply} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Apply {activeEffect?.label || "Effect"}</>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                      <Film className="h-8 w-8 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Upload an image and choose a film effect to transform your photo.
                    </p>
                  </div>
                ) : (
                  <div>
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                        <p className="text-sm text-muted-foreground">Applying {activeEffect?.label}...</p>
                      </div>
                    ) : imagePreview && resultUrl ? (
                      <BeforeAfterSlider
                        before={imagePreview}
                        after={resultUrl}
                        beforeLabel="Original"
                        afterLabel="Film Effect"
                        height={450}
                        accentColor="amber"
                      />
                    ) : (
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && (
                            <img src={imagePreview} alt="Original" className="w-full h-auto max-h-[350px] object-contain" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground py-12 text-center">Result will appear here</p>
                      </div>
                    )}
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
