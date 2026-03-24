import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LayoutGrid,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
  X,
  Plus,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LAYOUTS = [
  { value: "grid", label: "Grid", desc: "Uniform grid layout" },
  { value: "mosaic", label: "Mosaic", desc: "Dynamic tile sizes" },
  { value: "polaroid", label: "Polaroid", desc: "Scattered polaroid frames" },
  { value: "magazine", label: "Magazine", desc: "Editorial spread" },
  { value: "scrapbook", label: "Scrapbook", desc: "Playful mixed media" },
  { value: "filmstrip", label: "Filmstrip", desc: "Cinematic strip layout" },
] as const;

type LayoutType = typeof LAYOUTS[number]["value"];

interface UploadedImage {
  url: string;
  preview: string;
}

export default function ToolCollage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [layout, setLayout] = useState<LayoutType>("grid");
  const [theme, setTheme] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.collage.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Collage created!");
      } else {
        toast.error(data.error || "Collage creation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 9 - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) { toast.error("Maximum 9 images allowed"); return; }

    setUploading(true);
    try {
      for (const file of toUpload) {
        if (!file.type.startsWith("image/")) continue;

        const preview = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const { url } = await res.json();
          setImages((prev) => [...prev, { url, preview }]);
        }
      }
    } catch { toast.error("Upload failed"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    if (images.length < 2) { toast.error("Upload at least 2 images"); return; }
    setResultUrl(null);
    mutation.mutate({
      imageUrls: images.map((img) => img.url),
      layout: layout as any,
      theme: theme || undefined,
    });
  };

  const handleReset = () => {
    setImages([]); setResultUrl(null); setTheme("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout
      title="Photo Collage"
      description="Create beautiful photo collages with AI layouts"
      icon={LayoutGrid}
      gradient="from-violet-500 to-purple-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Upload */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Images ({images.length}/9)</Label>
                  {images.length > 0 && (
                    <span className="text-xs text-muted-foreground">Min 2, max 9</span>
                  )}
                </div>

                {/* Uploaded previews */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-border/30">
                        <img src={img.preview} alt={`Image ${i + 1}`} className="w-full h-20 object-cover" />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 h-5 w-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || images.length >= 9}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Uploading..." : images.length >= 9 ? "Max Images Reached" : "Add Images"}
                </Button>
              </CardContent>
            </Card>

            {/* Layout Selection */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Layout</Label>
                <div className="grid grid-cols-2 gap-2">
                  {LAYOUTS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => setLayout(l.value)}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 text-left text-sm transition-all ${
                        layout === l.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <span className="font-medium text-xs">{l.label}</span>
                      <span className="text-[10px] text-muted-foreground">{l.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Theme */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-2">
                <Label className="text-sm font-medium">Theme (Optional)</Label>
                <Input
                  placeholder="e.g., Summer vacation, Wedding day..."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="text-sm"
                />
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={images.length < 2 || isProcessing} className="flex-1" size="lg">
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Create Collage</>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
                          <p className="text-muted-foreground">Arranging your collage...</p>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4 mx-auto">
                            <LayoutGrid className="h-8 w-8 text-violet-400" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">Collage Preview</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            Upload 2-9 images and choose a layout to create your collage.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div>
                    <div className="p-6 flex items-center justify-center bg-muted/20">
                      <motion.img
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={resultUrl}
                        alt="Generated Collage"
                        className="max-w-full max-h-[500px] object-contain rounded-lg"
                      />
                    </div>
                    <div className="p-4 border-t border-border/50 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                        <Download className="h-4 w-4 mr-2" />Download Collage
                      </Button>
                    </div>
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
