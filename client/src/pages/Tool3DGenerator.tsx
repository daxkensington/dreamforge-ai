import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Box,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Tool3DGenerator() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [resultModelUrl, setResultModelUrl] = useState<string | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generate3DMutation = trpc.tools.generate3D.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.modelUrl) {
        setResultModelUrl(data.modelUrl);
        setResultPreviewUrl(data.previewUrl || null);
        toast.success("3D model generated!");
      } else {
        toast.error(data.error || "3D generation failed");
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
    setResultModelUrl(null);
    setResultPreviewUrl(null);
    generate3DMutation.mutate({ imageUrl });
  };

  const handleReset = () => {
    setImageUrl("");
    setImagePreview(null);
    setResultModelUrl(null);
    setResultPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = generate3DMutation.isPending;

  return (
    <ToolPageLayout
      title="3D Model Generator"
      description="Turn any image into a 3D model"
      icon={Box}
      gradient="from-violet-500 to-purple-400"
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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!imageUrl || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating 3D Model...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate 3D Model
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
                  {!resultPreviewUrl && !isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                        <Box className="h-8 w-8 text-violet-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">3D Model Generator</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Upload an image to convert it into a downloadable 3D model (GLB).
                      </p>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-[500px]">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                      <p className="text-sm text-muted-foreground">Generating 3D model...</p>
                      <p className="text-xs text-muted-foreground/60">This may take a moment</p>
                    </div>
                  ) : resultPreviewUrl ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 space-y-4"
                    >
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                        <img loading="lazy" src={resultPreviewUrl} alt="3D Preview" className="w-full h-auto max-h-[400px] object-contain" />
                      </div>
                      <div className="flex justify-end gap-3">
                        {resultModelUrl && (
                          <Button asChild size="sm">
                            <a href={resultModelUrl} download="model.glb">
                              <Download className="h-4 w-4 mr-2" />
                              Download GLB Model
                            </a>
                          </Button>
                        )}
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
