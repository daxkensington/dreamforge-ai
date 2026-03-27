import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Palette,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES = [
  { value: "oil-painting" as const, label: "Oil Painting", emoji: "🎨", color: "from-amber-600 to-blue-500" },
  { value: "watercolor" as const, label: "Watercolor", emoji: "💧", color: "from-sky-400 to-blue-500" },
  { value: "pencil-sketch" as const, label: "Pencil Sketch", emoji: "✏️", color: "from-gray-400 to-gray-600" },
  { value: "anime" as const, label: "Anime", emoji: "🌸", color: "from-pink-400 to-rose-500" },
  { value: "pop-art" as const, label: "Pop Art", emoji: "🎯", color: "from-red-500 to-yellow-400" },
  { value: "cyberpunk" as const, label: "Cyberpunk", emoji: "🌃", color: "from-violet-500 to-cyan-400" },
  { value: "art-nouveau" as const, label: "Art Nouveau", emoji: "🌿", color: "from-emerald-500 to-lime-400" },
  { value: "pixel-art" as const, label: "Pixel Art", emoji: "👾", color: "from-indigo-500 to-purple-500" },
  { value: "impressionist" as const, label: "Impressionist", emoji: "🌻", color: "from-yellow-400 to-teal-400" },
  { value: "comic-book" as const, label: "Comic Book", emoji: "💥", color: "from-red-500 to-blue-600" },
];

type StyleValue = typeof STYLES[number]["value"];

export default function ToolStyleTransfer() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleValue>("oil-painting");
  const [intensity, setIntensity] = useState(0.7);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const styleMutation = trpc.tools.styleTransfer.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Style applied successfully!");
      } else {
        toast.error(data.error || "Style transfer failed");
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

  const handleApplyStyle = () => {
    if (!imageUrl) {
      toast.error("Please provide an image URL or upload an image");
      return;
    }
    setResultUrl(null);
    styleMutation.mutate({ imageUrl, style: selectedStyle, intensity });
  };

  const handleReset = () => {
    setImageUrl("");
    setImagePreview(null);
    setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = styleMutation.isPending;
  const activeStyleInfo = STYLES.find((s) => s.value === selectedStyle);

  return (
    <ToolPageLayout
      title="Style Transfer"
      description="Transform images with artistic styles"
      icon={Palette}
      gradient="from-violet-500 to-fuchsia-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/example-style-1.jpg" alt="Style transfer examples" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
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
              </CardContent>
            </Card>

            {/* Style Selection */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Art Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => {
                        setSelectedStyle(style.value);
                        setResultUrl(null);
                      }}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left text-sm transition-all ${
                        selectedStyle === style.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <span className="text-lg">{style.emoji}</span>
                      <span className="font-medium truncate">{style.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Intensity */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Style Intensity</Label>
                  <Badge variant="secondary" className="text-xs">
                    {intensity <= 0.3 ? "Subtle" : intensity <= 0.7 ? "Moderate" : "Strong"}
                  </Badge>
                </div>
                <Slider
                  value={[intensity]}
                  onValueChange={([v]) => setIntensity(v)}
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
                onClick={handleApplyStyle}
                disabled={!imageUrl || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying Style...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Apply {activeStyleInfo?.label || "Style"}
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
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                      <Palette className="h-8 w-8 text-violet-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Upload an image and choose a style to see the AI transformation.
                    </p>
                  </div>
                ) : (
                  <div>
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                        <p className="text-sm text-muted-foreground">Applying {activeStyleInfo?.label}...</p>
                      </div>
                    ) : imagePreview && resultUrl ? (
                      <BeforeAfterSlider
                        before={imagePreview}
                        after={resultUrl}
                        beforeLabel="Original"
                        afterLabel="Styled"
                        height={450}
                        accentColor="purple"
                      />
                    ) : (
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && (
                            <img loading="lazy" src={imagePreview} alt="Original" className="w-full h-auto max-h-[350px] object-contain" />
                          )}
                        </div>
                        <div className="flex flex-col items-center gap-2 py-12">
                          <Palette className="h-6 w-6 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">Select a style and click apply</p>
                        </div>
                      </div>
                    )}

                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Styled Image
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
