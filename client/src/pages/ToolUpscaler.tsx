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
  Maximize,
  Upload,
  Loader2,
  Download,
  ArrowRight,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";


export default function ToolUpscaler() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scaleFactor, setScaleFactor] = useState<"2x" | "4x">("2x");
  const [enhanceDetails, setEnhanceDetails] = useState(true);
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
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      // Read file and create preview
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);

      // Upload to S3 via the server
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setImageUrl(url);
      } else {
        // Fallback: use data URL directly
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        const dataUrl = `data:${file.type};base64,${base64}`;
        setImagePreview(dataUrl);
        toast.info("Using local preview — enter an image URL for best results");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUpscale = () => {
    if (!imageUrl) {
      toast.error("Please provide an image URL or upload an image");
      return;
    }
    setResultUrl(null);
    upscaleMutation.mutate({ imageUrl, scaleFactor, enhanceDetails });
  };

  const handleReset = () => {
    setImageUrl("");
    setImagePreview(null);
    setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = upscaleMutation.isPending;

  return (
    <ToolPageLayout
      title="Image Upscaler"
      description="Enhance resolution and sharpen details with AI"
      icon={Maximize}
      gradient="from-blue-500 to-cyan-400"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                {/* Image Input */}
                <div className="space-y-3">
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
                  <div className="relative">
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
                  </div>
                </div>

                {/* Scale Factor */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Scale Factor</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["2x", "4x"] as const).map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setScaleFactor(scale)}
                        className={`relative flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all ${
                          scaleFactor === scale
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <span className="text-2xl font-bold">{scale}</span>
                        <span className="text-xs text-muted-foreground">
                          {scale === "2x" ? "High Res (2K)" : "Ultra Res (4K)"}
                        </span>
                        {scaleFactor === scale && (
                          <motion.div
                            layoutId="scale-indicator"
                            className="absolute inset-0 rounded-xl border-2 border-primary"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Enhance Details Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Enhance Details</Label>
                    <p className="text-xs text-muted-foreground">Sharpen textures and fine details</p>
                  </div>
                  <Switch checked={enhanceDetails} onCheckedChange={setEnhanceDetails} />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleUpscale}
                    disabled={!imageUrl || isProcessing}
                    className="flex-1"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Upscaling...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Upscale Image
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
                      <Maximize className="h-8 w-8 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Paste an image URL or upload a file to get started with AI upscaling.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {/* Before / After Labels */}
                    {imagePreview && (
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                        <div className="p-4">
                          <Badge variant="secondary" className="mb-3">Original</Badge>
                          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                            <img
                              src={imagePreview}
                              alt="Original"
                              className="w-full h-auto max-h-[300px] object-contain"
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <Badge className="mb-3 bg-blue-500/20 text-blue-400 border-blue-500/30">
                            {resultUrl ? `Upscaled ${scaleFactor}` : "Result"}
                          </Badge>
                          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                            <AnimatePresence mode="wait">
                              {isProcessing ? (
                                <motion.div
                                  key="loading"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="flex flex-col items-center gap-3 py-12"
                                >
                                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                                  <p className="text-sm text-muted-foreground">AI is enhancing your image...</p>
                                </motion.div>
                              ) : resultUrl ? (
                                <motion.div
                                  key="result"
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                >
                                  <img
                                    src={resultUrl}
                                    alt="Upscaled"
                                    className="w-full h-auto max-h-[300px] object-contain"
                                  />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="waiting"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="flex flex-col items-center gap-2 py-12"
                                >
                                  <ArrowRight className="h-6 w-6 text-muted-foreground/50" />
                                  <p className="text-sm text-muted-foreground">Click "Upscale Image" to enhance</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Download Button */}
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(resultUrl, "_blank")}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download Upscaled Image
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
