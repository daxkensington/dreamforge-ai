import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sun,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PRESETS = [
  { label: "Golden Hour", prompt: "Warm golden sunset light from the left, soft shadows, magic hour glow" },
  { label: "Studio Soft", prompt: "Soft diffused studio lighting, even illumination, minimal shadows" },
  { label: "Dramatic Side", prompt: "Strong dramatic side lighting from the right, deep shadows, high contrast" },
  { label: "Neon Night", prompt: "Colorful neon lights, purple and cyan glow, nighttime urban atmosphere" },
  { label: "Overcast", prompt: "Soft overcast daylight, flat even lighting, no harsh shadows" },
  { label: "Backlit", prompt: "Strong backlight creating rim lighting and silhouette edges, lens flare" },
];

export default function ToolRelight() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(0.5);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const relightMutation = trpc.tools.relight.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Relighting complete!");
      } else {
        toast.error(data.error || "Relighting failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

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
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = () => {
    if (!imageUrl) {
      toast.error("Please provide an image");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Please describe the lighting you want");
      return;
    }
    setResultUrl(null);
    relightMutation.mutate({ imageUrl, prompt, strength });
  };

  const handleReset = () => {
    setImageUrl("");
    setImagePreview(null);
    setPrompt("");
    setStrength(0.5);
    setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = relightMutation.isPending;

  return (
    <ToolPageLayout
      title="AI Relighting"
      description="Change the lighting and mood of any photo"
      icon={Sun}
      gradient="from-amber-500 to-yellow-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Input */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Source Image</Label>
                <Input
                  placeholder="Paste image URL..."
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImagePreview(e.target.value);
                  }}
                  className="text-sm"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Uploading..." : "Or Upload Image"}
                </Button>
                {imagePreview && (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img loading="lazy" src={imagePreview} alt="Source" className="w-full h-40 object-cover" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lighting Prompt */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Lighting Description</Label>
                <Textarea
                  placeholder="Describe the lighting you want... e.g. 'golden sunset light from the left'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Presets */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Lighting Presets</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setPrompt(preset.prompt)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        prompt === preset.prompt
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Strength */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Strength</Label>
                  <span className="text-xs text-muted-foreground">{strength.toFixed(1)}</span>
                </div>
                <Slider
                  value={[strength]}
                  onValueChange={([v]) => setStrength(v)}
                  min={0.1}
                  max={1.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtle</span>
                  <span>Strong</span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!imageUrl || !prompt.trim() || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Relighting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Apply Lighting
                  </>
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
                <AnimatePresence mode="wait">
                  {!imagePreview && !resultUrl && !isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                        <Sun className="h-8 w-8 text-amber-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">AI Relighting</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Upload an image and describe the lighting you want to apply.
                      </p>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-[500px]">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                      <p className="text-sm text-muted-foreground">Applying new lighting...</p>
                    </div>
                  ) : resultUrl ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4"
                    >
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Before</p>
                          <div className="rounded-lg overflow-hidden border border-border/30">
                            {imagePreview && (
                              <img loading="lazy" src={imagePreview} alt="Before" className="w-full h-auto object-contain" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">After</p>
                          <div className="rounded-lg overflow-hidden border border-border/30">
                            <img loading="lazy" src={resultUrl} alt="After" className="w-full h-auto object-contain" />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Result
                        </Button>
                      </div>
                    </motion.div>
                  ) : imagePreview ? (
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground mb-2">Original</p>
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                        <img loading="lazy" src={imagePreview} alt="Original" className="w-full h-auto max-h-[400px] object-contain" />
                      </div>
                      <div className="flex flex-col items-center gap-2 py-8">
                        <Sun className="h-6 w-6 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Choose a lighting preset or describe your own</p>
                      </div>
                    </div>
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
